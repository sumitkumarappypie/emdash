import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect } from "react";
import { Text, View } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getScreen } from "@/lib/registry";
import { useAuth } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { usePlugin } from "@/providers/PluginProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function PluginTabScreen() {
	const { plugin: screenId } = useLocalSearchParams<{ plugin: string }>();
	const theme = useTheme();
	const { token } = useAuth();
	const { config } = useConfig();
	const { setActivePlugin, updatePluginBadge } = usePlugin();
	const router = useRouter();

	// Find which plugin owns this screen
	const ownerPlugin = config?.plugins.find((p) =>
		p.mobile?.tabs?.some((t) => t.screen === screenId),
	);

	// Set active plugin for contextual cart icon
	useEffect(() => {
		setActivePlugin(ownerPlugin ?? null);
		return () => setActivePlugin(null);
	}, [ownerPlugin, setActivePlugin]);

	const navigate = useCallback(
		(screen: string, params?: Record<string, string>) => {
			const query = params ? `?${new URLSearchParams(params).toString()}` : "";
			router.push(`/screen/${screen}${query}` as any);
		},
		[router],
	);

	const goBack = useCallback(() => {
		router.back();
	}, [router]);

	const handleUpdateCartBadge = useCallback(
		(count: number) => {
			if (ownerPlugin) {
				updatePluginBadge(ownerPlugin.id, count);
			}
		},
		[ownerPlugin, updatePluginBadge],
	);

	if (!screenId) {
		return (
			<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
				<Text style={{ color: theme.textMuted }}>No screen specified</Text>
			</View>
		);
	}

	const Screen = getScreen(screenId);
	if (!Screen) {
		return (
			<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
				<Text style={{ color: theme.textMuted }}>Screen not found: {screenId}</Text>
			</View>
		);
	}

	return (
		<ErrorBoundary>
			<Screen
				theme={theme}
				navigate={navigate}
				goBack={goBack}
				params={{}}
				authToken={token}
				updateCartBadge={handleUpdateCartBadge}
			/>
		</ErrorBoundary>
	);
}
