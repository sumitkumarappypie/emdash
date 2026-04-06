export const prerender = false;

import type { APIRoute } from "astro";

import { apiError, apiSuccess, handleError } from "#api/error.js";
import { logoutCustomer } from "#api/handlers/customer-auth.js";

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return apiError("UNAUTHORIZED", "Missing authorization header", 401);
		}

		await logoutCustomer(emdash.db, authHeader.slice(7));
		return apiSuccess({ success: true });
	} catch (error) {
		return handleError(error, "Logout failed", "CUSTOMER_LOGOUT_ERROR");
	}
};
