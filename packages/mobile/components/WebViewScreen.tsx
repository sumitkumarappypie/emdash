import { useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { WebView } from "react-native-webview";

import { getAuthToken, getBaseUrl } from "@/lib/api";

interface WebViewScreenProps {
	entryUrl: string;
	pluginId: string;
	screen?: string;
	params?: Record<string, string>;
	onNavigate?: (screen: string, params?: Record<string, string>) => void;
}

export function WebViewScreen({
	entryUrl,
	pluginId,
	screen,
	params,
	onNavigate,
}: WebViewScreenProps) {
	const webviewRef = useRef<WebView>(null);
	const baseUrl = getBaseUrl();
	const token = getAuthToken();

	const queryParams = new URLSearchParams({
		pluginId,
		...(screen && { screen }),
		...params,
	}).toString();

	const url = `${baseUrl}${entryUrl}${queryParams ? `?${queryParams}` : ""}`;

	const injectedJS = `
		window.__EMDASH__ = {
			authToken: ${JSON.stringify(token)},
			pluginId: ${JSON.stringify(pluginId)},
			navigate: function(screen, params) {
				window.ReactNativeWebView.postMessage(JSON.stringify({
					type: "navigate",
					screen: screen,
					params: params || {}
				}));
			}
		};
		true;
	`;

	const handleMessage = (event: { nativeEvent: { data: string } }) => {
		try {
			const data = JSON.parse(event.nativeEvent.data) as {
				type: string;
				screen: string;
				params?: Record<string, string>;
			};
			if (data.type === "navigate" && onNavigate) {
				onNavigate(data.screen, data.params);
			}
		} catch {
			// Ignore malformed messages
		}
	};

	return (
		<View style={{ flex: 1 }}>
			<WebView
				ref={webviewRef}
				source={{ uri: url }}
				injectedJavaScriptBeforeContentLoaded={injectedJS}
				onMessage={handleMessage}
				startInLoadingState
				renderLoading={() => (
					<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
						<ActivityIndicator size="large" />
					</View>
				)}
			/>
		</View>
	);
}
