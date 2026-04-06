/**
 * App Bridge script injection for EmDash mobile app WebViews.
 *
 * Provides `window.emdash` SDK that communicates with the native shell
 * via `postMessage` and exposes helpers for navigation, theming, haptics, etc.
 */

/**
 * Check whether the incoming request originates from the EmDash mobile app.
 * Looks for `EmDashApp/` in the User-Agent or the `X-EmDash-App: 1` header.
 */
export function isMobileAppRequest(request: Request): boolean {
	const ua = request.headers.get("User-Agent") || "";
	if (ua.includes("EmDashApp/")) return true;
	if (request.headers.get("X-EmDash-App") === "1") return true;
	return false;
}

/**
 * Returns the JavaScript source for the App Bridge that gets injected into
 * HTML pages served to the mobile app WebView.
 *
 * Uses regular function syntax (not arrow functions) for older WebView compat.
 */
export function getAppBridgeScript(): string {
	return `(function() {
	if (window.__emdashBridgeInitialized) return;
	window.__emdashBridgeInitialized = true;

	var _id = 0;
	var _callbacks = {};

	function send(type, payload) {
		var msg = JSON.stringify({ type: type, payload: payload || {} });
		if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
			window.ReactNativeWebView.postMessage(msg);
		}
	}

	function sendWithCallback(type, payload) {
		return new Promise(function(resolve) {
			var id = ++_id;
			_callbacks[id] = resolve;
			var msg = JSON.stringify({ type: type, id: id, payload: payload || {} });
			if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
				window.ReactNativeWebView.postMessage(msg);
			}
		});
	}

	// Listen for responses from the native shell
	window.addEventListener("message", function(event) {
		try {
			var data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
			if (data && data.__emdashResponse && data.id && _callbacks[data.id]) {
				_callbacks[data.id](data.result);
				delete _callbacks[data.id];
			}
		} catch (e) {
			// Ignore non-bridge messages
		}
	});

	// Apply theme CSS variables from native shell config
	var bridgeConfig = window.__EMDASH_BRIDGE__ || {};
	if (bridgeConfig.theme && typeof bridgeConfig.theme === "object") {
		var root = document.documentElement;
		var keys = Object.keys(bridgeConfig.theme);
		for (var i = 0; i < keys.length; i++) {
			root.style.setProperty(keys[i], bridgeConfig.theme[keys[i]]);
		}
	}

	window.emdash = {
		navigate: function(url, options) {
			send("navigate", { url: url, options: options });
		},
		dismiss: function() {
			send("dismiss");
		},
		setTitle: function(title) {
			send("setTitle", { title: title });
		},
		toast: function(message, options) {
			send("toast", { message: message, options: options });
		},
		confirm: function(message, options) {
			return sendWithCallback("confirm", { message: message, options: options });
		},
		updateCartBadge: function(count) {
			send("updateCartBadge", { count: count });
		},
		getAuth: function() {
			return sendWithCallback("getAuth");
		},
		share: function(data) {
			return sendWithCallback("share", data);
		},
		haptic: function(style) {
			send("haptic", { style: style || "light" });
		},
		ready: function() {
			send("ready");
		},
		context: bridgeConfig.context || {}
	};
})();`;
}
