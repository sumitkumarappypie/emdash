import type { Kysely } from "kysely";

import type { Database } from "../types.js";
import { encodeCursor, decodeCursor, type FindManyResult } from "./types.js";

export interface Customer {
	id: string;
	email: string;
	name: string;
	status: string;
	createdAt: string;
	updatedAt: string;
	lastLoginAt: string | null;
}

export interface FindCustomersOptions {
	search?: string;
	status?: string;
	limit?: number;
	cursor?: string;
}

export class CustomerRepository {
	constructor(private db: Kysely<Database>) {}

	async findMany(options: FindCustomersOptions = {}): Promise<FindManyResult<Customer>> {
		const limit = Math.min(Math.max(1, options.limit ?? 50), 100);

		let query = this.db
			.selectFrom("_emdash_customers")
			.select(["id", "email", "name", "status", "created_at", "updated_at", "last_login_at"])
			.orderBy("created_at", "desc")
			.orderBy("id", "desc");

		if (options.status) {
			query = query.where("status", "=", options.status);
		}

		if (options.search) {
			const term = `%${options.search}%`;
			query = query.where((eb) => eb.or([eb("name", "like", term), eb("email", "like", term)]));
		}

		if (options.cursor) {
			const decoded = decodeCursor(options.cursor);
			if (decoded) {
				query = query.where((eb) =>
					eb.or([
						eb("created_at", "<", decoded.orderValue),
						eb.and([eb("created_at", "=", decoded.orderValue), eb("id", "<", decoded.id)]),
					]),
				);
			}
		}

		const rows = await query.limit(limit + 1).execute();

		const hasMore = rows.length > limit;
		const items = rows.slice(0, limit).map(this.rowToCustomer);
		const lastItem = items.at(-1);

		return {
			items,
			nextCursor: hasMore && lastItem ? encodeCursor(lastItem.createdAt, lastItem.id) : undefined,
		};
	}

	async findById(id: string): Promise<Customer | null> {
		const row = await this.db
			.selectFrom("_emdash_customers")
			.select(["id", "email", "name", "status", "created_at", "updated_at", "last_login_at"])
			.where("id", "=", id)
			.executeTakeFirst();

		return row ? this.rowToCustomer(row) : null;
	}

	async update(
		id: string,
		data: { name?: string; email?: string; status?: string },
	): Promise<Customer | null> {
		await this.db
			.updateTable("_emdash_customers")
			.set({ ...data, updated_at: new Date().toISOString() })
			.where("id", "=", id)
			.execute();

		return this.findById(id);
	}

	async delete(id: string): Promise<void> {
		await this.db.deleteFrom("_emdash_customers").where("id", "=", id).execute();
	}

	async count(status?: string): Promise<number> {
		let query = this.db
			.selectFrom("_emdash_customers")
			.select((eb) => eb.fn.count<number>("id").as("count"));

		if (status) {
			query = query.where("status", "=", status);
		}

		const result = await query.executeTakeFirstOrThrow();
		return Number(result.count);
	}

	private rowToCustomer(row: {
		id: string;
		email: string;
		name: string;
		status: string;
		created_at: string;
		updated_at: string;
		last_login_at: string | null;
	}): Customer {
		return {
			id: row.id,
			email: row.email,
			name: row.name,
			status: row.status,
			createdAt: row.created_at,
			updatedAt: row.updated_at,
			lastLoginAt: row.last_login_at,
		};
	}
}
