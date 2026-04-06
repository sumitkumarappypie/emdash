export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";

import { apiError, apiSuccess, handleError } from "#api/error.js";
import { loginCustomer } from "#api/handlers/customer-auth.js";
import { isParseError, parseBody } from "#api/parse.js";

const loginBody = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		const body = await parseBody(request, loginBody);
		if (isParseError(body)) return body;

		const result = await loginCustomer(emdash.db, body);
		if (!result.success) {
			return apiError(result.error.code, result.error.message, 401);
		}

		if (emdash.hooks) {
			await emdash.hooks.run("customer:authenticated", {
				customerId: result.data.customer.id,
				email: result.data.customer.email,
			});
		}

		return apiSuccess(result.data);
	} catch (error) {
		return handleError(error, "Login failed", "CUSTOMER_LOGIN_ERROR");
	}
};
