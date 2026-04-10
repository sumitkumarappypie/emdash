/**
 * App Build Trigger API endpoint
 *
 * POST /_emdash/api/admin/app-build - Trigger a GitHub Actions mobile build
 */

export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";

import { requirePerm } from "#api/authorize.js";
import { apiError, handleError } from "#api/error.js";
import { isParseError, parseBody } from "#api/parse.js";
import { AppBrandingRepository } from "#db/repositories/app-branding.js";
import { getSiteSettingsWithDb } from "#settings/index.js";

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
		// Not running on Cloudflare
	}
	// @ts-ignore
	return String(import.meta.env[name] ?? "");
}

const buildSchema = z.object({
	platform: z.enum(["android", "ios", "both"]),
});

/**
 * POST /_emdash/api/admin/app-build
 *
 * Dispatches a GitHub Actions workflow to build the mobile app.
 * Requires ADMIN-level permissions (settings:manage).
 *
 * Required environment variables:
 *   EMDASH_GITHUB_TOKEN or GITHUB_TOKEN  — GitHub personal access token
 *   EMDASH_GITHUB_REPO  or GITHUB_REPO  — GitHub repository (owner/repo)
 */
export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash, user } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	const denied = requirePerm(user, "settings:manage");
	if (denied) return denied;

	try {
		const body = await parseBody(request, buildSchema);
		if (isParseError(body)) return body;

		const { platform } = body;

		const ghToken = (await getEnvVar("EMDASH_GITHUB_TOKEN")) || (await getEnvVar("GITHUB_TOKEN"));
		const ghRepo = (await getEnvVar("EMDASH_GITHUB_REPO")) || (await getEnvVar("GITHUB_REPO"));

		if (!ghToken || !ghRepo) {
			return apiError(
				"BUILD_NOT_CONFIGURED",
				"GitHub token and repository must be configured (EMDASH_GITHUB_TOKEN, EMDASH_GITHUB_REPO)",
				400,
			);
		}

		const brandingRepo = new AppBrandingRepository(emdash.db);
		const branding = await brandingRepo.get();
		const settings = await getSiteSettingsWithDb(emdash.db);

		const response = await fetch(
			`https://api.github.com/repos/${ghRepo}/actions/workflows/build-mobile.yml/dispatches`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${ghToken}`,
					Accept: "application/vnd.github+json",
					"X-GitHub-Api-Version": "2022-11-28",
				},
				body: JSON.stringify({
					ref: "main",
					inputs: {
						app_name: branding.appName,
						android_package: branding.androidPackage,
						ios_bundle: branding.iosBundle,
						emdash_url: settings.url ?? "",
						platform,
					},
				}),
			},
		);

		if (!response.ok) {
			const responseBody = await response.text();
			return apiError(
				"BUILD_TRIGGER_FAILED",
				`GitHub API error: ${response.status} ${responseBody}`,
				502,
			);
		}

		return Response.json({
			success: true,
			data: { message: "Build triggered successfully" },
		});
	} catch (error) {
		return handleError(error, "Failed to trigger build", "BUILD_TRIGGER_ERROR");
	}
};
