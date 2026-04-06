import { describe, it, expect } from "vitest";

import { buildAppConfig, type BuildAppConfigInput } from "../../src/api/handlers/app-config.js";
import type { AppConfigContribution, PluginMobileConfig } from "../../src/plugins/types.js";

function makeInput(overrides?: Partial<BuildAppConfigInput>): BuildAppConfigInput {
	return {
		siteName: "Test Site",
		siteUrl: "https://example.com",
		plugins: [],
		hookContributions: [],
		...overrides,
	};
}

describe("buildAppConfig", () => {
	it("returns default config with no plugins and no contributions", () => {
		const config = buildAppConfig(makeInput());

		expect(config.site).toEqual({
			name: "Test Site",
			url: "https://example.com",
			locale: "en",
		});

		expect(config.theme).toEqual({
			primary: "#3B82F6",
			secondary: "#6366F1",
			background: "#FFFFFF",
			surface: "#F9FAFB",
			text: "#111827",
			textMuted: "#6B7280",
			error: "#EF4444",
			success: "#10B981",
		});

		expect(config.plugins).toEqual([]);
		expect(config.navigation.tabs).toEqual([]);
		expect(config.features).toEqual({});
	});

	it("includes plugins with mobile config", () => {
		const mobile: PluginMobileConfig = {
			native: true,
			label: "Commerce",
			icon: "shopping-cart",
			tabs: [{ key: "shop", label: "Shop", icon: "store", screen: "ShopScreen" }],
		};

		const config = buildAppConfig(
			makeInput({
				plugins: [
					{ id: "commerce", name: "Commerce", version: "1.0.0", mobile },
					{ id: "seo", name: "SEO", version: "1.0.0" },
				],
			}),
		);

		expect(config.plugins).toHaveLength(1);
		expect(config.plugins[0]!.id).toBe("commerce");
		expect(config.plugins[0]!.mobile).toEqual(mobile);
	});

	it("excludes plugins without mobile config", () => {
		const config = buildAppConfig(
			makeInput({
				plugins: [
					{ id: "seo", name: "SEO", version: "1.0.0" },
					{ id: "analytics", name: "Analytics", version: "2.0.0" },
				],
			}),
		);

		expect(config.plugins).toEqual([]);
	});

	it("merges hook contributions into theme", () => {
		const contributions: Array<Partial<AppConfigContribution>> = [
			{ theme: { primary: "#FF0000", background: "#000000" } },
			{ theme: { primary: "#00FF00" } },
		];

		const config = buildAppConfig(makeInput({ hookContributions: contributions }));

		// Last contribution wins for primary
		expect(config.theme.primary).toBe("#00FF00");
		// First contribution's background survives
		expect(config.theme.background).toBe("#000000");
		// Unaffected defaults remain
		expect(config.theme.secondary).toBe("#6366F1");
		expect(config.theme.text).toBe("#111827");
	});

	it("collects feature flags from hook contributions", () => {
		const contributions: Array<Partial<AppConfigContribution>> = [
			{ features: { offlineMode: true, darkMode: false } },
			{ features: { pushNotifications: true } },
		];

		const config = buildAppConfig(makeInput({ hookContributions: contributions }));

		expect(config.features).toEqual({
			offlineMode: true,
			darkMode: false,
			pushNotifications: true,
		});
	});

	it("collects navigation tabs from mobile-enabled plugins", () => {
		const config = buildAppConfig(
			makeInput({
				plugins: [
					{
						id: "commerce",
						name: "Commerce",
						version: "1.0.0",
						mobile: {
							tabs: [
								{ key: "shop", label: "Shop", icon: "store", screen: "ShopScreen" },
								{ key: "cart", label: "Cart", icon: "cart", screen: "CartScreen" },
							],
						},
					},
					{
						id: "blog",
						name: "Blog",
						version: "1.0.0",
						mobile: {
							tabs: [{ key: "posts", label: "Posts", icon: "newspaper", screen: "PostsScreen" }],
						},
					},
				],
			}),
		);

		expect(config.navigation.tabs).toHaveLength(3);
		expect(config.navigation.tabs[0]!.key).toBe("shop");
		expect(config.navigation.tabs[1]!.key).toBe("cart");
		expect(config.navigation.tabs[2]!.key).toBe("posts");
	});

	it("handles empty hook contributions gracefully", () => {
		const contributions: Array<Partial<AppConfigContribution>> = [
			{},
			{ theme: undefined },
			{ features: undefined },
		];

		const config = buildAppConfig(makeInput({ hookContributions: contributions }));

		// Defaults should remain unchanged
		expect(config.theme.primary).toBe("#3B82F6");
		expect(config.features).toEqual({});
	});
});
