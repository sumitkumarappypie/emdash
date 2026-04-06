import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("_emdash_push_devices")
		.addColumn("id", "text", (col) => col.primaryKey())
		.addColumn("customer_id", "text", (col) =>
			col.references("_emdash_customers.id").onDelete("cascade"),
		)
		.addColumn("push_token", "text", (col) => col.notNull().unique())
		.addColumn("platform", "text", (col) => col.notNull())
		.addColumn("created_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
		.addColumn("last_seen_at", "text", (col) => col.notNull().defaultTo(sql`(datetime('now'))`))
		.execute();

	await db.schema
		.createIndex("idx_push_devices_customer")
		.on("_emdash_push_devices")
		.column("customer_id")
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("_emdash_push_devices").execute();
}
