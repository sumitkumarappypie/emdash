import { describe, it, expect, beforeEach } from "vitest";

import { createCart, addCartItem } from "../../../../../plugins/commerce/src/cart.js";
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
			const limit = opts?.limit ?? 50;
			return { items: items.slice(0, limit), hasMore: items.length > limit };
		},
		count: async (): Promise<number> => store.size,
	};
}

describe("Digital-only cart shipping skip", () => {
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
		await orderCounterStorage.put("current", { value: 1000 });
	});

	it("zeroes shipping for digital-only cart", async () => {
		await productStorage.put("digital-1", {
			id: "digital-1",
			name: "E-Book",
			slug: "ebook",
			status: "active",
			productType: "digital",
			basePrice: 9.99,
			trackInventory: false,
			sku: "",
		});

		const cart = await createCart(cartStorage as never, { sessionId: "s1" });
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "digital-1", quantity: 1 },
		);

		// Simulate shipping being set on the cart
		const existing = await cartStorage.get(cart.id);
		await cartStorage.put(cart.id, {
			...existing,
			shippingTotal: 5.99,
			shippingMethodId: "flat-rate",
		});

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
				email: "test@example.com",
				name: "Test",
				paymentProvider: "stripe",
			},
		);

		expect(order.shippingTotal).toBe(0);
		expect(order.shippingMethod).toBeNull();
	});

	it("keeps shipping for physical products", async () => {
		await productStorage.put("physical-1", {
			id: "physical-1",
			name: "T-Shirt",
			slug: "tshirt",
			status: "active",
			productType: "physical",
			basePrice: 25,
			trackInventory: false,
			sku: "",
		});

		const cart = await createCart(cartStorage as never, { sessionId: "s2" });
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "physical-1", quantity: 1 },
		);

		const existing = await cartStorage.get(cart.id);
		await cartStorage.put(cart.id, {
			...existing,
			shippingTotal: 5.99,
			shippingMethodId: "flat-rate",
		});

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
				email: "test@example.com",
				name: "Test",
				paymentProvider: "stripe",
			},
		);

		expect(order.shippingTotal).toBe(5.99);
		expect(order.shippingMethod).toBe("flat-rate");
	});

	it("keeps shipping for mixed physical+digital cart", async () => {
		await productStorage.put("digital-2", {
			id: "digital-2",
			name: "E-Book",
			slug: "ebook2",
			status: "active",
			productType: "digital",
			basePrice: 9.99,
			trackInventory: false,
			sku: "",
		});
		await productStorage.put("physical-2", {
			id: "physical-2",
			name: "Poster",
			slug: "poster",
			status: "active",
			productType: "physical",
			basePrice: 15,
			trackInventory: false,
			sku: "",
		});

		const cart = await createCart(cartStorage as never, { sessionId: "s3" });
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "digital-2", quantity: 1 },
		);
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "physical-2", quantity: 1 },
		);

		const existing = await cartStorage.get(cart.id);
		await cartStorage.put(cart.id, {
			...existing,
			shippingTotal: 4.99,
			shippingMethodId: "flat-rate",
		});

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
				email: "test@example.com",
				name: "Test",
				paymentProvider: "stripe",
			},
		);

		expect(order.shippingTotal).toBe(4.99);
		expect(order.shippingMethod).toBe("flat-rate");
	});
});
