import { useNavigation, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

import { useAuth } from "@/providers/AuthProvider";
import { useConfig } from "@/providers/ConfigProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useCart } from "@/providers/CartProvider";
import { LoadingScreen } from "./LoadingScreen";

interface WebViewScreenProps {
	url: string;
	title?: string;
}

interface BridgeMessage {
	type: string;
	id: string;
	method: string;
	params: Record<string, unknown>;
}

export function WebViewScreen({ url, title }: WebViewScreenProps) {
	const theme = useTheme();
	const { config } = useConfig();
	const { token } = useAuth();
	const { cart } = useCart();
	const router = useRouter();
	const navigation = useNavigation();
	const webViewRef = useRef<WebView>(null);

	useEffect(() => {
		if (title) {
			navigation.setOptions({ title });
		}
	}, [title, navigation]);

	const siteUrl = config?.site.url ?? "";
	const fullUrl = url.startsWith("http") ? url : `${siteUrl}${url}`;

	// Bridge context injected before page loads
	const bridgeContext = JSON.stringify({
		version: 1,
		auth: { customerToken: token },
		theme,
		site: config?.site ?? { name: "", url: "", locale: "en" },
		device: {
			platform: Platform.OS,
			colorScheme: "light",
			safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
		},
		cart: cart ? { id: cart.id, itemCount: cart.itemCount } : null,
	});

	const injectedJS = `window.__EMDASH_BRIDGE__ = ${bridgeContext}; true;`;

	const handleMessage = (event: WebViewMessageEvent) => {
		try {
			const data: BridgeMessage = JSON.parse(event.nativeEvent.data);
			if (data.type !== "emdash-bridge") return;

			switch (data.method) {
				case "navigate":
					router.push(data.params.screen as string);
					break;
				case "dismiss":
					router.back();
					break;
				case "setTitle":
					navigation.setOptions({ title: data.params.title as string });
					break;
				case "toast":
					// Phase 2: native toast
					console.log("[Bridge Toast]", data.params.message);
					break;
				case "updateCartBadge":
					// Phase 2: update tab badge
					break;
				case "getAuth":
					sendResponse(data.id, { customerToken: token });
					break;
				case "ready":
					// Page loaded
					break;
				default:
					console.log("[Bridge] Unknown method:", data.method);
			}
		} catch {
			// Ignore non-bridge messages
		}
	};

	const sendResponse = (id: string, result: unknown) => {
		const js = `window.postMessage(${JSON.stringify({
			type: "emdash-bridge-response",
			id,
			result,
		})});`;
		webViewRef.current?.injectJavaScript(js);
	};

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<WebView
				ref={webViewRef}
				source={{
					uri: fullUrl,
					headers: {
						"X-EmDash-App": "1",
						"User-Agent": `EmDashApp/1.0 (${Platform.OS})`,
					},
				}}
				injectedJavaScriptBeforeContentLoaded={injectedJS}
				onMessage={handleMessage}
				startInLoadingState
				renderLoading={() => <LoadingScreen />}
				style={styles.webview}
				allowsBackForwardNavigationGestures
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	webview: { flex: 1 },
});
