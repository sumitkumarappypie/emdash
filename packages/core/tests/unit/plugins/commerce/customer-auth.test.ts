import { describe, it, expect } from "vitest";

import {
	hashPassword,
	verifyPassword,
	createSession,
	validateSession,
	destroySession,
	registerCustomer,
	loginCustomer,
} from "../../../../../plugins/commerce/src/customer-auth.js";
import type { CustomerSession } from "../../../../../plugins/commerce/src/customer-auth.js";

function createMockKV() {
	const store = new Map<string, unknown>();
	return {
		get: async <T>(key: string): Promise<T | null> => (store.get(key) as T) ?? null,
		set: async (key: string, value: unknown): Promise<void> => {
			store.set(key, value);
		},
		delete: async (key: string): Promise<boolean> => store.delete(key),
		list: async (prefix?: string): Promise<Array<{ key: string; value: unknown }>> => {
			const results: Array<{ key: string; value: unknown }> = [];
			for (const [key, value] of store) {
				if (!prefix || key.startsWith(prefix)) results.push({ key, value });
			}
			return results;
		},
	};
}

function createMockStorage<T = unknown>() {
	const store = new Map<string, T>();
	return {
		get: async (id: string): Promise<T | null> => store.get(id) ?? null,
		put: async (id: string, data: T): Promise<void> => {
			store.set(id, data);
		},
		delete: async (id: string): Promise<boolean> => store.delete(id),
		exists: async (id: string): Promise<boolean> => store.has(id),
		query: async (opts?: {
			where?: Record<string, unknown>;
			orderBy?: Record<string, string>;
			limit?: number;
		}): Promise<{ items: Array<{ id: string; data: T }>; hasMore: boolean }> => {
			let items = Array.from(store.entries(), ([id, data]) => ({ id, data }));
			if (opts?.where) {
				for (const [key, value] of Object.entries(opts.where)) {
					items = items.filter((item) => (item.data as Record<string, unknown>)[key] === value);
				}
			}
			const limit = opts?.limit ?? 50;
			return { items: items.slice(0, limit), hasMore: items.length > limit };
		},
		count: async (): Promise<number> => store.size,
	};
}

describe("hashPassword / verifyPassword", () => {
	it("hashes and verifies correctly", async () => {
		const hash = await hashPassword("correct-horse-battery-staple");
		const ok = await verifyPassword("correct-horse-battery-staple", hash);
		expect(ok).toBe(true);
	});

	it("rejects wrong password", async () => {
		const hash = await hashPassword("correct-horse-battery-staple");
		const ok = await verifyPassword("wrong-password", hash);
		expect(ok).toBe(false);
	});

	it("produces different hashes for the same password (unique salts)", async () => {
		const hash1 = await hashPassword("same-password");
		const hash2 = await hashPassword("same-password");
		expect(hash1).not.toBe(hash2);
	});

	it("rejects empty password", async () => {
		await expect(hashPassword("")).rejects.toThrow();
	});
});

describe("createSession / validateSession / destroySession", () => {
	it("creates and validates a session", async () => {
		const kv = createMockKV();
		const token = await createSession(kv, "cust-123", "test@example.com");
		expect(typeof token).toBe("string");
		expect(token.length).toBeGreaterThan(0);

		const session = await validateSession(kv, token);
		expect(session).not.toBeNull();
		expect(session!.customerId).toBe("cust-123");
		expect(session!.email).toBe("test@example.com");
	});

	it("returns null for an invalid token", async () => {
		const kv = createMockKV();
		const session = await validateSession(kv, "nonexistent-token");
		expect(session).toBeNull();
	});

	it("returns null for an expired session", async () => {
		const kv = createMockKV();
		const token = "expired-token-test";
		const expiredSession: CustomerSession = {
			customerId: "cust-456",
			email: "expired@example.com",
			createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
			expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
		};
		await kv.set(`session:customer:${token}`, expiredSession);

		const session = await validateSession(kv, token);
		expect(session).toBeNull();
	});

	it("destroys a session", async () => {
		const kv = createMockKV();
		const token = await createSession(kv, "cust-789", "destroy@example.com");

		await destroySession(kv, token);

		const session = await validateSession(kv, token);
		expect(session).toBeNull();
	});
});

describe("registerCustomer", () => {
	it("registers a new customer and returns a valid token", async () => {
		const kv = createMockKV();
		const storage = createMockStorage();

		const result = await registerCustomer(storage, kv, {
			email: "new@example.com",
			password: "SecurePass123",
			name: "New Customer",
		});

		expect(result.customer.email).toBe("new@example.com");
		expect(result.customer.name).toBe("New Customer");
		expect(result.customer.passwordHash).not.toBeNull();
		expect(typeof result.token).toBe("string");
		expect(result.token.length).toBeGreaterThan(0);

		// Verify the token is valid
		const session = await validateSession(kv, result.token);
		expect(session).not.toBeNull();
		expect(session!.customerId).toBe(result.customer.id);
	});

	it("rejects duplicate email registration", async () => {
		const kv = createMockKV();
		const storage = createMockStorage();

		await registerCustomer(storage, kv, {
			email: "duplicate@example.com",
			password: "SecurePass123",
			name: "First Customer",
		});

		await expect(
			registerCustomer(storage, kv, {
				email: "duplicate@example.com",
				password: "AnotherPass456",
				name: "Second Customer",
			}),
		).rejects.toMatchObject({ code: "CUSTOMER_EXISTS" });
	});
});

describe("loginCustomer", () => {
	it("logs in with correct credentials", async () => {
		const kv = createMockKV();
		const storage = createMockStorage();

		// First register
		const registered = await registerCustomer(storage, kv, {
			email: "login@example.com",
			password: "LoginPass789",
			name: "Login Customer",
		});

		// Then login
		const result = await loginCustomer(storage, kv, {
			email: "login@example.com",
			password: "LoginPass789",
		});

		expect(result.customer.id).toBe(registered.customer.id);
		expect(result.customer.email).toBe("login@example.com");
		expect(typeof result.token).toBe("string");
		expect(result.token.length).toBeGreaterThan(0);

		// Verify new session is valid
		const session = await validateSession(kv, result.token);
		expect(session).not.toBeNull();
		expect(session!.customerId).toBe(registered.customer.id);
	});

	it("rejects wrong password", async () => {
		const kv = createMockKV();
		const storage = createMockStorage();

		await registerCustomer(storage, kv, {
			email: "wrongpass@example.com",
			password: "CorrectPass123",
			name: "Test Customer",
		});

		await expect(
			loginCustomer(storage, kv, {
				email: "wrongpass@example.com",
				password: "WrongPass999",
			}),
		).rejects.toMatchObject({ code: "AUTH_FAILED" });
	});

	it("rejects non-existent email", async () => {
		const kv = createMockKV();
		const storage = createMockStorage();

		await expect(
			loginCustomer(storage, kv, {
				email: "nobody@example.com",
				password: "SomePass123",
			}),
		).rejects.toMatchObject({ code: "AUTH_FAILED" });
	});
});
