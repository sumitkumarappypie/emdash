import { describe, it, expect, beforeEach } from "vitest";

import {
	createCoupon,
	getCoupon,
	getCouponByCode,
	listCoupons,
	updateCoupon,
	incrementUsage,
	validateCoupon,
	calculateDiscount,
} from "../../../../../plugins/commerce/src/coupons.js";
import type { Coupon, Cart, CartItem } from "../../../../../plugins/commerce/src/types.js";

// Mock storage collection
function createMockStorage() {
	const store = new Map<string, unknown>();
	return {
		get: async (id: string) => store.get(id) ?? null,
		put: async (id: string, data: unknown) => {
			store.set(id, data);
		},
		delete: async (id: string) => store.delete(id),
		exists: async (id: string) => store.has(id),
		query: async (opts?: {
			where?: Record<string, unknown>;
			orderBy?: Record<string, string>;
			limit?: number;
			cursor?: string;
		}) => {
			let items = Array.from(store.entries(), ([id, data]) => ({ id, data }));
			if (opts?.where) {
				for (const [key, value] of Object.entries(opts.where)) {
					items = items.filter((item) => (item.data as Record<string, unknown>)[key] === value);
				}
			}
			if (opts?.orderBy) {
				const [field, dir] = Object.entries(opts.orderBy)[0]!;
				items.sort((a, b) => {
					const av = (a.data as Record<string, unknown>)[field] as string;
					const bv = (b.data as Record<string, unknown>)[field] as string;
					return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
				});
			}
			const limit = opts?.limit ?? 50;
			return { items: items.slice(0, limit), hasMore: items.length > limit };
		},
		count: async (where?: Record<string, unknown>) => {
			if (!where) return store.size;
			let count = 0;
			for (const data of store.values()) {
				let match = true;
				for (const [key, value] of Object.entries(where)) {
					if ((data as Record<string, unknown>)[key] !== value) {
						match = false;
						break;
					}
				}
				if (match) count++;
			}
			return count;
		},
	};
}

// Helper functions for validation/discount tests
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
		sessionId: null,
		customerId: null,
		currency: "USD",
		subtotal: 100,
		discountTotal: 0,
		shippingTotal: 10,
		taxTotal: 0,
		total: 110,
		shippingAddress: null,
		billingAddress: null,
		shippingMethodId: null,
		couponCodes: [],
		expiresAt: new Date(Date.now() + 86400000).toISOString(),
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

describe("Coupon CRUD", () => {
	let storage: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		storage = createMockStorage();
	});

	it("creates a coupon and returns it with generated id", async () => {
		const coupon = await createCoupon(storage, {
			code: "SAVE10",
			type: "percentage",
			value: 10,
		});

		expect(coupon.id).toBeDefined();
		expect(coupon.code).toBe("SAVE10");
		expect(coupon.type).toBe("percentage");
		expect(coupon.value).toBe(10);
		expect(coupon.usageCount).toBe(0);
		expect(coupon.status).toBe("active");
	});

	it("gets coupon by id", async () => {
		const created = await createCoupon(storage, {
			code: "GETBYID",
			type: "percentage",
			value: 5,
		});

		const found = await getCoupon(storage, created.id);
		expect(found).toEqual(created);
	});

	it("gets coupon by code", async () => {
		const created = await createCoupon(storage, {
			code: "FIND123",
			type: "fixed_amount",
			value: 5,
		});

		const found = await getCouponByCode(storage, "FIND123");
		expect(found).toEqual(created);
	});

	it("lists coupons filtered by status", async () => {
		await createCoupon(storage, { code: "ACTIVE1", type: "percentage", value: 10 });
		const inactive = await createCoupon(storage, { code: "INACT1", type: "percentage", value: 5 });
		await updateCoupon(storage, inactive.id, { status: "inactive" });

		const result = await listCoupons(storage, { status: "active" });
		expect(result.items).toHaveLength(1);
		expect(result.items[0]!.code).toBe("ACTIVE1");
	});

	it("updates a coupon", async () => {
		const created = await createCoupon(storage, {
			code: "UPDATEME",
			type: "percentage",
			value: 10,
		});

		const updated = await updateCoupon(storage, created.id, { value: 20, description: "Updated" });
		expect(updated!.value).toBe(20);
		expect(updated!.description).toBe("Updated");
		expect(updated!.code).toBe("UPDATEME");
	});

	it("increments usage count", async () => {
		const created = await createCoupon(storage, {
			code: "USEONCE",
			type: "percentage",
			value: 10,
		});
		expect(created.usageCount).toBe(0);

		const updated = await incrementUsage(storage, created.id);
		expect(updated!.usageCount).toBe(1);

		const updated2 = await incrementUsage(storage, created.id);
		expect(updated2!.usageCount).toBe(2);
	});
});

