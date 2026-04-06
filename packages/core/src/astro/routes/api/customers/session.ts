export const prerender = false;

import type { APIRoute } from "astro";

import { apiError, apiSuccess, handleError } from "#api/error.js";
import { validateCustomerSession } from "#api/handlers/customer-auth.js";

export const GET: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return apiError("UNAUTHORIZED", "Missing authorization header", 401);
		}

		const result = await validateCustomerSession(emdash.db, authHeader.slice(7));
		if (!result.success) {
			return apiError(result.error.code, result.error.message, 401);
		}

		return apiSuccess(result.data);
	} catch (error) {
		return handleError(error, "Session validation failed", "CUSTOMER_SESSION_ERROR");
	}
};
