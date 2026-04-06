import type { KVAccess } from "emdash";

import { CommerceError } from "./cart.js";
import { getCustomerByEmail } from "./customers.js";
import type { StorageCollection } from "./storage-types.js";
import type { Customer } from "./types.js";
import { customerRegisterSchema, customerLoginSchema } from "./validation.js";

// PBKDF2 constants
const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;
const SESSION_TTL_DAYS = 30;

export interface CustomerSession {
	customerId: string;
	email: string;
	createdAt: string;
	expiresAt: string;
}

function generateId(): string {
	return crypto.randomUUID();
}

function bufToHex(buf: ArrayBuffer): string {
	return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBuf(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
	}
	return bytes;
}

export async function hashPassword(password: string): Promise<string> {
	if (!password) throw new CommerceError("INVALID_PASSWORD", "Password must not be empty");

	const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const passwordBytes = new TextEncoder().encode(password);

	const keyMaterial = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, [
		"deriveBits",
	]);

	const hashBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: saltBytes as Uint8Array<ArrayBuffer>,
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		HASH_LENGTH * 8,
	);

	return `${bufToHex(saltBytes.buffer)}:${bufToHex(hashBits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const colonIdx = stored.indexOf(":");
	if (colonIdx === -1) return false;

	const saltHex = stored.slice(0, colonIdx);
	const hashHex = stored.slice(colonIdx + 1);

	const saltBytes = hexToBuf(saltHex);
	const passwordBytes = new TextEncoder().encode(password);

	const keyMaterial = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, [
		"deriveBits",
	]);

	const hashBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: saltBytes as Uint8Array<ArrayBuffer>,
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		HASH_LENGTH * 8,
	);

	const computedHex = bufToHex(hashBits);
	// Constant-time comparison to avoid timing attacks
	if (computedHex.length !== hashHex.length) return false;
	let diff = 0;
	for (let i = 0; i < computedHex.length; i++) {
		diff |= computedHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
	}
	return diff === 0;
}

export async function createSession(
	kv: KVAccess,
	customerId: string,
	email: string,
): Promise<string> {
	const token = generateId() + generateId();
	const now = new Date();
	const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

	const session: CustomerSession = {
		customerId,
		email,
		createdAt: now.toISOString(),
		expiresAt: expiresAt.toISOString(),
	};

	await kv.set(`session:customer:${token}`, session);
	return token;
}

export async function validateSession(
	kv: KVAccess,
	token: string,
): Promise<CustomerSession | null> {
	const session = await kv.get<CustomerSession>(`session:customer:${token}`);
	if (!session) return null;

	const expiresAt = new Date(session.expiresAt);
	if (expiresAt <= new Date()) return null;

	return session;
}

export async function destroySession(kv: KVAccess, token: string): Promise<void> {
	await kv.delete(`session:customer:${token}`);
}

export async function registerCustomer(
	customerStorage: StorageCollection,
	kv: KVAccess,
	input: Record<string, unknown>,
): Promise<{ customer: Customer; token: string }> {
	const validated = customerRegisterSchema.parse(input);

	const existing = await getCustomerByEmail(customerStorage, validated.email);
	if (existing) {
		throw new CommerceError("CUSTOMER_EXISTS", "A customer with this email is already registered");
	}

	const passwordHash = await hashPassword(validated.password);
	const now = new Date().toISOString();
	const id = generateId();

	const customer: Customer = {
		id,
		userId: null,
		email: validated.email,
		name: validated.name,
		phone: "",
		passwordHash,
		defaultShippingAddress: null,
		defaultBillingAddress: null,
		totalOrders: 0,
		totalSpent: 0,
		tags: [],
		acceptsMarketing: false,
		createdAt: now,
		updatedAt: now,
	};

	await customerStorage.put(id, customer);

	const token = await createSession(kv, id, validated.email);
	return { customer, token };
}

export async function loginCustomer(
	customerStorage: StorageCollection,
	kv: KVAccess,
	input: Record<string, unknown>,
): Promise<{ customer: Customer; token: string }> {
	const validated = customerLoginSchema.parse(input);

	const customer = await getCustomerByEmail(customerStorage, validated.email);
	if (!customer || !customer.passwordHash) {
		throw new CommerceError("AUTH_FAILED", "Invalid email or password");
	}

	const valid = await verifyPassword(validated.password, customer.passwordHash);
	if (!valid) {
		throw new CommerceError("AUTH_FAILED", "Invalid email or password");
	}

	const token = await createSession(kv, customer.id, customer.email);
	return { customer, token };
}
