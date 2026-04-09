/**
 * Customer list endpoint
 *
 * GET /_emdash/api/admin/customers - List customers with search, filter, pagination
 */

export const prerender = false;

import { Role } from "@emdash-cms/auth";
import type { APIRoute } from "astro";
import { z } from "zod";

import { apiError, apiSuccess, handleError } from "#api/error.js";
import { isParseError, parseQuery } from "#api/parse.js";

import { CustomerRepository } from "#db/repositories/customer.js";

const listQuery = z.object({
	search: z.string().optional(),
	status: z.string().optional(),
	cursor: z.string().optional(),
	limit: z.coerce.number().min(1).max(100).optional(),
});

export const GET: APIRoute = async ({ url, locals }) => {
	const { emdash, user } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	if (!user || user.role < Role.EDITOR) {
		return apiError("FORBIDDEN", "Insufficient permissions", 403);
	}

	try {
		const query = parseQuery(url, listQuery);
		if (isParseError(query)) return query;

		const repo = new CustomerRepository(emdash.db);
		const result = await repo.findMany({
			search: query.search,
			status: query.status,
			cursor: query.cursor,
			limit: query.limit,
		});

		return apiSuccess(result);
	} catch (error) {
		return handleError(error, "Failed to list customers", "CUSTOMER_LIST_ERROR");
	}
};
