// Product types
export type ProductStatus = "draft" | "active" | "archived";
export type ProductType = "physical" | "digital" | "subscription";

export interface Product {
	id: string;
	slug: string;
	status: ProductStatus;
	name: string;
	description: string;
	shortDescription: string;
	productType: ProductType;
	sku: string;
	barcode: string;
	basePrice: number;
	compareAtPrice: number | null;
	currency: string;
	trackInventory: boolean;
	inventoryQuantity: number;
	lowStockThreshold: number;
	weight: number | null;
	weightUnit: string;
	dimensionsLength: number | null;
	dimensionsWidth: number | null;
	dimensionsHeight: number | null;
	dimensionUnit: string;
	taxClass: string;
	isFeatured: boolean;
	sortOrder: number;
	images: MediaReference[];
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export interface MediaReference {
	id: string;
	url: string;
	alt: string;
}

// Variant types
export interface Variant {
	id: string;
	productId: string;
	name: string;
	sku: string;
	barcode: string;
	price: number | null;
	compareAtPrice: number | null;
	inventoryQuantity: number;
	trackInventory: boolean;
	weight: number | null;
	dimensionsLength: number | null;
	dimensionsWidth: number | null;
	dimensionsHeight: number | null;
	optionValues: Record<string, string>;
	sortOrder: number;
	status: ProductStatus;
	createdAt: string;
	updatedAt: string;
}

// Category types
export interface Category {
	id: string;
	slug: string;
	name: string;
	description: string;
	image: MediaReference | null;
	parentId: string | null;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

// Cart types
export interface Cart {
	id: string;
	sessionId: string | null;
	customerId: string | null;
	currency: string;
	subtotal: number;
	discountTotal: number;
	shippingTotal: number;
	taxTotal: number;
	total: number;
	shippingAddress: Address | null;
	billingAddress: Address | null;
	shippingMethodId: string | null;
	couponCodes: string[];
	expiresAt: string;
	createdAt: string;
	updatedAt: string;
}

export interface CartItem {
	id: string;
	cartId: string;
	productId: string;
	variantId: string | null;
	quantity: number;
	unitPrice: number;
	totalPrice: number;
	metadata: Record<string, unknown>;
}

export interface Address {
	name: string;
	line1: string;
	line2: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone: string;
}

// Order types
export type OrderStatus =
	| "pending"
	| "paid"
	| "processing"
	| "shipped"
	| "delivered"
	| "completed"
	| "cancelled"
	| "refunded";
export type PaymentStatus = "unpaid" | "paid" | "partially_refunded" | "refunded";
export type FulfillmentStatus = "unfulfilled" | "partially_fulfilled" | "fulfilled";

export interface Order {
	id: string;
	orderNumber: string;
	customerId: string | null;
	customerEmail: string;
	customerName: string;
	status: OrderStatus;
	paymentStatus: PaymentStatus;
	fulfillmentStatus: FulfillmentStatus;
	subtotal: number;
	discountTotal: number;
	shippingTotal: number;
	taxTotal: number;
	total: number;
	currency: string;
	shippingAddress: Address | null;
	billingAddress: Address | null;
	shippingMethod: string | null;
	trackingNumber: string | null;
	trackingUrl: string | null;
	paymentProvider: string | null;
	paymentIntentId: string | null;
	notes: string;
	customerNotes: string;
	metadata: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

export interface OrderItem {
	id: string;
	orderId: string;
	productId: string;
	variantId: string | null;
	productName: string;
	variantName: string;
	sku: string;
	quantity: number;
	unitPrice: number;
	totalPrice: number;
	fulfillmentStatus: FulfillmentStatus;
	metadata: Record<string, unknown>;
}

// Transaction types
export type TransactionType = "charge" | "refund" | "partial_refund";
export type TransactionStatus = "pending" | "succeeded" | "failed";

export interface Transaction {
	id: string;
	orderId: string;
	type: TransactionType;
	amount: number;
	currency: string;
	provider: string;
	providerTransactionId: string;
	status: TransactionStatus;
	metadata: Record<string, unknown>;
	createdAt: string;
}

// Customer types
export interface Customer {
	id: string;
	userId: string | null;
	email: string;
	name: string;
	phone: string;
	defaultShippingAddress: Address | null;
	defaultBillingAddress: Address | null;
	totalOrders: number;
	totalSpent: number;
	tags: string[];
	acceptsMarketing: boolean;
	createdAt: string;
	updatedAt: string;
}

// Coupon types
export type CouponType = "percentage" | "fixed_amount" | "free_shipping";
export type CouponAppliesTo = "all" | "specific_products" | "specific_categories";
export type CouponStatus = "active" | "inactive";

export interface Coupon {
	id: string;
	code: string;
	description: string;
	type: CouponType;
	value: number;
	currency: string;
	minimumOrderAmount: number | null;
	maximumDiscountAmount: number | null;
	usageLimit: number | null;
	usageCount: number;
	perCustomerLimit: number | null;
	appliesTo: CouponAppliesTo;
	productIds: string[];
	categoryIds: string[];
	startsAt: string | null;
	expiresAt: string | null;
	status: CouponStatus;
	createdAt: string;
	updatedAt: string;
}

// Provider interfaces
export interface ShippingRate {
	id: string;
	name: string;
	description: string;
	price: number;
	currency: string;
	estimatedDays: number | null;
}

export interface ShippingRatesResult {
	rates: ShippingRate[];
}

export interface TaxLineItem {
	itemId: string;
	taxAmount: number;
	taxRate: number;
	taxName: string;
}

export interface TaxResult {
	lineItems: TaxLineItem[];
	totalTax: number;
}

export interface PaymentCreateResult {
	redirectUrl?: string;
	clientSecret?: string;
	providerOrderId: string;
}

export interface PaymentCaptureResult {
	transactionId: string;
	status: TransactionStatus;
}

export interface PaymentRefundResult {
	refundId: string;
	status: TransactionStatus;
}

export interface PaymentWebhookResult {
	event: string;
	orderId: string;
	status: TransactionStatus;
}
