import { z } from "zod";

// Shared schemas
const addressSchema = z.object({
	name: z.string().min(1).max(200),
	line1: z.string().min(1).max(500),
	line2: z.string().max(500).default(""),
	city: z.string().min(1).max(200),
	state: z.string().max(200).default(""),
	postalCode: z.string().max(20).default(""),
	country: z.string().min(2).max(2),
	phone: z.string().max(30).default(""),
});

const slugSchema = z
	.string()
	.min(1)
	.max(200)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const priceSchema = z.number().nonnegative().multipleOf(0.01);
const quantitySchema = z.number().int().positive().max(9999);

// Product schemas
export const createProductSchema = z.object({
	name: z.string().min(1).max(500),
	slug: slugSchema,
	status: z.enum(["draft", "active", "archived"]).default("draft"),
	description: z.string().default(""),
	shortDescription: z.string().max(500).default(""),
	productType: z.enum(["physical", "digital", "subscription"]).default("physical"),
	sku: z.string().max(100).default(""),
	barcode: z.string().max(100).default(""),
	basePrice: priceSchema,
	compareAtPrice: priceSchema.nullable().default(null),
	currency: z.string().min(3).max(3).default("USD"),
	trackInventory: z.boolean().default(false),
	inventoryQuantity: z.number().int().nonnegative().default(0),
	lowStockThreshold: z.number().int().nonnegative().default(5),
	weight: z.number().nonnegative().nullable().default(null),
	weightUnit: z.string().max(10).default("kg"),
	dimensionsLength: z.number().nonnegative().nullable().default(null),
	dimensionsWidth: z.number().nonnegative().nullable().default(null),
	dimensionsHeight: z.number().nonnegative().nullable().default(null),
	dimensionUnit: z.string().max(10).default("cm"),
	taxClass: z.string().max(100).default("standard"),
	isFeatured: z.boolean().default(false),
	sortOrder: z.number().int().default(0),
	images: z
		.array(
			z.object({
				id: z.string(),
				url: z.string().url(),
				alt: z.string().default(""),
			}),
		)
		.default([]),
	metadata: z.record(z.unknown()).default({}),
});

export const updateProductSchema = createProductSchema.partial();

// Variant schemas
export const createVariantSchema = z.object({
	name: z.string().min(1).max(500),
	sku: z.string().max(100).default(""),
	barcode: z.string().max(100).default(""),
	price: priceSchema.nullable().default(null),
	compareAtPrice: priceSchema.nullable().default(null),
	inventoryQuantity: z.number().int().nonnegative().default(0),
	trackInventory: z.boolean().default(false),
	weight: z.number().nonnegative().nullable().default(null),
	dimensionsLength: z.number().nonnegative().nullable().default(null),
	dimensionsWidth: z.number().nonnegative().nullable().default(null),
	dimensionsHeight: z.number().nonnegative().nullable().default(null),
	optionValues: z.record(z.string()).default({}),
	sortOrder: z.number().int().default(0),
	status: z.enum(["draft", "active", "archived"]).default("active"),
});

export const updateVariantSchema = createVariantSchema.partial();

// Category schemas
export const createCategorySchema = z.object({
	name: z.string().min(1).max(500),
	slug: slugSchema,
	description: z.string().default(""),
	image: z
		.object({
			id: z.string(),
			url: z.string().url(),
			alt: z.string().default(""),
		})
		.nullable()
		.default(null),
	parentId: z.string().nullable().default(null),
	sortOrder: z.number().int().default(0),
});

export const updateCategorySchema = createCategorySchema.partial();

// Cart schemas
export const addCartItemSchema = z.object({
	productId: z.string().min(1),
	variantId: z.string().nullable().default(null),
	quantity: quantitySchema,
	metadata: z.record(z.unknown()).default({}),
});

export const updateCartItemSchema = z.object({
	quantity: quantitySchema,
});

