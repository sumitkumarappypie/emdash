/**
 * Commerce Plugin Mobile API Client
 *
 * Self-contained API client for the commerce plugin's mobile screens.
 * The shell provides baseUrl and authToken via context — this module
 * handles all commerce-specific API calls.
 */

import type { Product, Cart, CartItem } from "./types";

export interface CommerceApiConfig {
	baseUrl: string;
	getAuthToken: () => string | null;
}

let config: CommerceApiConfig = {
	baseUrl: "",
	getAuthToken: () => null,
};

export function configureCommerceApi(cfg: CommerceApiConfig): void {
	config = cfg;
}

async function pluginRequest<T>(route: string, body?: unknown): Promise<T> {
	const headers: Record<string, string> = {
		"X-EmDash-Request": "1",
		"X-EmDash-App": "1",
		"Content-Type": "application/json",
	};

	// Don't send customer auth token as Authorization header —
	// plugin routes use admin auth, not customer tokens.
	// Customer identity is passed in the request body where needed
	// (e.g., customerToken in cart operations).

	const response = await fetch(`${config.baseUrl}/_emdash/api/plugins/commerce/${route}`, {
		method: "POST",
		headers,
		body: JSON.stringify(body ?? {}),
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(
			(error as { error?: { message?: string } })?.error?.message ||
				`Request failed: ${response.status}`,
		);
	}

	const json = await response.json();
	return ((json as { data?: T }).data ?? json) as T;
}

// ── Products ──────────────────────────────────────────

export async function fetchProducts(params?: {
	limit?: number;
	cursor?: string;
}): Promise<{ items: Product[]; hasMore: boolean }> {
	return pluginRequest("products/list", {
		status: "active",
		limit: params?.limit ?? 20,
		cursor: params?.cursor,
	});
}

export async function fetchProduct(slug: string): Promise<Product> {
	return pluginRequest("products/get", { slug });
}

// ── Cart ──────────────────────────────────────────────

export async function createCart(): Promise<Cart> {
	return pluginRequest("cart/create", {});
}

export async function fetchCart(cartId: string): Promise<Cart> {
	return pluginRequest("cart/get", { cartId });
}

export async function addToCart(
	cartId: string,
	productId: string,
	quantity: number,
	variantId?: string,
): Promise<Cart> {
	return pluginRequest("cart/add-item", {
		cartId,
		productId,
		variantId,
		quantity,
	});
}

export async function updateCartItem(itemId: string, quantity: number): Promise<Cart> {
	return pluginRequest("cart/update-item", { itemId, quantity });
}

export async function removeCartItem(itemId: string): Promise<Cart> {
	return pluginRequest("cart/remove-item", { itemId });
}

// ── Checkout ──────────────────────────────────────────

export async function createCheckout(params: {
	cartId: string;
	email: string;
	shippingAddress: Record<string, string>;
}): Promise<{ orderId: string }> {
	return pluginRequest("checkout/create", params);
}
