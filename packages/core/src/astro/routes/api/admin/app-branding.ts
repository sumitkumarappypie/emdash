/**
 * App Branding API endpoint
 *
 * GET  /_emdash/api/admin/app-branding - Get app branding settings
 * PUT  /_emdash/api/admin/app-branding - Update app branding settings
 */

export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";

import { requirePerm } from "#api/authorize.js";
import { apiError, handleError, unwrapResult } from "#api/error.js";
import { handleGetBranding, handleUpdateBranding } from "#api/handlers/app-branding.js";
import { isParseError, parseBody } from "#api/parse.js";

const updateBrandingSchema = z.object({
	appName: z.string().min(1).max(100).optional(),
	appSlug: z
		.string()
		.regex(/^[a-z0-9-]+$/)
		.max(100)
		.optional(),
	iosBundle: z
		.string()
		.regex(/^[a-zA-Z][a-zA-Z0-9.]*$/)
		.max(200)
		.optional(),
	androidPackage: z
		.string()
		.regex(/^[a-zA-Z][a-zA-Z0-9.]*$/)
		.max(200)
		.optional(),
	scheme: z
		.string()
		.regex(/^[a-z][a-z0-9-]*$/)
		.max(50)
		.optional(),
	splashBgColor: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/)
		.optional(),
	accentColor: z
		.string()
		.regex(/^#[0-9A-Fa-f]{6}$/)
		.optional(),
});

/**
 * GET /_emdash/api/admin/app-branding
 *
 * Returns the current app branding settings.
 */
export const GET: APIRoute = async ({ locals }) => {
	const { emdash, user } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	const denied = requirePerm(user, "settings:manage");
	if (denied) return denied;

	try {
		const result = await handleGetBranding(emdash.db);
		return unwrapResult(result);
	} catch (error) {
		return handleError(error, "Failed to get app branding", "BRANDING_READ_ERROR");
	}
};

/**
 * PUT /_emdash/api/admin/app-branding
 *
 * Updates app branding settings. Accepts a partial branding object.
 */
export const PUT: APIRoute = async ({ request, locals }) => {
	const { emdash, user } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	const denied = requirePerm(user, "settings:manage");
	if (denied) return denied;

	try {
		const body = await parseBody(request, updateBrandingSchema);
		if (isParseError(body)) return body;

		const result = await handleUpdateBranding(emdash.db, body);
		return unwrapResult(result);
	} catch (error) {
		return handleError(error, "Failed to update app branding", "BRANDING_UPDATE_ERROR");
	}
};
