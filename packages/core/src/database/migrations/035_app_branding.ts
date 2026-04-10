import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("_emdash_app_branding")
		.addColumn("id", "text", (col) => col.primaryKey().defaultTo("default"))
		.addColumn("app_name", "text", (col) => col.notNull().defaultTo("EmDash"))
		.addColumn("app_slug", "text", (col) => col.notNull().defaultTo("emdash-mobile"))
		.addColumn("ios_bundle", "text", (col) => col.notNull().defaultTo("com.emdash.mobile"))
		.addColumn("android_package", "text", (col) => col.notNull().defaultTo("com.emdash.mobile"))
		.addColumn("scheme", "text", (col) => col.notNull().defaultTo("emdash"))
		.addColumn("icon_url", "text")
		.addColumn("splash_url", "text")
		.addColumn("splash_bg_color", "text", (col) => col.notNull().defaultTo("#ffffff"))
		.addColumn("accent_color", "text", (col) => col.notNull().defaultTo("#3B82F6"))
		.addColumn("updated_at", "text", (col) => col.defaultTo(sql`(datetime('now'))`))
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema.dropTable("_emdash_app_branding").execute();
}
