import type { AppConfig, Cart, Customer, ListResponse, Product } from "./types";

let baseUrl = "";
let authToken: string | null = null;

export function setBaseUrl(url: string): void {
	baseUrl = url.replace(/\/$/, "");
}

export function setAuthToken(token: string | null): void {
	authToken = token;
}

async function request<T>(
	path: string,
	options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
	const { method = "GET", body, auth = true } = options;

	const headers: Record<string, string> = {
		"X-EmDash-Request": "1",
		"X-EmDash-App": "1",
	};

	if (body) {
		headers["Content-Type"] = "application/json";
	}

	if (auth && authToken) {
		headers["Authorization"] = `Bearer ${authToken}`;
	}

	const response = await fetch(`${baseUrl}/_emdash/api${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new ApiError(
			error?.error?.message || `Request failed: ${response.status}`,
			error?.error?.code || "REQUEST_FAILED",
			response.status,
		);
	}

	const json = await response.json();
	return json.data ?? json;
}

export class ApiError extends Error {
	constructor(
		message: string,
		public code: string,
		public status: number,
	) {
		super(message);
		this.name = "ApiError";
	}
}

// Plugin API helper (commerce routes use POST with body)
async function pluginRequest<T>(pluginId: string, route: string, body?: unknown): Promise<T> {
	return request<T>(`/plugins/${pluginId}/${route}`, {
		method: "POST",
		body: body ?? {},
	});
}

// ── App Config ────────────────────────────────────────

export async function fetchAppConfig(): Promise<AppConfig> {
	return request<AppConfig>("/app/config", { auth: false });
}

// ── Customer Auth ─────────────────────────────────────

export async function registerCustomer(input: {
	email: string;
	name: string;
	password: string;
}): Promise<{ customer: Customer; token: string }> {
	return request("/customers/register", { method: "POST", body: input, auth: false });
}

export async function loginCustomer(input: {
	email: string;
	password: string;
}): Promise<{ customer: Customer; token: string }> {
	return request("/customers/login", { method: "POST", body: input, auth: false });
}

export async function validateSession(): Promise<{ customer: Customer }> {
	return request("/customers/session");
}

export async function logoutCustomer(): Promise<void> {
	await request("/customers/logout", { method: "POST" });
}

// ── Public Content ────────────────────────────────────

export async function fetchPublicContent<T = unknown>(
	collection: string,
	params?: { slug?: string; limit?: number; cursor?: string },
): Promise<T> {
	const query = new URLSearchParams();
	if (params?.slug) query.set("slug", params.slug);
	if (params?.limit) query.set("limit", String(params.limit));
	if (params?.cursor) query.set("cursor", params.cursor);
	const qs = query.toString();
	return request<T>(`/public/content/${collection}${qs ? `?${qs}` : ""}`, { auth: false });
}

// ── Commerce: Products ────────────────────────────────

export async function fetchProducts(params?: {
	limit?: number;
	cursor?: string;
}): Promise<ListResponse<Product>> {
	return pluginRequest("commerce", "products/list", {
		status: "active",
		limit: params?.limit ?? 20,
		cursor: params?.cursor,
	});
}

export async function fetchProduct(slug: string): Promise<Product> {
	const result = await pluginRequest<{ product: Product }>("commerce", "products/get", { slug });
	return result.product;
}

// ── Commerce: Cart ────────────────────────────────────

export async function createCart(): Promise<Cart> {
	return pluginRequest("commerce", "cart/create", {});
}

export async function fetchCart(cartId: string): Promise<Cart> {
	return pluginRequest("commerce", "cart/get", { cartId });
}

export async function addToCart(
	cartId: string,
	productId: string,
	quantity: number,
	variantId?: string,
): Promise<Cart> {
	return pluginRequest("commerce", "cart/add-item", {
		cartId,
		productId,
		variantId,
		quantity,
	});
}

export async function updateCartItem(itemId: string, quantity: number): Promise<Cart> {
	return pluginRequest("commerce", "cart/update-item", { itemId, quantity });
}

export async function removeCartItem(itemId: string): Promise<Cart> {
	return pluginRequest("commerce", "cart/remove-item", { itemId });
}

// ── Commerce: Checkout ────────────────────────────────

export async function createCheckout(params: {
	cartId: string;
	email: string;
	name: string;
	notes?: string;
}): Promise<{ order: unknown }> {
	return pluginRequest("commerce", "checkout/create", params);
}

// ── Push Notifications ────────────────────────────────

export async function registerPushDevice(pushToken: string, platform: "ios" | "android"): Promise<void> {
	await request("/push/register", {
		method: "POST",
		body: { pushToken, platform },
	});
}
