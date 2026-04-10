import type { InsertObject, Kysely, UpdateObject } from "kysely";

import type { Database } from "../types.js";

export interface AppBranding {
	appName: string;
	appSlug: string;
	iosBundle: string;
	androidPackage: string;
	scheme: string;
	iconUrl: string | null;
	splashUrl: string | null;
	splashBgColor: string;
	accentColor: string;
}

const DEFAULTS: AppBranding = {
	appName: "EmDash",
	appSlug: "emdash-mobile",
	iosBundle: "com.emdash.mobile",
	androidPackage: "com.emdash.mobile",
	scheme: "emdash",
	iconUrl: null,
	splashUrl: null,
	splashBgColor: "#ffffff",
	accentColor: "#3B82F6",
};

export class AppBrandingRepository {
	constructor(private db: Kysely<Database>) {}

	/**
	 * Get the current app branding settings.
	 * Returns defaults if no row exists in the database.
	 */
	async get(): Promise<AppBranding> {
		const row = await this.db
			.selectFrom("_emdash_app_branding")
			.select([
				"app_name",
				"app_slug",
				"ios_bundle",
				"android_package",
				"scheme",
				"icon_url",
				"splash_url",
				"splash_bg_color",
				"accent_color",
			])
			.where("id", "=", "default")
			.executeTakeFirst();

		if (!row) return { ...DEFAULTS };

		return {
			appName: row.app_name,
			appSlug: row.app_slug,
			iosBundle: row.ios_bundle,
			androidPackage: row.android_package,
			scheme: row.scheme,
			iconUrl: row.icon_url,
			splashUrl: row.splash_url,
			splashBgColor: row.splash_bg_color,
			accentColor: row.accent_color,
		};
	}

	/**
	 * Insert or update app branding settings.
	 * Accepts a partial update — existing fields are preserved.
	 */
	async upsert(data: Partial<Omit<AppBranding, "iconUrl" | "splashUrl">>): Promise<void> {
		const now = new Date().toISOString();

		// Read current values so we can merge for the insert path
		const current = await this.get();
		const merged = { ...current, ...data };

		const row: InsertObject<Database, "_emdash_app_branding"> = {
			id: "default",
			app_name: merged.appName,
			app_slug: merged.appSlug,
			ios_bundle: merged.iosBundle,
			android_package: merged.androidPackage,
			scheme: merged.scheme,
			splash_bg_color: merged.splashBgColor,
			accent_color: merged.accentColor,
			updated_at: now,
		};

		// Build an update set with only the changed columns
		const updateSet: UpdateObject<Database, "_emdash_app_branding"> = { updated_at: now };
		if (data.appName !== undefined) updateSet.app_name = data.appName;
		if (data.appSlug !== undefined) updateSet.app_slug = data.appSlug;
		if (data.iosBundle !== undefined) updateSet.ios_bundle = data.iosBundle;
		if (data.androidPackage !== undefined) updateSet.android_package = data.androidPackage;
		if (data.scheme !== undefined) updateSet.scheme = data.scheme;
		if (data.splashBgColor !== undefined) updateSet.splash_bg_color = data.splashBgColor;
		if (data.accentColor !== undefined) updateSet.accent_color = data.accentColor;

		await this.db
			.insertInto("_emdash_app_branding")
			.values(row)
			.onConflict((oc) => oc.column("id").doUpdateSet(updateSet))
			.execute();
	}

	/**
	 * Update an asset URL field (icon_url or splash_url).
	 */
	async updateAssetUrl(field: "icon_url" | "splash_url", url: string | null): Promise<void> {
		const now = new Date().toISOString();

		const updateSet: UpdateObject<Database, "_emdash_app_branding"> = {
			updated_at: now,
		};
		updateSet[field] = url;

		await this.db
			.updateTable("_emdash_app_branding")
			.set(updateSet)
			.where("id", "=", "default")
			.execute();
	}
}
