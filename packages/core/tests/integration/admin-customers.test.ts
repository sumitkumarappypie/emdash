import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Kysely } from "kysely";

import { CustomerRepository } from "../../src/database/repositories/customer.js";
import { hashPassword } from "../../src/api/handlers/customer-auth.js";
import type { Database } from "../../src/database/types.js";
import { setupTestDatabase } from "../utils/test-db.js";

describe("Customer admin operations", () => {
	let db: Kysely<Database>;
	let repo: CustomerRepository;

	beforeEach(async () => {
		db = await setupTestDatabase();
		repo = new CustomerRepository(db);

		const hash = await hashPassword("test123");
		await db
			.insertInto("_emdash_customers")
			.values({ id: "cust_1", email: "test@example.com", name: "Test User", password_hash: hash, status: "active", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" })
			.execute();
	});

	afterEach(async () => {
		await db.destroy();
	});

	it("update changes customer fields", async () => {
		const updated = await repo.update("cust_1", { name: "Updated Name" });
		expect(updated!.name).toBe("Updated Name");
		expect(updated!.email).toBe("test@example.com"); // unchanged
	});

	it("delete removes customer", async () => {
		await repo.delete("cust_1");
		const found = await repo.findById("cust_1");
		expect(found).toBeNull();
	});

	it("delete cascades to sessions", async () => {
		// Insert a session
		await db
			.insertInto("_emdash_customer_sessions")
			.values({
				id: "sess_1",
				customer_id: "cust_1",
				token_hash: "abc123",
				expires_at: "2027-01-01T00:00:00Z",
				created_at: "2026-01-01T00:00:00Z",
			})
			.execute();

		await repo.delete("cust_1");

		const sessions = await db
			.selectFrom("_emdash_customer_sessions")
			.selectAll()
			.where("customer_id", "=", "cust_1")
			.execute();

		expect(sessions).toHaveLength(0);
	});
});
