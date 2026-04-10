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

import { apiError, handleError } from "#api/error.js";
import { AppBrandingRepository } from "#db/repositories/app-branding.js";

import { getSiteSettingsWithDb } from "../../../../settings/index.js";

/**
 * Get environment variable from Cloudflare Workers env or import.meta.env.
 * Astro v6 removed locals.runtime.env — use cloudflare:workers import instead.
 */
async function getEnvVar(name: string): Promise<string> {
	try {
		// @ts-ignore -- cloudflare:workers is a virtual module only available in CF runtime
		const { env } = await import("cloudflare:workers");
		if (env?.[name]) return String(env[name]);
	} catch {
		// Not running on Cloudflare — fall through to import.meta.env
	}
	// @ts-ignore -- import.meta.env may not be typed
	return String(import.meta.env[name] ?? "");
}

export const GET: APIRoute = async ({ request, locals }) => {
	try {
		const { emdash } = locals;
		if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

		// Authenticate via bearer token
		const buildToken = (await getEnvVar("EMDASH_BUILD_TOKEN")) || (await getEnvVar("BUILD_TOKEN"));

		if (!buildToken) {
			return apiError("NOT_CONFIGURED", "Build token is not configured", 500);
		}

		const authHeader = request.headers.get("Authorization");
		const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

		if (!token || token !== buildToken) {
			return apiError("UNAUTHORIZED", "Invalid or missing build token", 401);
		}

		const repo = new AppBrandingRepository(emdash.db);
		const branding = await repo.get();

		const settings = await getSiteSettingsWithDb(emdash.db);

		// Get all enabled plugins with mobile config
		const allPlugins =
			typeof emdash.getAllMobilePlugins === "function" ? emdash.getAllMobilePlugins() : [];
		const plugins = allPlugins
			.filter((p) =>
				typeof emdash.isPluginEnabled === "function" ? emdash.isPluginEnabled(p.id) : true,
			)
			.map((p) => ({
				id: p.id,
				name: p.name,
				version: p.version,
				native: p.mobile?.native ?? false,
				entryUrl: p.mobile?.entryUrl,
			}));

		return Response.json({
			success: true,
			data: {
				branding,
				site: {
					name: settings.title ?? "EmDash",
					url: settings.url ?? "",
				},
				plugins,
			},
		});
	} catch (error) {
		return handleError(error, "Failed to build config", "BUILD_CONFIG_ERROR");
	}
};
