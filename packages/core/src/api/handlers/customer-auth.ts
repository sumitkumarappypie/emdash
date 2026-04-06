import type { Kysely } from "kysely";

import type { Database } from "../../database/types.js";
import type { ApiResult } from "../types.js";

const PBKDF2_ITERATIONS = 100_000;
const HEX_PAIR_RE = /.{2}/g;

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const hash = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
		keyMaterial,
		256,
	);
	return `${toHex(salt)}:${toHex(new Uint8Array(hash))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [saltHex, storedHash] = stored.split(":");
	if (!saltHex || !storedHash) return false;
	const salt = new Uint8Array(saltHex.match(HEX_PAIR_RE)!.map((b) => parseInt(b, 16)));
	const encoder = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const hash = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
		keyMaterial,
		256,
	);
	return toHex(new Uint8Array(hash)) === storedHash;
}

export function generateSessionToken(): string {
	return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashSessionToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const hash = await crypto.subtle.digest("SHA-256", encoder.encode(token));
	return toHex(new Uint8Array(hash));
}

interface CustomerPublic {
	id: string;
	email: string;
	name: string;
	status: string;
	created_at: string;
}

export async function registerCustomer(
	db: Kysely<Database>,
	input: { email: string; name: string; password: string },
): Promise<ApiResult<{ customer: CustomerPublic; token: string }>> {
	const email = input.email.toLowerCase().trim();

	const existing = await db
		.selectFrom("_emdash_customers")
		.select("id")
		.where("email", "=", email)
		.executeTakeFirst();

	if (existing) {
		return {
			success: false,
			error: { code: "EMAIL_EXISTS", message: "An account with this email already exists" },
		};
	}

	const id = crypto.randomUUID();
	const now = new Date().toISOString();
	const passwordHash = await hashPassword(input.password);

	await db
		.insertInto("_emdash_customers")
		.values({
			id,
			email,
			name: input.name.trim(),
			password_hash: passwordHash,
			status: "active",
			created_at: now,
			updated_at: now,
		})
		.execute();

	const rawToken = generateSessionToken();
	const tokenHash = await hashSessionToken(rawToken);
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

	await db
		.insertInto("_emdash_customer_sessions")
		.values({
			id: crypto.randomUUID(),
			customer_id: id,
			token_hash: tokenHash,
			expires_at: expiresAt,
			created_at: now,
		})
		.execute();

	return {
		success: true,
		data: {
			customer: { id, email, name: input.name.trim(), status: "active", created_at: now },
			token: rawToken,
		},
	};
}

export async function loginCustomer(
	db: Kysely<Database>,
	input: { email: string; password: string },
): Promise<ApiResult<{ customer: CustomerPublic; token: string }>> {
	const email = input.email.toLowerCase().trim();

	const customer = await db
		.selectFrom("_emdash_customers")
		.selectAll()
		.where("email", "=", email)
		.where("status", "=", "active")
		.executeTakeFirst();

	if (!customer) {
		return {
			success: false,
			error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
		};
	}

	const valid = await verifyPassword(input.password, customer.password_hash);
	if (!valid) {
		return {
			success: false,
			error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
		};
	}

	const now = new Date().toISOString();
	await db
		.updateTable("_emdash_customers")
		.set({ last_login_at: now, updated_at: now })
		.where("id", "=", customer.id)
		.execute();

	const rawToken = generateSessionToken();
	const tokenHash = await hashSessionToken(rawToken);
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

	await db
		.insertInto("_emdash_customer_sessions")
		.values({
			id: crypto.randomUUID(),
			customer_id: customer.id,
			token_hash: tokenHash,
			expires_at: expiresAt,
			created_at: now,
		})
		.execute();

	return {
		success: true,
		data: {
			customer: {
				id: customer.id,
				email: customer.email,
				name: customer.name,
				status: customer.status,
				created_at: customer.created_at,
			},
			token: rawToken,
		},
	};
}

export async function validateCustomerSession(
	db: Kysely<Database>,
	token: string,
): Promise<ApiResult<{ customer: CustomerPublic }>> {
	const tokenHash = await hashSessionToken(token);

	const result = await db
		.selectFrom("_emdash_customer_sessions")
		.innerJoin("_emdash_customers", "_emdash_customers.id", "_emdash_customer_sessions.customer_id")
		.select([
			"_emdash_customers.id",
			"_emdash_customers.email",
			"_emdash_customers.name",
			"_emdash_customers.status",
			"_emdash_customers.created_at",
			"_emdash_customer_sessions.expires_at",
		])
		.where("_emdash_customer_sessions.token_hash", "=", tokenHash)
		.executeTakeFirst();

	if (!result) {
		return {
			success: false,
			error: { code: "INVALID_TOKEN", message: "Invalid or expired session" },
		};
	}

	if (new Date(result.expires_at) < new Date()) {
		await db.deleteFrom("_emdash_customer_sessions").where("token_hash", "=", tokenHash).execute();
		return {
			success: false,
			error: { code: "TOKEN_EXPIRED", message: "Session has expired" },
		};
	}

	return {
		success: true,
		data: {
			customer: {
				id: result.id,
				email: result.email,
				name: result.name,
				status: result.status,
				created_at: result.created_at,
			},
		},
	};
}

export async function logoutCustomer(db: Kysely<Database>, token: string): Promise<void> {
	const tokenHash = await hashSessionToken(token);
	await db.deleteFrom("_emdash_customer_sessions").where("token_hash", "=", tokenHash).execute();
}
