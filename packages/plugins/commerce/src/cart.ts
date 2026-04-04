import type { Cart, CartItem } from "./types.js";

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

function generateId(): string {
	return crypto.randomUUID();
}

export class CommerceError extends Error {
	constructor(
		public code: string,
		message: string,
	) {
		super(message);
		this.name = "CommerceError";
	}
}

export async function createCart(
	cartStorage: StorageCollection<Cart>,
	opts: { sessionId?: string; customerId?: string },
): Promise<Cart> {
	const now = new Date();
	const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
	const id = generateId();

	const cart: Cart = {
		id,
		sessionId: opts.sessionId ?? null,
		customerId: opts.customerId ?? null,
		currency: "USD",
		subtotal: 0,
		discountTotal: 0,
		shippingTotal: 0,
		taxTotal: 0,
		total: 0,
		shippingAddress: null,
		billingAddress: null,
		shippingMethodId: null,
		couponCodes: [],
		expiresAt: expiresAt.toISOString(),
		createdAt: now.toISOString(),
		updatedAt: now.toISOString(),
	};

	await cartStorage.put(id, cart);
	return cart;
}

export async function getCart(
	cartStorage: StorageCollection<Cart>,
	id: string,
): Promise<Cart | null> {
	const cart = await cartStorage.get(id);
	if (!cart) return null;
	if (new Date(cart.expiresAt) < new Date()) {
		return null;
	}
	return cart;
}

export async function addCartItem(
	cartStorage: StorageCollection<Cart>,
	cartItemStorage: StorageCollection<CartItem>,
	productStorage: StorageCollection<Record<string, unknown>>,
	variantStorage: StorageCollection<Record<string, unknown>>,
	cartId: string,
	input: {
		productId: string;
		variantId?: string | null;
		quantity: number;
		metadata?: Record<string, unknown>;
	},
): Promise<CartItem> {
	const cart = await cartStorage.get(cartId);
	if (!cart) throw new CommerceError("CART_NOT_FOUND", "Cart not found");

	const product = await productStorage.get(input.productId);
	if (!product) throw new CommerceError("PRODUCT_NOT_FOUND", "Product not found");
	if (product.status !== "active")
		throw new CommerceError("PRODUCT_UNAVAILABLE", "Product is not available");

	let unitPrice = product.basePrice as number;

	if (input.variantId) {
		const variant = await variantStorage.get(input.variantId);
		if (!variant) throw new CommerceError("VARIANT_NOT_FOUND", "Variant not found");
		if (variant.price !== null && variant.price !== undefined) {
			unitPrice = variant.price as number;
		}
	}

	// Check inventory
	if (product.trackInventory) {
		const available = (product.inventoryQuantity as number) ?? 0;
		if (available < input.quantity) {
			throw new CommerceError("INSUFFICIENT_STOCK", `Only ${available} available`);
		}
	}

	// Check if item already exists in cart (same product + variant)
	const existingItems = await cartItemStorage.query({
		where: { cartId },
		limit: 1000,
	});

	const existing = existingItems.items.find(
		(item) =>
			item.data.productId === input.productId && item.data.variantId === (input.variantId ?? null),
	);

	if (existing) {
		const newQuantity = existing.data.quantity + input.quantity;
		const updated: CartItem = {
			...existing.data,
			quantity: newQuantity,
			totalPrice: Math.round(unitPrice * newQuantity * 100) / 100,
			unitPrice,
		};
		await cartItemStorage.put(existing.id, updated);
		return updated;
	}

	const id = generateId();
	const item: CartItem = {
		id,
		cartId,
		productId: input.productId,
		variantId: input.variantId ?? null,
		quantity: input.quantity,
		unitPrice,
		totalPrice: Math.round(unitPrice * input.quantity * 100) / 100,
		metadata: input.metadata ?? {},
	};

	await cartItemStorage.put(id, item);
	return item;
}

export async function updateCartItemQuantity(
	cartItemStorage: StorageCollection<CartItem>,
	itemId: string,
	quantity: number,
): Promise<CartItem | null> {
	const item = await cartItemStorage.get(itemId);
	if (!item) return null;

	const updated: CartItem = {
		...item,
		quantity,
		totalPrice: Math.round(item.unitPrice * quantity * 100) / 100,
	};

	await cartItemStorage.put(itemId, updated);
	return updated;
}

