export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";

import { apiError, apiSuccess, handleError } from "#api/error.js";
import { validateCustomerSession } from "#api/handlers/customer-auth.js";
import { isParseError, parseBody } from "#api/parse.js";

const updateBody = z.object({
	name: z.string().min(1).max(200).optional(),
	email: z.string().email().optional(),
});

export const GET: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return apiError("UNAUTHORIZED", "Missing authorization header", 401);
		}

		const result = await validateCustomerSession(emdash.db, authHeader.slice(7));
		if (!result.success) return apiError(result.error.code, result.error.message, 401);

		return apiSuccess(result.data);
	} catch (error) {
		return handleError(error, "Failed to get profile", "CUSTOMER_PROFILE_ERROR");
	}
};

export const PATCH: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		const authHeader = request.headers.get("Authorization");
		if (!authHeader?.startsWith("Bearer ")) {
			return apiError("UNAUTHORIZED", "Missing authorization header", 401);
		}

		const session = await validateCustomerSession(emdash.db, authHeader.slice(7));
		if (!session.success) return apiError(session.error.code, session.error.message, 401);

		const body = await parseBody(request, updateBody);
		if (isParseError(body)) return body;

		const updates: Record<string, string> = { updated_at: new Date().toISOString() };
		if (body.name) updates.name = body.name.trim();
		if (body.email) updates.email = body.email.toLowerCase().trim();

		await emdash.db
			.updateTable("_emdash_customers")
			.set(updates)
			.where("id", "=", session.data.customer.id)
			.execute();

		return apiSuccess({ success: true });
	} catch (error) {
		return handleError(error, "Failed to update profile", "CUSTOMER_UPDATE_ERROR");
	}
};
