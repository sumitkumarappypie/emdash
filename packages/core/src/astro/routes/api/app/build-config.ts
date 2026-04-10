/**
 * Build Config endpoint
 *
 * GET /_emdash/api/app/build-config
 *
 * Returns branding settings, site URL, and list of mobile plugins.
 * Authenticated via a static bearer token (EMDASH_BUILD_TOKEN).
 * Used by the GitHub Actions build pipeline to generate native app builds.
 */

export const prerender = false;

import type { APIRoute } from "astro";

import { apiError, apiSuccess, handleError } from "#api/error.js";
import { AppBrandingRepository } from "#db/repositories/app-branding.js";

import { getSiteSettingsWithDb } from "../../../../settings/index.js";

export const GET: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	// Authenticate via bearer token
	const buildToken =
		// @ts-ignore -- import.meta.env may not be typed
		import.meta.env.EMDASH_BUILD_TOKEN || import.meta.env.BUILD_TOKEN || "";

	if (!buildToken) {
		return apiError("NOT_CONFIGURED", "Build token is not configured", 500);
	}

	const authHeader = request.headers.get("Authorization");
	const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

	if (!token || token !== buildToken) {
		return apiError("UNAUTHORIZED", "Invalid or missing build token", 401);
	}

	try {
		const repo = new AppBrandingRepository(emdash.db);
		const branding = await repo.get();

		const settings = await getSiteSettingsWithDb(emdash.db);

		// Get all enabled plugins with mobile config
		const allPlugins = emdash.getAllMobilePlugins();
		const plugins = allPlugins
			.filter((p) => emdash.isPluginEnabled(p.id))
			.map((p) => ({
				id: p.id,
				name: p.name,
				version: p.version,
			}));

		return apiSuccess({
			branding,
			site: {
				name: settings.title ?? "EmDash",
				url: settings.url ?? "",
			},
			plugins,
		});
	} catch (error) {
		return handleError(error, "Failed to build config", "BUILD_CONFIG_ERROR");
	}
};
