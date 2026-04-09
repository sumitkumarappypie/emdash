/**
 * Single customer endpoints
 *
 * GET    /_emdash/api/admin/customers/:id — Get a customer
 * PUT    /_emdash/api/admin/customers/:id — Update a customer
 * DELETE /_emdash/api/admin/customers/:id — Delete a customer
 */

export const prerender = false;

import { Role } from "@emdash-cms/auth";
import type { APIRoute } from "astro";
import { z } from "zod";

import { apiError, apiSuccess, handleError } from "#api/error.js";
import { isParseError, parseBody } from "#api/parse.js";

import { CustomerRepository } from "../../../../database/repositories/customer.js";

/**
 * Get a single customer.
 */
export const GET: APIRoute = async ({ params, locals }) => {
	const { emdash, user } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	if (!user || user.role < Role.EDITOR) {
		return apiError("FORBIDDEN", "Insufficient permissions", 403);
	}

	try {
		const repo = new CustomerRepository(emdash.db);
		const customer = await repo.findById(params.id!);
		if (!customer) return apiError("NOT_FOUND", "Customer not found", 404);
		return apiSuccess(customer);
	} catch (error) {
		return handleError(error, "Failed to get customer", "CUSTOMER_GET_ERROR");
	}
};

const updateSchema = z.object({
	name: z.string().min(1).optional(),
	email: z.string().email().optional(),
	status: z.enum(["active", "inactive"]).optional(),
});

/**
 * Update a customer.
 */
export const PUT: APIRoute = async ({ params, request, locals }) => {
	const { emdash, user } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	if (!user || user.role < Role.ADMIN) {
		return apiError("FORBIDDEN", "Admin privileges required", 403);
	}

	try {
		const body = await parseBody(request, updateSchema);
		if (isParseError(body)) return body;

		const repo = new CustomerRepository(emdash.db);
		const customer = await repo.update(params.id!, body);
		if (!customer) return apiError("NOT_FOUND", "Customer not found", 404);
		return apiSuccess(customer);
	} catch (error) {
		return handleError(error, "Failed to update customer", "CUSTOMER_UPDATE_ERROR");
	}
};

/**
 * Delete a customer.
 */
export const DELETE: APIRoute = async ({ params, locals }) => {
	const { emdash, user } = locals;

	if (!emdash?.db) {
		return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
	}

	if (!user || user.role < Role.ADMIN) {
		return apiError("FORBIDDEN", "Admin privileges required", 403);
	}

	try {
		const repo = new CustomerRepository(emdash.db);
		const existing = await repo.findById(params.id!);
		if (!existing) return apiError("NOT_FOUND", "Customer not found", 404);
		await repo.delete(params.id!);
		return apiSuccess({ deleted: true });
	} catch (error) {
		return handleError(error, "Failed to delete customer", "CUSTOMER_DELETE_ERROR");
	}
};
