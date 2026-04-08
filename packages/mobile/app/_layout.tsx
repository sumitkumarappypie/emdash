import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/providers/AuthProvider";
import { ConfigProvider, useConfig } from "@/providers/ConfigProvider";
import { PluginProvider } from "@/providers/PluginProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Pressable, StyleSheet, Text, View } from "react-native";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5 * 60 * 1000,
			retry: 2,
		},
	},
});

function AppContent() {
	const { loading, error, reload } = useConfig();
	const theme = useTheme();

	if (loading) return <LoadingScreen />;

	if (error) {
		return (
			<View style={[styles.errorContainer, { backgroundColor: theme.background }]}>
				<Text style={[styles.errorTitle, { color: theme.text }]}>Could not connect</Text>
				<Text style={[styles.errorMessage, { color: theme.textMuted }]}>{error}</Text>
				<Pressable style={[styles.retryButton, { backgroundColor: theme.primary }]} onPress={reload}>
					<Text style={styles.retryText}>Retry</Text>
				</Pressable>
			</View>
		);
	}

	return (
		<>
			<StatusBar style="auto" />
			<Stack
				screenOptions={{
					headerStyle: { backgroundColor: theme.background },
					headerTintColor: theme.text,
					contentStyle: { backgroundColor: theme.background },
				}}
			>
				<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
				<Stack.Screen name="login" options={{ title: "Sign In", presentation: "modal" }} />
				<Stack.Screen name="screen/[id]" options={{ title: "" }} />
			</Stack>
		</>
	);
}

export default function RootLayout() {
	return (
		<ErrorBoundary>
			<QueryClientProvider client={queryClient}>
				<ConfigProvider>
					<ThemeProvider>
						<AuthProvider>
							<PluginProvider>
								<AppContent />
							</PluginProvider>
						</AuthProvider>
					</ThemeProvider>
				</ConfigProvider>
			</QueryClientProvider>
		</ErrorBoundary>
	);
}

const styles = StyleSheet.create({
	errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
	errorTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
	errorMessage: { fontSize: 14, textAlign: "center", marginBottom: 24 },
	retryButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
	retryText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