export const applyCouponSchema = z.object({
	code: z
		.string()
		.min(4)
		.max(32)
		.regex(/^[A-Z0-9-]+$/),
});

export const setShippingAddressSchema = z.object({
	address: addressSchema,
});

export const setShippingMethodSchema = z.object({
	shippingMethodId: z.string().min(1),
});

// Checkout schemas
export const checkoutSchema = z.object({
	email: z.string().email(),
	name: z.string().min(1).max(200),
	shippingAddress: addressSchema.optional(),
	billingAddress: addressSchema.optional(),
	paymentProvider: z.string().min(1),
	customerNotes: z.string().max(2000).default(""),
});

// Customer schemas
export const createCustomerSchema = z.object({
	email: z.string().email(),
	name: z.string().min(1).max(200),
	phone: z.string().max(30).default(""),
	defaultShippingAddress: addressSchema.nullable().default(null),
	defaultBillingAddress: addressSchema.nullable().default(null),
	tags: z.array(z.string()).default([]),
	acceptsMarketing: z.boolean().default(false),
});

export const updateCustomerSchema = createCustomerSchema.partial();

// Coupon schemas
export const createCouponSchema = z.object({
	code: z
		.string()
		.min(4)
		.max(32)
		.regex(/^[A-Z0-9-]+$/),
	description: z.string().max(500).default(""),
	type: z.enum(["percentage", "fixed_amount", "free_shipping"]),
	value: z.number().positive(),
	currency: z.string().min(3).max(3).default("USD"),
	minimumOrderAmount: priceSchema.nullable().default(null),
	maximumDiscountAmount: priceSchema.nullable().default(null),
	usageLimit: z.number().int().positive().nullable().default(null),
	perCustomerLimit: z.number().int().positive().nullable().default(null),
	appliesTo: z.enum(["all", "specific_products", "specific_categories"]).default("all"),
	productIds: z.array(z.string()).default([]),
	categoryIds: z.array(z.string()).default([]),
	startsAt: z.string().datetime().nullable().default(null),
	expiresAt: z.string().datetime().nullable().default(null),
});

export const updateCouponSchema = createCouponSchema.partial();

// Order admin schemas
export const updateOrderStatusSchema = z.object({
	status: z.enum([
		"pending",
		"paid",
		"processing",
		"shipped",
		"delivered",
		"completed",
		"cancelled",
		"refunded",
	]),
});

export const fulfillOrderSchema = z.object({
	trackingNumber: z.string().max(200).optional(),
	trackingUrl: z.string().url().optional(),
	itemIds: z.array(z.string()).optional(),
});

export const refundOrderSchema = z.object({
	amount: priceSchema.optional(),
	reason: z.string().max(500).default(""),
});

export const addOrderNoteSchema = z.object({
	note: z.string().min(1).max(2000),
});

// Query schemas
export const paginationSchema = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const productQuerySchema = paginationSchema.extend({
	status: z.enum(["draft", "active", "archived"]).optional(),
	productType: z.enum(["physical", "digital", "subscription"]).optional(),
	category: z.string().optional(),
	featured: z.coerce.boolean().optional(),
	search: z.string().optional(),
});

export const orderQuerySchema = paginationSchema.extend({
	status: z
		.enum([
			"pending",
			"paid",
			"processing",
			"shipped",
			"delivered",
			"completed",
			"cancelled",
			"refunded",
		])
		.optional(),
	paymentStatus: z.enum(["unpaid", "paid", "partially_refunded", "refunded"]).optional(),
	fulfillmentStatus: z.enum(["unfulfilled", "partially_fulfilled", "fulfilled"]).optional(),
	customerId: z.string().optional(),
	search: z.string().optional(),
});

export const customerQuerySchema = paginationSchema.extend({
	search: z.string().optional(),
});

export const couponQuerySchema = paginationSchema.extend({
	status: z.enum(["draft", "active", "archived"]).optional(),
});
