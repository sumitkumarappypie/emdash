import { createContext, useContext, useMemo, type ReactNode } from "react";
import { TamaguiProvider, Theme } from "tamagui";

import tamaguiConfig from "@/lib/tamagui.config";
import type { ThemeColors } from "@/lib/types";
import { useConfig } from "./ConfigProvider";

const DEFAULT_THEME: ThemeColors = {
	primary: "#3B82F6",
	secondary: "#6366F1",
	background: "#FFFFFF",
	surface: "#F9FAFB",
	text: "#111827",
	textMuted: "#6B7280",
	error: "#EF4444",
	success: "#10B981",
};

const ThemeContext = createContext<ThemeColors>(DEFAULT_THEME);

export function useTheme(): ThemeColors {
	return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
	const { config } = useConfig();
	const theme = config?.theme ?? DEFAULT_THEME;

	// Build a dynamic Tamagui theme override from /app/config colors
	const tamaguiThemeOverride = useMemo(
		() => ({
			background: theme.background,
			backgroundHover: theme.surface,
			backgroundPress: theme.surface,
			color: theme.text,
			colorHover: theme.text,
			colorPress: theme.text,
			borderColor: theme.surface,
			placeholderColor: theme.textMuted,
			primary: theme.primary,
			secondary: theme.secondary,
			surface: theme.surface,
			textMuted: theme.textMuted,
			error: theme.error,
			success: theme.success,
		}),
		[theme],
	);

	return (
		<TamaguiProvider
			config={tamaguiConfig}
			defaultTheme="light"
			themeOverride={tamaguiThemeOverride}
		>
			<ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
		</TamaguiProvider>
	);
}
