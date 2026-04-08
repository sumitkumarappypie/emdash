import type { AppConfig, Customer } from "./types";

let baseUrl = "";
let authToken: string | null = null;

export function setBaseUrl(url: string): void {
	baseUrl = url.replace(/\/$/, "");
}

export function getBaseUrl(): string {
	return baseUrl;
}

export function setAuthToken(token: string | null): void {
	authToken = token;
}

export function getAuthToken(): string | null {
	return authToken;
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
			(error as { error?: { message?: string } })?.error?.message ||
				`Request failed: ${response.status}`,
			(error as { error?: { code?: string } })?.error?.code || "REQUEST_FAILED",
			response.status,
		);
	}

	const json = await response.json();
	return ((json as { data?: T }).data ?? json) as T;
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
