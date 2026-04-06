/**
 * App Config Handler
 *
 * Builds the mobile app configuration by merging defaults with
 * plugin contributions from the app:config hook.
 */

import type {
	AppConfigContribution,
	PluginMobileConfig,
	PluginMobileTab,
} from "../../plugins/types.js";

/**
 * Default theme colors for the mobile app
 */
const DEFAULT_THEME = {
	primary: "#3B82F6",
	secondary: "#6366F1",
	background: "#FFFFFF",
	surface: "#F9FAFB",
	text: "#111827",
	textMuted: "#6B7280",
	error: "#EF4444",
	success: "#10B981",
} as const;

/**
 * Input shape for building the app config
 */
export interface BuildAppConfigInput {
	siteName: string;
	siteUrl: string;
	plugins: Array<{
		id: string;
		name: string;
		version: string;
		mobile?: PluginMobileConfig;
	}>;
	hookContributions: Array<Partial<AppConfigContribution>>;
}

/**
 * Plugin metadata included in the app config response
 */
export interface AppConfigPlugin {
	id: string;
	name: string;
	version: string;
	mobile: PluginMobileConfig;
}

/**
 * Full app config response shape
 */
export interface AppConfig {
	site: {
		name: string;
		url: string;
		locale: string;
	};
	theme: {
		primary: string;
		secondary: string;
		background: string;
		surface: string;
		text: string;
		textMuted: string;
		error: string;
		success: string;
	};
	plugins: AppConfigPlugin[];
	navigation: {
		tabs: PluginMobileTab[];
	};
	features: Record<string, boolean>;
}

/**
 * Build the app configuration from site info, plugins, and hook contributions.
 *
 * - Starts with default theme values
 * - Merges theme overrides from each hook contribution (last-write-wins)
 * - Collects feature flags from hook contributions
 * - Filters plugins to only those with mobile config
 * - Gathers navigation tabs from mobile-enabled plugins
 */
export function buildAppConfig(input: BuildAppConfigInput): AppConfig {
	const { siteName, siteUrl, plugins, hookContributions } = input;

	// Merge theme: start from defaults, layer on each contribution
	const theme = { ...DEFAULT_THEME };
	const features: Record<string, boolean> = {};

	for (const contribution of hookContributions) {
		if (contribution.theme) {
			Object.assign(theme, contribution.theme);
		}
		if (contribution.features) {
			Object.assign(features, contribution.features);
		}
	}

	// Filter to plugins with mobile config
	const mobilePlugins: AppConfigPlugin[] = [];
	const tabs: PluginMobileTab[] = [];

	for (const plugin of plugins) {
		if (!plugin.mobile) continue;

		mobilePlugins.push({
			id: plugin.id,
			name: plugin.name,
			version: plugin.version,
			mobile: plugin.mobile,
		});

		if (plugin.mobile.tabs) {
			tabs.push(...plugin.mobile.tabs);
		}
	}

	return {
		site: {
			name: siteName,
			url: siteUrl,
			locale: "en",
		},
		theme,
		plugins: mobilePlugins,
		navigation: { tabs },
		features,
	};
}
