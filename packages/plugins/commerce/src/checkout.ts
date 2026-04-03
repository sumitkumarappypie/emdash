import { CommerceError, getCartItems } from "./cart.js";
import type { Cart, CartItem, Order, OrderItem } from "./types.js";

type StorageCollection<T = unknown> = {
	get(id: string): Promise<T | null>;
	put(id: string, data: T): Promise<void>;
	delete(id: string): Promise<boolean>;
	query(opts?: {
		where?: Record<string, unknown>;
		orderBy?: Record<string, string>;
		limit?: number;
	}): Promise<{ items: Array<{ id: string; data: T }>; hasMore: boolean }>;
};

interface CheckoutStorages {
	carts: StorageCollection<Cart>;
	cartItems: StorageCollection<CartItem>;
	orders: StorageCollection<Order>;
	orderItems: StorageCollection<OrderItem>;
	products: StorageCollection<Record<string, unknown>>;
	variants: StorageCollection<Record<string, unknown>>;
	customers: StorageCollection<Record<string, unknown>>;
	orderCounter: StorageCollection<{ value: number }>;
}

function generateId(): string {
	return crypto.randomUUID();
}

async function nextOrderNumber(
	counterStorage: StorageCollection<{ value: number }>,
): Promise<string> {
	const counter = await counterStorage.get("current");
	const nextValue = (counter?.value ?? 1000) + 1;
	await counterStorage.put("current", { value: nextValue });
	return `ORD-${nextValue}`;
}

export async function createOrderFromCart(
	storages: CheckoutStorages,
	cartId: string,
	input: {
		email: string;
		name: string;
		paymentProvider: string;
		customerNotes?: string;
	},
): Promise<Order> {
	// Validate cart exists
	const cart = await storages.carts.get(cartId);
	if (!cart) {
		throw new CommerceError("CART_NOT_FOUND", "Cart not found");
	}

	// Check expiry
	if (new Date(cart.expiresAt) < new Date()) {
		throw new CommerceError("CART_EXPIRED", "Cart has expired");
	}

	// Get cart items
	const cartItems = await getCartItems(storages.cartItems, cartId);
	if (cartItems.length === 0) {
		throw new CommerceError("CART_EMPTY", "Cart is empty");
	}

	// Re-validate products, check inventory, resolve prices
	const orderItemsData: Array<{
		productId: string;
		variantId: string | null;
		productName: string;
		variantName: string;
		sku: string;
		unitPrice: number;
		quantity: number;
		totalPrice: number;
	}> = [];

	for (const cartItem of cartItems) {
		const product = await storages.products.get(cartItem.productId);
		if (!product) {
			throw new CommerceError(
				"PRODUCT_NOT_FOUND",
				`Product ${cartItem.productId} no longer exists`,
			);
		}
		if (product.status !== "active") {
			throw new CommerceError(
				"PRODUCT_UNAVAILABLE",
				`Product ${product.name} is no longer available`,
			);
		}

		let unitPrice = product.basePrice as number;
		let variantName = "";

		if (cartItem.variantId) {
			const variant = await storages.variants.get(cartItem.variantId);
			if (!variant) {
				throw new CommerceError("VARIANT_NOT_FOUND", `Variant ${cartItem.variantId} not found`);
			}
			if (variant.price !== null && variant.price !== undefined) {
				unitPrice = variant.price as number;
			}
			variantName = (variant.name as string) ?? "";
		}

		// Check inventory
		if (product.trackInventory) {
			const available = (product.inventoryQuantity as number) ?? 0;
			if (available < cartItem.quantity) {
				throw new CommerceError(
					"INSUFFICIENT_STOCK",
					`Only ${available} of ${product.name} available`,
				);
			}
		}

		orderItemsData.push({
			productId: cartItem.productId,
			variantId: cartItem.variantId,
			productName: product.name as string,
			variantName,
			sku: (product.sku as string) ?? "",
			unitPrice,
			quantity: cartItem.quantity,
			totalPrice: Math.round(unitPrice * cartItem.quantity * 100) / 100,
		});
	}

	// Decrement inventory
	for (const item of orderItemsData) {
		const product = await storages.products.get(item.productId);
		if (product && product.trackInventory) {
			const current = (product.inventoryQuantity as number) ?? 0;
			await storages.products.put(item.productId, {
				...product,
				inventoryQuantity: current - item.quantity,
			});
		}
	}

	// Generate order number
	const orderNumber = await nextOrderNumber(storages.orderCounter);

	// Calculate totals
	const subtotal =
		Math.round(orderItemsData.reduce((sum, item) => sum + item.totalPrice, 0) * 100) / 100;
	const total =
		Math.round((subtotal - cart.discountTotal + cart.shippingTotal + cart.taxTotal) * 100) / 100;

	const now = new Date().toISOString();
	const orderId = generateId();

	// Create order
	const order: Order = {
		id: orderId,
		orderNumber,
		customerId: cart.customerId,
		customerEmail: input.email,
		customerName: input.name,
		status: "pending",
		paymentStatus: "unpaid",
		fulfillmentStatus: "unfulfilled",
		subtotal,
		discountTotal: cart.discountTotal,
		shippingTotal: cart.shippingTotal,
		taxTotal: cart.taxTotal,
		total: Math.max(0, total),
		currency: cart.currency,
		shippingAddress: cart.shippingAddress,
		billingAddress: cart.billingAddress,
		shippingMethod: cart.shippingMethodId,
		trackingNumber: null,
		trackingUrl: null,
		paymentProvider: input.paymentProvider,
		paymentIntentId: null,
		notes: "",
		customerNotes: input.customerNotes ?? "",
		metadata: {},
		createdAt: now,
		updatedAt: now,
	};

	await storages.orders.put(orderId, order);

	// Create order items
	for (const itemData of orderItemsData) {
		const orderItemId = generateId();
		const orderItem: OrderItem = {
			id: orderItemId,
			orderId,
			productId: itemData.productId,
			variantId: itemData.variantId,
			productName: itemData.productName,
			variantName: itemData.variantName,
			sku: itemData.sku,
			quantity: itemData.quantity,
			unitPrice: itemData.unitPrice,
			totalPrice: itemData.totalPrice,
			fulfillmentStatus: "unfulfilled",
			metadata: {},
		};
		await storages.orderItems.put(orderItemId, orderItem);
	}

	// Delete cart items
	for (const cartItem of cartItems) {
		await storages.cartItems.delete(cartItem.id);
	}

	// Delete cart
	await storages.carts.delete(cartId);

	return order;
}
