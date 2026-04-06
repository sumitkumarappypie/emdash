/**
 * Public read-only content API - no authentication required.
 * Only serves published content.
 *
 * GET /_emdash/api/public/content/{collection}         - List published content
 * GET /_emdash/api/public/content/{collection}?slug=x  - Get single item by slug
 */

export const prerender = false;

import type { APIRoute } from "astro";

import { apiError, apiSuccess, handleError, unwrapResult } from "#api/error.js";

export const GET: APIRoute = async ({ params, url, locals }) => {
	const { emdash } = locals;
	if (!emdash?.handleContentList || !emdash?.handleContentGet) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	const collection = params.collection;
	if (!collection) {
		return apiError("VALIDATION_ERROR", "Collection is required", 400);
	}

	try {
		const slug = url.searchParams.get("slug");

		if (slug) {
			const result = await emdash.handleContentGet(collection, slug);
			if (!result.success) {
				return apiError(result.error.code, result.error.message, 404);
			}
			if (result.data.item.status !== "published") {
				return apiError("NOT_FOUND", "Content not found", 404);
			}
			return apiSuccess(result.data);
		}

		const limit = Math.min(
			Math.max(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 1),
			100,
		);
		const cursor = url.searchParams.get("cursor") || undefined;

		const result = await emdash.handleContentList(collection, {
			status: "published",
			limit,
			cursor,
		});

		return unwrapResult(result);
	} catch (error) {
		return handleError(error, "Failed to fetch content", "PUBLIC_CONTENT_ERROR");
	}
};
