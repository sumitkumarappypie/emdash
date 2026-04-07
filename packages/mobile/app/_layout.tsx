import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/providers/AuthProvider";
import { CartProvider } from "@/providers/CartProvider";
import { ConfigProvider, useConfig } from "@/providers/ConfigProvider";
import { ThemeProvider, useTheme } from "@/providers/ThemeProvider";
import { LoadingScreen } from "@/components/LoadingScreen";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5 * 60 * 1000,
			retry: 2,
		},
	},
});

function AppContent() {
	const { loading, error } = useConfig();
	const theme = useTheme();

	if (loading) return <LoadingScreen />;

	if (error) {
		// Config failed — show basic app anyway
		console.warn("Failed to load app config:", error);
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
				<Stack.Screen name="product/[slug]" options={{ title: "" }} />
				<Stack.Screen name="checkout" options={{ title: "Checkout" }} />
				<Stack.Screen name="plugin/[id]" options={{ title: "" }} />
			</Stack>
		</>
	);
}

export default function RootLayout() {
	return (
		<QueryClientProvider client={queryClient}>
			<ConfigProvider>
				<ThemeProvider>
					<AuthProvider>
						<CartProvider>
							<AppContent />
						</CartProvider>
					</AuthProvider>
				</ThemeProvider>
			</ConfigProvider>
		</QueryClientProvider>
	);
}
