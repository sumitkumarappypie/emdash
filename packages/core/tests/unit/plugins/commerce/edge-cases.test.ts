import { describe, it, expect, beforeEach } from "vitest";

import {
	createCart,
	addCartItem,
	recalculateCartWithValidation,
} from "../../../../../plugins/commerce/src/cart.js";
import { validateCoupon } from "../../../../../plugins/commerce/src/coupons.js";
import type { Cart, CartItem, Coupon } from "../../../../../plugins/commerce/src/types.js";

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

function makeCoupon(overrides: Partial<Coupon> = {}): Coupon {
	return {
		id: "coupon-1",
		code: "TEST10",
		description: "",
		type: "percentage",
		value: 10,
		currency: "USD",
		minimumOrderAmount: null,
		maximumDiscountAmount: null,
		usageLimit: null,
		usageCount: 0,
		perCustomerLimit: null,
		appliesTo: "all",
		productIds: [],
		categoryIds: [],
		startsAt: null,
		expiresAt: null,
		status: "active",
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides,
	};
}

function makeCart(overrides: Partial<Cart> = {}): Cart {
	return {
		id: "cart-1",
		sessionId: "sess-1",
		customerId: null,
		currency: "USD",
		subtotal: 100,
		discountTotal: 0,
		shippingTotal: 0,
		taxTotal: 0,
		total: 100,
		shippingAddress: null,
		billingAddress: null,
		shippingMethodId: null,
		couponCodes: [],
		expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		...overrides,
	};
}

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
	return {
		id: "item-1",
		cartId: "cart-1",
		productId: "prod-1",
		variantId: null,
		quantity: 1,
		unitPrice: 100,
		totalPrice: 100,
		metadata: {},
		...overrides,
	};
}

describe("Coupon per-customer limit", () => {
	it("rejects coupon when customer has hit per-customer limit", () => {
		const coupon = makeCoupon({ perCustomerLimit: 1 });
		const customerUsage = 1;
		const result = validateCoupon(coupon, makeCart(), [makeCartItem()], customerUsage);
		expect(result).toBe("COUPON_LIMIT_REACHED");
	});

	it("allows coupon when customer is under per-customer limit", () => {
		const coupon = makeCoupon({ perCustomerLimit: 3 });
		const customerUsage = 1;
		const result = validateCoupon(coupon, makeCart(), [makeCartItem()], customerUsage);
		expect(result).toBeNull();
	});

	it("ignores per-customer limit when no usage count provided", () => {
		const coupon = makeCoupon({ perCustomerLimit: 1 });
		const result = validateCoupon(coupon, makeCart(), [makeCartItem()]);
		expect(result).toBeNull();
	});
});

describe("Cart validation edge cases", () => {
	let cartStorage: ReturnType<typeof createMockStorage>;
	let cartItemStorage: ReturnType<typeof createMockStorage>;
	let productStorage: ReturnType<typeof createMockStorage>;
	let variantStorage: ReturnType<typeof createMockStorage>;

	beforeEach(async () => {
		cartStorage = createMockStorage();
		cartItemStorage = createMockStorage();
		productStorage = createMockStorage();
		variantStorage = createMockStorage();

		await productStorage.put("prod-1", {
			id: "prod-1",
			basePrice: 25,
			status: "active",
			trackInventory: false,
		});
	});

	it("removes unavailable product during recalculation", async () => {
		const cart = await createCart(cartStorage as never, { sessionId: "test" });
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "prod-1", quantity: 1 },
		);

		// Delete the product (simulate it becoming unavailable)
		await productStorage.delete("prod-1");

		const result = await recalculateCartWithValidation(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
		);

		expect(result.removedItems).toHaveLength(1);
		expect(result.cart.subtotal).toBe(0);
	});

	it("updates price when product price changes", async () => {
		const cart = await createCart(cartStorage as never, { sessionId: "test-price" });
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "prod-1", quantity: 2 },
		);

		// Change the price
		await productStorage.put("prod-1", {
			id: "prod-1",
			basePrice: 30,
			status: "active",
			trackInventory: false,
		});

		const result = await recalculateCartWithValidation(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
		);

		expect(result.removedItems).toHaveLength(0);
		expect(result.cart.subtotal).toBe(60); // 30 * 2
	});

	it("removes archived product during recalculation", async () => {
		const cart = await createCart(cartStorage as never, { sessionId: "test-archived" });
		await addCartItem(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
			{ productId: "prod-1", quantity: 1 },
		);

		// Archive the product
		await productStorage.put("prod-1", {
			id: "prod-1",
			basePrice: 25,
			status: "archived",
			trackInventory: false,
		});

		const result = await recalculateCartWithValidation(
			cartStorage as never,
			cartItemStorage as never,
			productStorage as never,
			variantStorage as never,
			cart.id,
		);

		expect(result.removedItems).toHaveLength(1);
		expect(result.cart.subtotal).toBe(0);
	});
});
