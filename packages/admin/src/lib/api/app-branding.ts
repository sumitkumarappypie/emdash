/**
 * App branding settings API client
 */

import { API_BASE, apiFetch, parseApiResponse } from "./client.js";

export interface AppBranding {
	appName: string;
	appSlug: string;
	iosBundle: string;
	androidPackage: string;
	scheme: string;
	iconUrl: string | null;
	splashUrl: string | null;
	splashBgColor: string;
	accentColor: string;
}

/**
 * Fetch current app branding settings
 */
export async function fetchBranding(): Promise<AppBranding> {
	const response = await apiFetch(`${API_BASE}/admin/app-branding`);
	return parseApiResponse<AppBranding>(response, "Failed to fetch app branding");
}

/**
 * Update app branding settings
 */
export async function updateBranding(data: Partial<AppBranding>): Promise<AppBranding> {
	const response = await apiFetch(`${API_BASE}/admin/app-branding`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	return parseApiResponse<AppBranding>(response, "Failed to update app branding");
}

/**
 * Trigger a mobile app build via GitHub Actions
 */
export async function triggerBuild(
	platform: "android" | "ios" | "both",
): Promise<{ message: string }> {
	const response = await apiFetch(`${API_BASE}/admin/app-build`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ platform }),
	});
	return parseApiResponse<{ message: string }>(response, "Failed to trigger build");
}
