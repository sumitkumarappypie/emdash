import { type Kysely } from "kysely";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { hashPassword } from "../../../src/api/handlers/customer-auth.js";
import { CustomerRepository } from "../../../src/database/repositories/customer.js";
import type { Database } from "../../../src/database/types.js";
import { setupTestDatabase } from "../../utils/test-db.js";

describe("CustomerRepository", () => {
	let db: Kysely<Database>;
	let repo: CustomerRepository;

	beforeEach(async () => {
		db = await setupTestDatabase();
		repo = new CustomerRepository(db);

		const hash = await hashPassword("password123");
		await db
			.insertInto("_emdash_customers")
			.values([
				{
					id: "cust_1",
					email: "alice@example.com",
					name: "Alice",
					password_hash: hash,
					status: "active",
					created_at: "2026-01-01T00:00:00Z",
					updated_at: "2026-01-01T00:00:00Z",
				},
				{
					id: "cust_2",
					email: "bob@example.com",
					name: "Bob",
					password_hash: hash,
					status: "active",
					created_at: "2026-01-02T00:00:00Z",
					updated_at: "2026-01-02T00:00:00Z",
				},
				{
					id: "cust_3",
					email: "charlie@example.com",
					name: "Charlie",
					password_hash: hash,
					status: "inactive",
					created_at: "2026-01-03T00:00:00Z",
					updated_at: "2026-01-03T00:00:00Z",
				},
			])
			.execute();
	});

	afterEach(async () => {
		await db.destroy();
	});

	it("findMany returns all customers", async () => {
		const result = await repo.findMany({ limit: 50 });
		expect(result.items).toHaveLength(3);
		expect(result.items[0]!.email).toBe("charlie@example.com"); // newest first
	});

	it("findMany filters by status", async () => {
		const result = await repo.findMany({ status: "active", limit: 50 });
		expect(result.items).toHaveLength(2);
	});

	it("findMany supports search by name or email", async () => {
		const result = await repo.findMany({ search: "alice", limit: 50 });
		expect(result.items).toHaveLength(1);
		expect(result.items[0]!.name).toBe("Alice");
	});

	it("findMany supports cursor pagination", async () => {
		const page1 = await repo.findMany({ limit: 2 });
		expect(page1.items).toHaveLength(2);
		expect(page1.nextCursor).toBeTruthy();

		const page2 = await repo.findMany({ limit: 2, cursor: page1.nextCursor });
		expect(page2.items).toHaveLength(1);
		expect(page2.nextCursor).toBeUndefined();
	});

	it("findById returns a customer", async () => {
		const customer = await repo.findById("cust_1");
		expect(customer).not.toBeNull();
		expect(customer!.email).toBe("alice@example.com");
	});

	it("findById returns null for non-existent customer", async () => {
		const customer = await repo.findById("nonexistent");
		expect(customer).toBeNull();
	});

	it("count returns total customers", async () => {
		const total = await repo.count();
		expect(total).toBe(3);
	});

	it("count filters by status", async () => {
		const active = await repo.count("active");
		expect(active).toBe(2);
	});
});
