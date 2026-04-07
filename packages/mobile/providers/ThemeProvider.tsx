import { createContext, useContext, type ReactNode } from "react";
import { StyleSheet } from "react-native";

import { useConfig } from "./ConfigProvider";
import type { ThemeColors } from "@/lib/types";

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

	return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

// Helper to create themed styles
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(
	factory: (theme: ThemeColors) => T,
): T {
	const theme = useTheme();
	return StyleSheet.create(factory(theme));
}
