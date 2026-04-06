import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("_emdash_customers")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("email", "text", (col) => col.notNull().unique())
		.addColumn("name", "text", (col) => col.notNull())
		.addColumn("password_hash", "text", (col) => col.notNull())
		.addColumn("status", "text", (col) => col.notNull().defaultTo("active"))
		.addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
		.addColumn("updated_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
		.addColumn("last_login_at", "text")
		.execute();

	await db.schema
		.createIndex("idx_customers_email")
		.on("_emdash_customers")
		.column("email")
		.execute();

	await db.schema
		.createIndex("idx_customers_status")
		.on("_emdash_customers")
		.column("status")
		.execute();

	await db.schema
		.createTable("_emdash_customer_sessions")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("customer_id", "text", (col) =>
			col.notNull().references("_emdash_customers.id").onDelete("cascade"),
		)
		.addColumn("token_hash", "text", (col) => col.notNull().unique())
		.addColumn("expires_at", "text", (col) => col.notNull())
		.addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
		.execute();

	await db.schema
		.createIndex("idx_customer_sessions_token")
		.on("_emdash_customer_sessions")
		.column("token_hash")
		.execute();

	await db.schema
		.createIndex("idx_customer_sessions_customer")
		.on("_emdash_customer_sessions")
		.column("customer_id")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("_emdash_customer_sessions").execute();
	await db.schema.dropTable("_emdash_customers").execute();
}
