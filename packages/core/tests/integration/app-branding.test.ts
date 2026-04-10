import type { Kysely } from "kysely";
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { AppBrandingRepository } from "../../src/database/repositories/app-branding.js";
import type { Database } from "../../src/database/types.js";
import { setupTestDatabase } from "../utils/test-db.js";

describe("App branding repository", () => {
	let db: Kysely<Database>;
	let repo: AppBrandingRepository;

	beforeEach(async () => {
		db = await setupTestDatabase();
		repo = new AppBrandingRepository(db);
	});

	afterEach(async () => {
		await db.destroy();
	});

	it("get() returns defaults when no row exists", async () => {
		const branding = await repo.get();

		expect(branding.appName).toBe("EmDash");
		expect(branding.appSlug).toBe("emdash-mobile");
		expect(branding.iosBundle).toBe("com.emdash.mobile");
		expect(branding.androidPackage).toBe("com.emdash.mobile");
		expect(branding.scheme).toBe("emdash");
		expect(branding.iconUrl).toBeNull();
		expect(branding.splashUrl).toBeNull();
		expect(branding.splashBgColor).toBe("#ffffff");
		expect(branding.accentColor).toBe("#3B82F6");
	});

	it("upsert() saves and get() retrieves the saved values", async () => {
		await repo.upsert({
			appName: "My Store",
			appSlug: "my-store",
			iosBundle: "com.example.mystore",
			androidPackage: "com.example.mystore",
			scheme: "mystore",
			splashBgColor: "#000000",
			accentColor: "#FF5733",
		});

		const branding = await repo.get();

		expect(branding.appName).toBe("My Store");
		expect(branding.appSlug).toBe("my-store");
		expect(branding.iosBundle).toBe("com.example.mystore");
		expect(branding.androidPackage).toBe("com.example.mystore");
		expect(branding.scheme).toBe("mystore");
		expect(branding.iconUrl).toBeNull();
		expect(branding.splashUrl).toBeNull();
		expect(branding.splashBgColor).toBe("#000000");
		expect(branding.accentColor).toBe("#FF5733");
	});

	it("upsert() with partial data merges with existing", async () => {
		await repo.upsert({
			appName: "My Store",
			appSlug: "my-store",
		});

		await repo.upsert({
			accentColor: "#00FF00",
		});

		const branding = await repo.get();

		expect(branding.appName).toBe("My Store");
		expect(branding.accentColor).toBe("#00FF00");
	});

	it("updateAssetUrl() updates icon_url", async () => {
		// First create the row
		await repo.upsert({ appName: "Test" });

		await repo.updateAssetUrl("icon_url", "https://example.com/icon.png");

		const branding = await repo.get();
		expect(branding.iconUrl).toBe("https://example.com/icon.png");
	});

	it("updateAssetUrl() updates splash_url", async () => {
		await repo.upsert({ appName: "Test" });

		await repo.updateAssetUrl("splash_url", "https://example.com/splash.png");

		const branding = await repo.get();
		expect(branding.splashUrl).toBe("https://example.com/splash.png");
	});
});
