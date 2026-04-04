import { describe, it, expect, beforeEach } from "vitest";

import { parseStripeEvent } from "../../../../../plugins/commerce-stripe/src/webhook.js";
import {
	createCart,
	addCartItem,
	recalculateCart,
} from "../../../../../plugins/commerce/src/cart.js";
import {
	createCategory,
	getCategoryBySlug,
	getCategoryTree,
} from "../../../../../plugins/commerce/src/categories.js";
import { createOrderFromCart } from "../../../../../plugins/commerce/src/checkout.js";

function createMockStorage<T = unknown>() {
	const store = new Map<string, T>();
	return {
		get: async (id: string): Promise<T | null> => store.get(id) ?? null,
		put: async (id: string, data: T): Promise<void> => {
			store.set(id, data);
		},
		delete: async (id: string): Promise<boolean> => store.delete(id),
		exists: async (id: string): Promise<boolean> => store.has(id),
		query: async (opts?: {
			where?: Record<string, unknown>;
			orderBy?: Record<string, string>;
			limit?: number;
		}): Promise<{ items: Array<{ id: string; data: T }>; hasMore: boolean }> => {
			let items = Array.from(store.entries(), ([id, data]) => ({ id, data }));
			if (opts?.where) {
				for (const [key, value] of Object.entries(opts.where)) {
					items = items.filter((item) => (item.data as Record<string, unknown>)[key] === value);
				}
			}
			if (opts?.orderBy) {
				const entries = Object.entries(opts.orderBy);
				if (entries.length > 0) {
					const [field, dir] = entries[0]!;
					items.sort((a, b) => {
						const av = (a.data as Record<string, unknown>)[field];
						const bv = (b.data as Record<string, unknown>)[field];
						if (typeof av === "number" && typeof bv === "number") {
							return dir === "asc" ? av - bv : bv - av;
						}
						return dir === "asc"
							? String(av).localeCompare(String(bv))
							: String(bv).localeCompare(String(av));
					});
				}
			}
			const limit = opts?.limit ?? 50;
			return { items: items.slice(0, limit), hasMore: items.length > limit };
		},
		count: async (): Promise<number> => store.size,
	};
}

describe("Category Tree", () => {
	let storage: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		storage = createMockStorage();
	});

	it("builds nested tree from flat list", async () => {
		await createCategory(storage as never, { name: "Electronics", slug: "electronics" });
		const elec = await getCategoryBySlug(storage as never, "electronics");

		await createCategory(storage as never, {
			name: "Phones",
			slug: "phones",
			parentId: elec!.id,
		});
		await createCategory(storage as never, {
			name: "Laptops",
			slug: "laptops",
			parentId: elec!.id,
		});
		await createCategory(storage as never, { name: "Clothing", slug: "clothing" });

		const tree = await getCategoryTree(storage as never);
		expect(tree).toHaveLength(2); // Electronics, Clothing
		const elecNode = tree.find((n) => n.slug === "electronics");
		expect(elecNode!.children).toHaveLength(2);
		expect(elecNode!.children.map((c) => c.slug)).toContain("phones");
		expect(elecNode!.children.map((c) => c.slug)).toContain("laptops");
	});

	it("handles orphan categories gracefully", async () => {
		await createCategory(storage as never, {
			name: "Orphan",
			slug: "orphan",
			parentId: "nonexistent",
		});
		const tree = await getCategoryTree(storage as never);
		expect(tree).toHaveLength(1); // Orphan promoted to root
		expect(tree[0]!.slug).toBe("orphan");
	});
});

describe("Guest Checkout", () => {
	let cartStorage: ReturnType<typeof createMockStorage>;
	let cartItemStorage: ReturnType<typeof createMockStorage>;
	let productStorage: ReturnType<typeof createMockStorage>;
	let variantStorage: ReturnType<typeof createMockStorage>;
	let orderStorage: ReturnType<typeof createMockStorage>;
	let orderItemStorage: ReturnType<typeof createMockStorage>;
	let customerStorage: ReturnType<typeof createMockStorage>;
	let orderCounterStorage: ReturnType<typeof createMockStorage>;

	beforeEach(async () => {
		cartStorage = createMockStorage();
		cartItemStorage = createMockStorage();
		productStorage = createMockStorage();
		variantStorage = createMockStorage();
		orderStorage = createMockStorage();
		orderItemStorage = createMockStorage();
		customerStorage = createMockStorage();
		orderCounterStorage = createMockStorage();

		await orderCounterStorage.put("current", { value: 1000 } as never);

		await productStorage.put("prod-1", {
			id: "prod-1",
			name: "Guest Widget",
			basePrice: 15,
			status: "active",
			sku: "GW-001",
			trackInventory: false,
		});
	});

	it("completes checkout without customer account", async () => {
		const cart = await createCart(cartStorage as never, { sessionId: "anon-sess" });

		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "prod-1", quantity: 1 },
		);
		await recalculateCart(cartStorage as never, cartItemStorage as never, cart.id);

		const order = await createOrderFromCart(
			{
				carts: cartStorage as never,
				cartItems: cartItemStorage as never,
				orders: orderStorage as never,
				orderItems: orderItemStorage as never,
				products: productStorage as never,
				variants: variantStorage as never,
				customers: customerStorage as never,
				orderCounter: orderCounterStorage as never,
			},
			cart.id,
			{
				email: "guest@example.com",
				name: "Guest User",
				paymentProvider: "stripe",
			},
		);

		expect(order.customerId).toBeNull();
		expect(order.customerEmail).toBe("guest@example.com");
		expect(order.status).toBe("pending");
		expect(order.total).toBe(15);
	});
});

describe("Stripe Webhook Event Parsing", () => {
	it("parses payment_intent.succeeded event", () => {
		const payload = JSON.stringify({
			id: "evt_123",
			type: "payment_intent.succeeded",
			data: {
				object: {
					id: "pi_abc",
					metadata: { orderId: "order-456" },
				},
			},
		});

		const event = parseStripeEvent(payload);
		expect(event.type).toBe("payment_intent.succeeded");
		expect(event.id).toBe("evt_123");
		expect((event.data.object.metadata as Record<string, string>).orderId).toBe("order-456");
	});

	it("parses charge.refunded event", () => {
		const payload = JSON.stringify({
			id: "evt_456",
			type: "charge.refunded",
			data: {
				object: {
					id: "ch_abc",
					metadata: { orderId: "order-789" },
				},
			},
		});

		const event = parseStripeEvent(payload);
		expect(event.type).toBe("charge.refunded");
		expect(event.data.object.id).toBe("ch_abc");
	});
});
