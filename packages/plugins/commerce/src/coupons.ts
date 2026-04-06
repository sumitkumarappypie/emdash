import type { StorageCollection } from "./storage-types.js";
import type { Coupon, Cart, CartItem } from "./types.js";
import { createCouponSchema, updateCouponSchema } from "./validation.js";

function generateId(): string {
	return crypto.randomUUID();
}

export async function createCoupon(
	storage: StorageCollection,
	input: Record<string, unknown>,
): Promise<Coupon> {
	const validated = createCouponSchema.parse(input);
	const now = new Date().toISOString();
	const id = generateId();

	const coupon: Coupon = {
		id,
		code: validated.code,
		description: validated.description,
		type: validated.type,
		value: validated.value,
		currency: validated.currency,
		minimumOrderAmount: validated.minimumOrderAmount,
		maximumDiscountAmount: validated.maximumDiscountAmount,
		usageLimit: validated.usageLimit,
		usageCount: 0,
		perCustomerLimit: validated.perCustomerLimit,
		appliesTo: validated.appliesTo,
		productIds: validated.productIds,
		categoryIds: validated.categoryIds,
		startsAt: validated.startsAt,
		expiresAt: validated.expiresAt,
		status: "active",
		createdAt: now,
		updatedAt: now,
	};

	await storage.put(id, coupon);
	return coupon;
}

export async function getCoupon(storage: StorageCollection, id: string): Promise<Coupon | null> {
	return storage.get(id);
}

export async function getCouponByCode(
	storage: StorageCollection,
	code: string,
): Promise<Coupon | null> {
	const result = await storage.query({ where: { code }, limit: 1 });
	return result.items[0]?.data ?? null;
}

export async function listCoupons(
	storage: StorageCollection,
	opts: {
		status?: string;
		limit?: number;
		cursor?: string;
	},
): Promise<{ items: Coupon[]; hasMore: boolean; cursor?: string }> {
	const where: Record<string, unknown> = {};
	if (opts.status) where.status = opts.status;

	const result = await storage.query({
		where: Object.keys(where).length > 0 ? where : undefined,
		limit: Math.min(opts.limit ?? 50, 100),
		cursor: opts.cursor,
	});

	return {
		items: result.items.map((item) => item.data),
		hasMore: result.hasMore,
		cursor: result.cursor,
	};
}

export async function updateCoupon(
	storage: StorageCollection,
	id: string,
	input: Record<string, unknown>,
): Promise<Coupon | null> {
	const existing = await storage.get(id);
	if (!existing) return null;

	const validated = updateCouponSchema.parse(input);
	const updated: Coupon = {
		...existing,
		...validated,
		id,
		updatedAt: new Date().toISOString(),
	};

	await storage.put(id, updated);
	return updated;
}

export async function incrementUsage(
	storage: StorageCollection,
	id: string,
): Promise<Coupon | null> {
	const existing = await storage.get(id);
	if (!existing) return null;

	const updated: Coupon = {
		...existing,
		usageCount: existing.usageCount + 1,
		updatedAt: new Date().toISOString(),
	};

	await storage.put(id, updated);
	return updated;
}

export function validateCoupon(
	coupon: Coupon,
	cart: Cart,
	cartItems: CartItem[],
	customerUsageCount?: number,
): string | null {
	if (coupon.status !== "active") return "INVALID_COUPON";

	const now = new Date();
	if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return "COUPON_EXPIRED";
	if (coupon.startsAt && new Date(coupon.startsAt) > now) return "INVALID_COUPON";
	if (coupon.usageLimit !== null && coupon.usageCount >= coupon.usageLimit)
		return "COUPON_LIMIT_REACHED";

	// Per-customer limit check
	if (
		coupon.perCustomerLimit !== null &&
		customerUsageCount !== undefined &&
		customerUsageCount >= coupon.perCustomerLimit
	) {
		return "COUPON_LIMIT_REACHED";
	}

	if (coupon.minimumOrderAmount !== null && cart.subtotal < coupon.minimumOrderAmount)
		return "MINIMUM_NOT_MET";

	if (coupon.appliesTo === "specific_products") {
		const hasMatch = cartItems.some((item) => coupon.productIds.includes(item.productId));
		if (!hasMatch) return "INVALID_COUPON";
	}

	return null;
}

export function calculateDiscount(
	coupon: Coupon,
	cart: Cart,
	cartItems: CartItem[],
	productCategoryMap: Array<{ productId: string; categoryIds: string[] }>,
): number {
	let applicableTotal = cart.subtotal;

	if (coupon.appliesTo === "specific_products") {
		applicableTotal = cartItems
			.filter((item) => coupon.productIds.includes(item.productId))
			.reduce((sum, item) => sum + item.totalPrice, 0);
	} else if (coupon.appliesTo === "specific_categories") {
		applicableTotal = cartItems
			.filter((item) => {
				const cats = productCategoryMap.find((m) => m.productId === item.productId);
				return cats?.categoryIds.some((cid) => coupon.categoryIds.includes(cid));
			})
			.reduce((sum, item) => sum + item.totalPrice, 0);
	}

	let discount = 0;
	switch (coupon.type) {
		case "percentage":
			discount = Math.round(applicableTotal * (coupon.value / 100) * 100) / 100;
			break;
		case "fixed_amount":
			discount = Math.min(coupon.value, applicableTotal);
			break;
		case "free_shipping":
			discount = cart.shippingTotal;
			break;
	}

	if (coupon.maximumDiscountAmount !== null) {
		discount = Math.min(discount, coupon.maximumDiscountAmount);
	}

	return Math.round(discount * 100) / 100;
}
