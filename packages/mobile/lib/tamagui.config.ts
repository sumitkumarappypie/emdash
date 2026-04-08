import { createInterFont } from "@tamagui/font-inter";
import { shorthands } from "@tamagui/shorthands";
import { themes, tokens } from "@tamagui/config/v3";
import { createTamagui } from "tamagui";

const interFont = createInterFont();

// Custom theme that will be overridden at runtime by /app/config colors
const emdashLightTheme = {
	...themes.light,
	background: "#FFFFFF",
	backgroundHover: "#F9FAFB",
	backgroundPress: "#F3F4F6",
	color: "#111827",
	colorHover: "#111827",
	colorPress: "#111827",
	borderColor: "#E5E7EB",
	placeholderColor: "#6B7280",
	// Semantic tokens (custom)
	primary: "#3B82F6",
	primaryHover: "#2563EB",
	secondary: "#6366F1",
	surface: "#F9FAFB",
	textMuted: "#6B7280",
	error: "#EF4444",
	success: "#10B981",
};

const emdashDarkTheme = {
	...themes.dark,
	background: "#111827",
	backgroundHover: "#1F2937",
	backgroundPress: "#374151",
	color: "#F9FAFB",
	colorHover: "#F9FAFB",
	colorPress: "#F9FAFB",
	borderColor: "#374151",
	placeholderColor: "#9CA3AF",
	primary: "#60A5FA",
	primaryHover: "#3B82F6",
	secondary: "#818CF8",
	surface: "#1F2937",
	textMuted: "#9CA3AF",
	error: "#F87171",
	success: "#34D399",
};

export const tamaguiConfig = createTamagui({
	defaultTheme: "light",
	shouldAddPrefersColorThemes: true,
	themeClassNameOnRoot: true,
	shorthands,
	fonts: {
		heading: interFont,
		body: interFont,
	},
	themes: {
		light: emdashLightTheme,
		dark: emdashDarkTheme,
	},
	tokens,
});

export default tamaguiConfig;

// Type export for Tamagui
export type AppConfig = typeof tamaguiConfig;

declare module "tamagui" {
	interface TamaguiCustomConfig extends AppConfig {}
}
