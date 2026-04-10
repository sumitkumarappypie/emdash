import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Text, View } from "react-native";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WebViewScreen } from "@/components/WebViewScreen";
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

	// Pending login promise — resolved when auth state changes after login
	const loginResolveRef = useRef<((success: boolean) => void) | null>(null);

	useEffect(() => {
		if (token && loginResolveRef.current) {
			loginResolveRef.current(true);
			loginResolveRef.current = null;
		}
	}, [token]);

	// Find owner plugin from screen ID prefix (e.g., "commerce:cart" → "commerce")
	const pluginId = screenId?.split(":")[0];
	const ownerPlugin = config?.plugins.find((p) => p.id === pluginId);

	const navigate = useCallback(
		(screen: string, navParams?: Record<string, string>) => {
			router.push({
				pathname: "/screen/[id]",
				params: { id: screen, ...navParams },
			} as any);
		},
		[router],
	);

	const goBack = useCallback(() => {
		router.back();
	}, [router]);

	const requestLogin = useCallback((): Promise<boolean> => {
		if (token) return Promise.resolve(true);
		return new Promise((resolve) => {
			loginResolveRef.current = resolve;
			router.push("/login" as any);
			setTimeout(() => {
				if (loginResolveRef.current === resolve) {
					loginResolveRef.current = null;
					resolve(false);
				}
			}, 120_000);
		});
	}, [token, router]);

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
		if (ownerPlugin && !ownerPlugin.mobile?.native && ownerPlugin.mobile?.entryUrl) {
			return (
				<WebViewScreen
					entryUrl={ownerPlugin.mobile.entryUrl}
					pluginId={ownerPlugin.id}
					screen={screenId}
					params={screenParams as Record<string, string>}
					onNavigate={navigate}
				/>
			);
		}

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
				requestLogin={requestLogin}
				updateCartBadge={handleUpdateCartBadge}
			/>
		</ErrorBoundary>
	);
}