describe("Coupon Validation", () => {
	it("validates active coupon (returns null = valid)", () => {
		const coupon = makeCoupon();
		const cart = makeCart();
		const items = [makeCartItem()];

		const result = validateCoupon(coupon, cart, items);
		expect(result).toBeNull();
	});

	it("rejects expired coupon", () => {
		const coupon = makeCoupon({
			expiresAt: new Date(Date.now() - 86400000).toISOString(),
		});
		const cart = makeCart();
		const items = [makeCartItem()];

		const result = validateCoupon(coupon, cart, items);
		expect(result).toBe("COUPON_EXPIRED");
	});

	it("rejects coupon below minimum order amount", () => {
		const coupon = makeCoupon({ minimumOrderAmount: 200 });
		const cart = makeCart({ subtotal: 100 });
		const items = [makeCartItem()];

		const result = validateCoupon(coupon, cart, items);
		expect(result).toBe("MINIMUM_NOT_MET");
	});

	it("rejects coupon over usage limit", () => {
		const coupon = makeCoupon({ usageLimit: 10, usageCount: 10 });
		const cart = makeCart();
		const items = [makeCartItem()];

		const result = validateCoupon(coupon, cart, items);
		expect(result).toBe("COUPON_LIMIT_REACHED");
	});

	it("rejects coupon when customer hits per-customer limit", () => {
		const coupon = makeCoupon({ perCustomerLimit: 2 });
		const cart = makeCart();
		const items = [makeCartItem()];

		const result = validateCoupon(coupon, cart, items, 2);
		expect(result).toBe("COUPON_LIMIT_REACHED");
	});
});

describe("Discount Calculation", () => {
	it("applies percentage discount correctly (10% of $100 = $10)", () => {
		const coupon = makeCoupon({ type: "percentage", value: 10 });
		const cart = makeCart({ subtotal: 100 });
		const items = [makeCartItem({ totalPrice: 100 })];

		const discount = calculateDiscount(coupon, cart, items, []);
		expect(discount).toBe(10);
	});

	it("caps discount at maximumDiscountAmount (50% of $100 capped at $20)", () => {
		const coupon = makeCoupon({ type: "percentage", value: 50, maximumDiscountAmount: 20 });
		const cart = makeCart({ subtotal: 100 });
		const items = [makeCartItem({ totalPrice: 100 })];

		const discount = calculateDiscount(coupon, cart, items, []);
		expect(discount).toBe(20);
	});

	it("applies fixed_amount discount", () => {
		const coupon = makeCoupon({ type: "fixed_amount", value: 15 });
		const cart = makeCart({ subtotal: 100 });
		const items = [makeCartItem({ totalPrice: 100 })];

		const discount = calculateDiscount(coupon, cart, items, []);
		expect(discount).toBe(15);
	});

	it("free_shipping discount equals cart.shippingTotal", () => {
		const coupon = makeCoupon({ type: "free_shipping", value: 0 });
		const cart = makeCart({ shippingTotal: 10 });
		const items = [makeCartItem()];

		const discount = calculateDiscount(coupon, cart, items, []);
		expect(discount).toBe(10);
	});
});
