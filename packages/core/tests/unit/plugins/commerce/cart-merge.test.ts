import { describe, it, expect, beforeEach } from "vitest";

import {
	createCart,
	addCartItem,
	getCartItems,
	mergeCarts,
} from "../../../../../plugins/commerce/src/cart.js";

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
			const limit = opts?.limit ?? 50;
			return { items: items.slice(0, limit), hasMore: items.length > limit };
		},
		count: async (): Promise<number> => store.size,
	};
}

describe("Cart Merge", () => {
	let cartStorage: ReturnType<typeof createMockStorage>;
	let cartItemStorage: ReturnType<typeof createMockStorage>;
	let productStorage: ReturnType<typeof createMockStorage>;
	let variantStorage: ReturnType<typeof createMockStorage>;

	beforeEach(async () => {
		cartStorage = createMockStorage();
		cartItemStorage = createMockStorage();
		productStorage = createMockStorage();
		variantStorage = createMockStorage();

		// Set up test products
		await productStorage.put("prod-a", {
			id: "prod-a",
			basePrice: 10,
			status: "active",
			trackInventory: false,
		});
		await productStorage.put("prod-b", {
			id: "prod-b",
			basePrice: 20,
			status: "active",
			trackInventory: false,
		});
		await productStorage.put("prod-c", {
			id: "prod-c",
			basePrice: 30,
			status: "active",
			trackInventory: false,
		});
	});

	it("merges anonymous cart into customer cart, larger quantity wins", async () => {
		// Anonymous cart: prod-a x 3, prod-b x 1
		const anonCart = await createCart(cartStorage as never, { sessionId: "sess-1" });
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			anonCart.id,
			{ productId: "prod-a", quantity: 3 },
		);
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			anonCart.id,
			{ productId: "prod-b", quantity: 1 },
		);

		// Customer cart: prod-a x 1, prod-c x 2
		const custCart = await createCart(cartStorage as never, { customerId: "cust-1" });
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			custCart.id,
			{ productId: "prod-a", quantity: 1 },
		);
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			custCart.id,
			{ productId: "prod-c", quantity: 2 },
		);

		const merged = await mergeCarts(
			cartStorage as never,
			cartItemStorage as never,
			anonCart.id,
			custCart.id,
		);

		const items = await getCartItems(cartItemStorage as never, merged.id);
		expect(items).toHaveLength(3);

		const itemA = items.find((i) => i.productId === "prod-a");
		expect(itemA!.quantity).toBe(3); // Larger wins (anon had 3, cust had 1)

		const itemB = items.find((i) => i.productId === "prod-b");
		expect(itemB!.quantity).toBe(1);

		const itemC = items.find((i) => i.productId === "prod-c");
		expect(itemC!.quantity).toBe(2);

		// Anonymous cart should be deleted
		const deletedAnon = await cartStorage.get(anonCart.id);
		expect(deletedAnon).toBeNull();
	});

	it("keeps customer cart quantity when it's larger", async () => {
		const anonCart = await createCart(cartStorage as never, { sessionId: "sess-2" });
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			anonCart.id,
			{ productId: "prod-a", quantity: 1 },
		);

		const custCart = await createCart(cartStorage as never, { customerId: "cust-2" });
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			custCart.id,
			{ productId: "prod-a", quantity: 5 },
		);

		await mergeCarts(cartStorage as never, cartItemStorage as never, anonCart.id, custCart.id);

		const items = await getCartItems(cartItemStorage as never, custCart.id);
		const itemA = items.find((i) => i.productId === "prod-a");
		expect(itemA!.quantity).toBe(5); // Customer had 5, anon had 1 → keep 5
	});
});
