import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { Text, View } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getScreen } from "@/lib/registry";
import { useAuth } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { usePlugin } from "@/providers/PluginProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function PluginScreen() {
	const params = useLocalSearchParams<{ id: string } & Record<string, string>>();
	const { id: screenId, ...screenParams } = params;
	const theme = useTheme();
	const { token } = useAuth();
	const { config } = useConfig();
	const { updatePluginBadge } = usePlugin();
	const router = useRouter();

	// Find owner plugin from screen ID prefix (e.g., "commerce:cart" → "commerce")
	const pluginId = screenId?.split(":")[0];
	const ownerPlugin = config?.plugins.find((p) => p.id === pluginId);

	const navigate = useCallback(
		(screen: string, navParams?: Record<string, string>) => {
			const query = navParams ? `?${new URLSearchParams(navParams).toString()}` : "";
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
				params={screenParams as Record<string, string>}
				authToken={token}
				updateCartBadge={handleUpdateCartBadge}
			/>
		</ErrorBoundary>
	);
}
