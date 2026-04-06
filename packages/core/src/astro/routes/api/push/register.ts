export const prerender = false;

import type { APIRoute } from "astro";
import { z } from "zod";

import { apiError, apiSuccess, handleError } from "#api/error.js";
import { hashSessionToken } from "#api/handlers/customer-auth.js";
import { isParseError, parseBody } from "#api/parse.js";

const registerBody = z.object({
	pushToken: z.string().min(1).max(512),
	platform: z.enum(["ios", "android", "web"]),
});

const unregisterBody = z.object({
	pushToken: z.string().min(1).max(512),
});

/**
 * Resolve customer_id from a Bearer token, if present.
 * Returns null when no valid customer session is found.
 */
async function resolveCustomerId(
	request: Request,
	db: import("kysely").Kysely<import("../../../../database/types.js").Database>,
): Promise<string | null> {
	const authHeader = request.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ")) return null;

	const token = authHeader.slice(7);
	if (!token) return null;

	const tokenHash = await hashSessionToken(token);
	const session = await db
		.selectFrom("_emdash_customer_sessions")
		.select(["customer_id", "expires_at"])
		.where("token_hash", "=", tokenHash)
		.executeTakeFirst();

	if (!session) return null;
	if (new Date(session.expires_at) < new Date()) return null;

	return session.customer_id;
}

export const POST: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		const body = await parseBody(request, registerBody);
		if (isParseError(body)) return body;

		const customerId = await resolveCustomerId(request, emdash.db);
		const now = new Date().toISOString();

		// Upsert: if push_token already exists, update customer_id, platform, and last_seen_at
		const existing = await emdash.db
			.selectFrom("_emdash_push_devices")
			.select("id")
			.where("push_token", "=", body.pushToken)
			.executeTakeFirst();

		if (existing) {
			await emdash.db
				.updateTable("_emdash_push_devices")
				.set({
					customer_id: customerId,
					platform: body.platform,
					last_seen_at: now,
				})
				.where("id", "=", existing.id)
				.execute();

			return apiSuccess({ id: existing.id, pushToken: body.pushToken, platform: body.platform });
		}

		const id = crypto.randomUUID();
		await emdash.db
			.insertInto("_emdash_push_devices")
			.values({
				id,
				customer_id: customerId,
				push_token: body.pushToken,
				platform: body.platform,
				created_at: now,
				last_seen_at: now,
			})
			.execute();

		return apiSuccess({ id, pushToken: body.pushToken, platform: body.platform }, 201);
	} catch (error) {
		return handleError(error, "Push device registration failed", "PUSH_REGISTER_ERROR");
	}
};

export const DELETE: APIRoute = async ({ request, locals }) => {
	const { emdash } = locals;
	if (!emdash?.db) return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);

	try {
		const body = await parseBody(request, unregisterBody);
		if (isParseError(body)) return body;

		await emdash.db
			.deleteFrom("_emdash_push_devices")
			.where("push_token", "=", body.pushToken)
			.execute();

		return apiSuccess({ removed: true });
	} catch (error) {
		return handleError(error, "Push device unregistration failed", "PUSH_UNREGISTER_ERROR");
	}
};
