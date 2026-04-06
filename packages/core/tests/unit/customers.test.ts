import type { Kysely } from "kysely";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { setupTestDatabase } from "../utils/test-db.js";

describe("core customer identity", () => {
	let db: Kysely<any>;

	beforeEach(async () => {
		db = await setupTestDatabase();
	});

	afterEach(async () => {
		await db.destroy();
	});

	it("can insert and query a customer", async () => {
		await db
			.insertInto("_emdash_customers")
			.values({
				id: "cust_1",
				email: "alice@example.com",
				name: "Alice",
				password_hash: "hashed_pw",
				status: "active",
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.execute();

		const customer = await db
			.selectFrom("_emdash_customers")
			.selectAll()
			.where("email", "=", "alice@example.com")
			.executeTakeFirst();

		expect(customer).toBeTruthy();
		expect(customer!.name).toBe("Alice");
		expect(customer!.status).toBe("active");
	});

	it("enforces unique email", async () => {
		const base = {
			email: "bob@example.com",
			name: "Bob",
			password_hash: "hash",
			status: "active",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		await db
			.insertInto("_emdash_customers")
			.values({ id: "cust_1", ...base })
			.execute();

		await expect(
			db
				.insertInto("_emdash_customers")
				.values({ id: "cust_2", ...base })
				.execute(),
		).rejects.toThrow();
	});

	it("can store and retrieve a customer session token", async () => {
		await db
			.insertInto("_emdash_customers")
			.values({
				id: "cust_1",
				email: "alice@example.com",
				name: "Alice",
				password_hash: "hash",
				status: "active",
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.execute();

		await db
			.insertInto("_emdash_customer_sessions")
			.values({
				id: "sess_1",
				customer_id: "cust_1",
				token_hash: "hashed_token_abc",
				expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
				created_at: new Date().toISOString(),
			})
			.execute();

		const session = await db
			.selectFrom("_emdash_customer_sessions")
			.innerJoin(
				"_emdash_customers",
				"_emdash_customers.id",
				"_emdash_customer_sessions.customer_id",
			)
			.select([
				"_emdash_customers.id as customer_id",
				"_emdash_customers.email",
				"_emdash_customers.name",
				"_emdash_customer_sessions.expires_at",
			])
			.where("_emdash_customer_sessions.token_hash", "=", "hashed_token_abc")
			.executeTakeFirst();

		expect(session).toBeTruthy();
		expect(session!.email).toBe("alice@example.com");
	});

	it("cascades delete from customer to sessions", async () => {
		await db
			.insertInto("_emdash_customers")
			.values({
				id: "cust_1",
				email: "alice@example.com",
				name: "Alice",
				password_hash: "hash",
				status: "active",
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString(),
			})
			.execute();

		await db
			.insertInto("_emdash_customer_sessions")
			.values({
				id: "sess_1",
				customer_id: "cust_1",
				token_hash: "tok_1",
				expires_at: new Date(Date.now() + 1000).toISOString(),
				created_at: new Date().toISOString(),
			})
			.execute();

		await db.deleteFrom("_emdash_customers").where("id", "=", "cust_1").execute();

		const sessions = await db
			.selectFrom("_emdash_customer_sessions")
			.selectAll()
			.where("customer_id", "=", "cust_1")
			.execute();

		expect(sessions).toHaveLength(0);
	});
});
