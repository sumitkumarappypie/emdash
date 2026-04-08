import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
	name: process.env.APP_NAME || "EmDash",
	slug: process.env.APP_SLUG || "emdash-mobile",
	version: process.env.APP_VERSION || "0.1.0",
	scheme: process.env.APP_SCHEME || "emdash",
	orientation: "portrait",
	userInterfaceStyle: "automatic",
	newArchEnabled: true,
	icon: process.env.APP_ICON || "./assets/icon.png",
	splash: {
		image: process.env.APP_SPLASH || "./assets/splash.png",
		resizeMode: "contain",
		backgroundColor: process.env.APP_SPLASH_BG || "#ffffff",
	},
	ios: {
		supportsTablet: true,
		bundleIdentifier: process.env.APP_IOS_BUNDLE || "com.emdash.mobile",
	},
	android: {
		adaptiveIcon: {
			foregroundImage: process.env.APP_ANDROID_ICON || "./assets/adaptive-icon.png",
			backgroundColor: process.env.APP_SPLASH_BG || "#ffffff",
		},
		package: process.env.APP_ANDROID_PACKAGE || "com.emdash.mobile",
	},
	plugins: ["expo-router", "expo-secure-store"],
	experiments: {
		typedRoutes: true,
	},
};

export default { expo: config };
