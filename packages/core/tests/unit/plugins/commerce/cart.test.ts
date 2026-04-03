import { describe, it, expect, beforeEach } from "vitest";

import {
	CommerceError,
	createCart,
	addCartItem,
	updateCartItemQuantity,
	removeCartItem,
	recalculateCart,
} from "../../../../../plugins/commerce/src/cart.js";

function createMockStorage<T = unknown>() {
	const store = new Map<string, T>();
	return {
		get: async (id: string): Promise<T | null> => store.get(id) ?? null,
		put: async (id: string, data: T): Promise<void> => {
			store.set(id, data);
		},
		delete: async (id: string): Promise<boolean> => store.delete(id),
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
			const limit = opts?.limit ?? 50;
			return { items: items.slice(0, limit), hasMore: items.length > limit };
		},
	};
}

describe("Cart operations", () => {
	let cartStorage: ReturnType<typeof createMockStorage>;
	let cartItemStorage: ReturnType<typeof createMockStorage>;
	let productStorage: ReturnType<typeof createMockStorage>;
	let variantStorage: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		cartStorage = createMockStorage();
		cartItemStorage = createMockStorage();
		productStorage = createMockStorage();
		variantStorage = createMockStorage();
	});

	it("creates a cart with session id and 30-day expiry", async () => {
		const before = new Date();
		const cart = await createCart(cartStorage as never, { sessionId: "sess-abc" });
		const after = new Date();

		expect(cart.id).toBeDefined();
		expect(cart.sessionId).toBe("sess-abc");
		expect(cart.customerId).toBeNull();
		expect(cart.currency).toBe("USD");
		expect(cart.subtotal).toBe(0);
		expect(cart.total).toBe(0);

		const expiresAt = new Date(cart.expiresAt);
		const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
		expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before.getTime() + thirtyDaysMs - 1000);
		expect(expiresAt.getTime()).toBeLessThanOrEqual(after.getTime() + thirtyDaysMs + 1000);
	});

	it("adds an item to the cart", async () => {
		const cart = await createCart(cartStorage as never, { sessionId: "sess-1" });

		await productStorage.put("prod-1", {
			id: "prod-1",
			status: "active",
			basePrice: 20,
			trackInventory: false,
		});

		const item = await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "prod-1", quantity: 2 },
		);

		expect(item.productId).toBe("prod-1");
		expect(item.quantity).toBe(2);
		expect(item.unitPrice).toBe(20);
		expect(item.totalPrice).toBe(40);
		expect(item.cartId).toBe(cart.id);
	});

	it("rejects adding an out-of-stock product", async () => {
		const cart = await createCart(cartStorage as never, { sessionId: "sess-2" });

		await productStorage.put("prod-2", {
			id: "prod-2",
			status: "active",
			basePrice: 10,
			trackInventory: true,
			inventoryQuantity: 1,
		});

		await expect(
			addCartItem(
				cartStorage as never,
				cartItemStorage as never,
				productStorage as never,
				variantStorage as never,
				cart.id,
				{ productId: "prod-2", quantity: 5 },
			),
		).rejects.toThrow(CommerceError);

		await expect(
			addCartItem(
				cartStorage as never,
				cartItemStorage as never,
				productStorage as never,
				variantStorage as never,
				cart.id,
				{ productId: "prod-2", quantity: 5 },
			),
		).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
	});

	it("increments quantity when adding existing product", async () => {
		const cart = await createCart(cartStorage as never, { sessionId: "sess-3" });

		await productStorage.put("prod-3", {
			id: "prod-3",
			status: "active",
			basePrice: 15,
			trackInventory: false,
		});

		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "prod-3", quantity: 1 },
		);

		const item = await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "prod-3", quantity: 2 },
		);

		expect(item.quantity).toBe(3);
		expect(item.totalPrice).toBe(45);
	});

	it("recalculates cart totals from items", async () => {
		const cart = await createCart(cartStorage as never, { sessionId: "sess-4" });

		await productStorage.put("prod-4a", {
			id: "prod-4a",
			status: "active",
			basePrice: 10,
			trackInventory: false,
		});
		await productStorage.put("prod-4b", {
			id: "prod-4b",
			status: "active",
			basePrice: 30,
			trackInventory: false,
		});

		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "prod-4a", quantity: 1 },
		);
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "prod-4b", quantity: 1 },
		);

		const updated = await recalculateCart(cartStorage as never, cartItemStorage as never, cart.id);

		expect(updated).not.toBeNull();
		expect(updated!.subtotal).toBe(40);
		expect(updated!.total).toBe(40);
	});

	it("removes an item from the cart", async () => {
		const cart = await createCart(cartStorage as never, { sessionId: "sess-5" });

		await productStorage.put("prod-5", {
			id: "prod-5",
			status: "active",
			basePrice: 25,
			trackInventory: false,
		});

		const item = await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "prod-5", quantity: 1 },
		);

		const removed = await removeCartItem(cartItemStorage as never, item.id);
		expect(removed).toBe(true);

		const again = await removeCartItem(cartItemStorage as never, item.id);
		expect(again).toBe(false);
	});

	it("updates item quantity", async () => {
		const cart = await createCart(cartStorage as never, { sessionId: "sess-6" });

		await productStorage.put("prod-6", {
			id: "prod-6",
			status: "active",
			basePrice: 10,
			trackInventory: false,
		});

		const item = await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "prod-6", quantity: 1 },
		);

		const updated = await updateCartItemQuantity(cartItemStorage as never, item.id, 5);

		expect(updated).not.toBeNull();
		expect(updated!.quantity).toBe(5);
		expect(updated!.totalPrice).toBe(50);
	});
});
