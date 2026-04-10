/**
 * App Branding handlers
 */

import type { Kysely } from "kysely";

import {
	AppBrandingRepository,
	type AppBranding,
} from "../../database/repositories/app-branding.js";
import type { Database } from "../../database/types.js";
import type { ApiResult } from "../types.js";

/**
 * Get app branding settings
 */
export async function handleGetBranding(db: Kysely<Database>): Promise<ApiResult<AppBranding>> {
	try {
		const repo = new AppBrandingRepository(db);
		const data = await repo.get();
		return { success: true, data };
	} catch {
		return {
			success: false,
			error: { code: "BRANDING_READ_ERROR", message: "Failed to get app branding" },
		};
	}
}

/**
 * Update app branding settings
 */
export async function handleUpdateBranding(
	db: Kysely<Database>,
	data: Partial<Omit<AppBranding, "iconUrl" | "splashUrl">>,
): Promise<ApiResult<AppBranding>> {
	try {
		const repo = new AppBrandingRepository(db);
		await repo.upsert(data);
		const updated = await repo.get();
		return { success: true, data: updated };
	} catch {
		return {
			success: false,
			error: { code: "BRANDING_UPDATE_ERROR", message: "Failed to update app branding" },
		};
	}
}
