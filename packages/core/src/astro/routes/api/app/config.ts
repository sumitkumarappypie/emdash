export const prerender = false;

import type { APIRoute } from "astro";

import { apiError, apiSuccess, handleError } from "#api/error.js";
import { buildAppConfig } from "#api/handlers/app-config.js";

import { getSiteSettingsWithDb } from "../../../../settings/index.js";

export const GET: APIRoute = async ({ locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		// Gather hook contributions from plugins
		const hookContributions = emdash.hooks ? await emdash.hooks.runAppConfig() : [];

		// Get site settings for name/url
		const settings = await getSiteSettingsWithDb(emdash.db);

		// Get all enabled plugins with mobile config (configured + marketplace)
		const allPlugins = emdash.getAllMobilePlugins();
		const plugins = allPlugins.filter((p) => emdash.isPluginEnabled(p.id));

		const config = buildAppConfig({
			siteName: settings.title ?? "EmDash",
			siteUrl: settings.url ?? "",
			plugins,
			hookContributions,
		});

		return apiSuccess(config);
	} catch (error) {
		return handleError(error, "Failed to build app config", "APP_CONFIG_ERROR");
	}
};
