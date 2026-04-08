import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs, useRouter } from "expo-router";
import { Pressable } from "react-native";

import { useConfig } from "@/providers/ConfigProvider";
import { usePlugin } from "@/providers/PluginProvider";
import { useTheme } from "@/providers/ThemeProvider";

const ICON_MAP: Record<string, keyof typeof FontAwesome.glyphMap> = {
	home: "home",
	store: "shopping-bag",
	cart: "shopping-cart",
	user: "user",
	gift: "gift",
	search: "search",
	heart: "heart",
	star: "star",
	list: "list",
};

function getIcon(name: string): keyof typeof FontAwesome.glyphMap {
	return ICON_MAP[name] ?? "circle";
}

export default function TabLayout() {
	const theme = useTheme();
	const { config } = useConfig();
	const { activePlugin, pluginState } = usePlugin();
	const router = useRouter();

	// Find the cart-supporting plugin for the header cart icon
	const cartPlugin = activePlugin?.mobile?.supportsCart ? activePlugin : null;
	const cartBadge = cartPlugin ? pluginState[cartPlugin.id]?.cartBadge ?? 0 : 0;

	// Gather plugin tabs from config
	const pluginTabs = config?.plugins
		.flatMap((p) => (p.mobile?.tabs ?? []).map((tab) => ({ ...tab, pluginId: p.id })))
		?? [];

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: theme.primary,
				tabBarInactiveTintColor: theme.textMuted,
				tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.surface },
				headerStyle: { backgroundColor: theme.background },
				headerTintColor: theme.text,
				headerRight: cartPlugin
					? () => (
							<Pressable
								onPress={() =>
									router.push(`/screen/${cartPlugin.mobile!.cartScreen}` as any)
								}
								style={{ marginRight: 16 }}
							>
								<FontAwesome name="shopping-cart" size={22} color={theme.text} />
								{cartBadge > 0 && (
									<FontAwesome name="circle" size={8} color={theme.primary} style={{ position: "absolute", top: -2, right: -4 }} />
								)}
							</Pressable>
						)
					: undefined,
			}}
		>
			{/* Home tab — always first */}
			<Tabs.Screen
				name="index"
				options={{
					title: config?.site.name ?? "Home",
					tabBarIcon: ({ color }) => <FontAwesome name="home" size={22} color={color} />,
				}}
			/>

			{/* Plugin tabs — dynamic from config */}
			{pluginTabs.map((tab) => (
				<Tabs.Screen
					key={tab.key}
					name={`[plugin]`}
					options={{
						title: tab.label,
						tabBarIcon: ({ color }) => (
							<FontAwesome name={getIcon(tab.icon)} size={22} color={color} />
						),
						href: { pathname: "/(tabs)/[plugin]", params: { plugin: tab.screen } },
					}}
				/>
			))}

			{/* Account tab — always last */}
			<Tabs.Screen
				name="account"
				options={{
					title: "Account",
					tabBarIcon: ({ color }) => <FontAwesome name="user" size={22} color={color} />,
				}}
			/>
		</Tabs>
	);
}
