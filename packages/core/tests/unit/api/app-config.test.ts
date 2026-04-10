import { describe, it, expect } from "vitest";

import { buildAppConfig } from "../../../src/api/handlers/app-config.js";

describe("buildAppConfig", () => {
	it("includes plugins with mobile config from both configured and marketplace sources", () => {
		const result = buildAppConfig({
			siteName: "Test",
			siteUrl: "https://test.com",
			plugins: [
				{
					id: "commerce",
					name: "Commerce",
					version: "1.0.0",
					mobile: {
						native: true,
						label: "Shop",
						icon: "store",
						tabs: [{ key: "shop", label: "Shop", icon: "store", screen: "commerce:product-list" }],
					},
				},
				{
					id: "reviews",
					name: "Reviews",
					version: "1.0.0",
					mobile: {
						native: false,
						entryUrl: "/plugin-ui",
						label: "Reviews",
						icon: "star",
						tabs: [{ key: "reviews", label: "Reviews", icon: "star", screen: "reviews:main" }],
					},
				},
				{
					id: "seo",
					name: "SEO",
					version: "1.0.0",
					// no mobile config
				},
			],
			hookContributions: [],
		});

		expect(result.plugins).toHaveLength(2);
		expect(result.plugins[0]!.id).toBe("commerce");
		expect(result.plugins[1]!.id).toBe("reviews");
		expect(result.navigation.tabs).toHaveLength(2);
	});

	it("excludes plugins without mobile config", () => {
		const result = buildAppConfig({
			siteName: "Test",
			siteUrl: "https://test.com",
			plugins: [
				{
					id: "seo",
					name: "SEO",
					version: "1.0.0",
				},
				{
					id: "analytics",
					name: "Analytics",
					version: "2.0.0",
				},
			],
			hookContributions: [],
		});

		expect(result.plugins).toHaveLength(0);
		expect(result.navigation.tabs).toHaveLength(0);
	});

	it("merges theme and features from hook contributions", () => {
		const result = buildAppConfig({
			siteName: "My Site",
			siteUrl: "https://mysite.com",
			plugins: [],
			hookContributions: [
				{
					theme: { primary: "#FF0000" },
					features: { darkMode: true },
				},
				{
					theme: { secondary: "#00FF00" },
					features: { offlineMode: false },
				},
			],
		});

		expect(result.theme.primary).toBe("#FF0000");
		expect(result.theme.secondary).toBe("#00FF00");
		expect(result.features).toEqual({ darkMode: true, offlineMode: false });
		expect(result.site.name).toBe("My Site");
		expect(result.site.url).toBe("https://mysite.com");
	});
});
