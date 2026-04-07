import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";

import { useCart } from "@/providers/CartProvider";
import { useConfig } from "@/providers/ConfigProvider";
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
	const { cart } = useCart();

	return (
		<Tabs
			screenOptions={{
				tabBarActiveTintColor: theme.primary,
				tabBarInactiveTintColor: theme.textMuted,
				tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.surface },
				headerStyle: { backgroundColor: theme.background },
				headerTintColor: theme.text,
			}}
		>
			<Tabs.Screen
				name="index"
				options={{
					title: config?.site.name ?? "Home",
					tabBarIcon: ({ color }) => <FontAwesome name="home" size={22} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="shop"
				options={{
					title: "Shop",
					tabBarIcon: ({ color }) => <FontAwesome name="shopping-bag" size={22} color={color} />,
				}}
			/>
			<Tabs.Screen
				name="cart"
				options={{
					title: "Cart",
					tabBarBadge: cart && cart.itemCount > 0 ? cart.itemCount : undefined,
					tabBarIcon: ({ color }) => <FontAwesome name="shopping-cart" size={22} color={color} />,
				}}
			/>
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