export async function removeCartItem(
	cartItemStorage: StorageCollection<CartItem>,
	itemId: string,
): Promise<boolean> {
	return cartItemStorage.delete(itemId);
}

export async function getCartItems(
	cartItemStorage: StorageCollection<CartItem>,
	cartId: string,
): Promise<CartItem[]> {
	const result = await cartItemStorage.query({ where: { cartId }, limit: 1000 });
	return result.items.map((item) => item.data);
}

export async function mergeCarts(
	cartStorage: StorageCollection<Cart>,
	cartItemStorage: StorageCollection<CartItem>,
	sourceCartId: string,
	targetCartId: string,
): Promise<Cart> {
	const sourceCart = await cartStorage.get(sourceCartId);
	const targetCart = await cartStorage.get(targetCartId);
	if (!sourceCart) throw new CommerceError("CART_NOT_FOUND", "Source cart not found");
	if (!targetCart) throw new CommerceError("CART_NOT_FOUND", "Target cart not found");

	const sourceItems = await getCartItems(cartItemStorage, sourceCartId);
	const targetItems = await getCartItems(cartItemStorage, targetCartId);

	for (const sourceItem of sourceItems) {
		const matchKey = `${sourceItem.productId}:${sourceItem.variantId ?? ""}`;
		const existing = targetItems.find((t) => `${t.productId}:${t.variantId ?? ""}` === matchKey);

		if (existing) {
			// Larger quantity wins
			if (sourceItem.quantity > existing.quantity) {
				await cartItemStorage.put(existing.id, {
					...existing,
					quantity: sourceItem.quantity,
					totalPrice: Math.round(existing.unitPrice * sourceItem.quantity * 100) / 100,
				});
			}
		} else {
			// New item — copy to target cart
			const newId = generateId();
			await cartItemStorage.put(newId, {
				...sourceItem,
				id: newId,
				cartId: targetCartId,
			});
		}

		// Delete source item
		await cartItemStorage.delete(sourceItem.id);
	}

	// Delete source cart
	await cartStorage.delete(sourceCartId);

	return targetCart;
}

export async function recalculateCart(
	cartStorage: StorageCollection<Cart>,
	cartItemStorage: StorageCollection<CartItem>,
	cartId: string,
): Promise<Cart | null> {
	const cart = await cartStorage.get(cartId);
	if (!cart) return null;

	const items = await getCartItems(cartItemStorage, cartId);

	const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
	const total =
		Math.round((subtotal - cart.discountTotal + cart.shippingTotal + cart.taxTotal) * 100) / 100;

	const updated: Cart = {
		...cart,
		subtotal: Math.round(subtotal * 100) / 100,
		total: Math.max(0, total),
		updatedAt: new Date().toISOString(),
	};

	await cartStorage.put(cartId, updated);
	return updated;
}

export async function recalculateCartWithValidation(
	cartStorage: StorageCollection<Cart>,
	cartItemStorage: StorageCollection<CartItem>,
	productStorage: StorageCollection<Record<string, unknown>>,
	variantStorage: StorageCollection<Record<string, unknown>>,
	cartId: string,
): Promise<{ cart: Cart; removedItems: CartItem[] }> {
	const cart = await cartStorage.get(cartId);
	if (!cart) throw new CommerceError("CART_NOT_FOUND", "Cart not found");

	const items = await getCartItems(cartItemStorage, cartId);
	const removedItems: CartItem[] = [];

	for (const item of items) {
		const product = await productStorage.get(item.productId);
		const isUnavailable = !product || (product.status as string) !== "active";

		let variantUnavailable = false;
		if (item.variantId) {
			const variant = await variantStorage.get(item.variantId);
			if (!variant || (variant.status as string) === "archived") {
				variantUnavailable = true;
			}
		}

		if (isUnavailable || variantUnavailable) {
			removedItems.push(item);
			await cartItemStorage.delete(item.id);
		} else {
			// Re-validate price from current product data
			const currentPrice = (product!.basePrice as number) ?? item.unitPrice;
			if (currentPrice !== item.unitPrice) {
				await cartItemStorage.put(item.id, {
					...item,
					unitPrice: currentPrice,
					totalPrice: Math.round(currentPrice * item.quantity * 100) / 100,
				});
			}
		}
	}

	const updatedCart = await recalculateCart(cartStorage, cartItemStorage, cartId);
	return { cart: updatedCart!, removedItems };
}
