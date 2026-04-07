import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useConfig } from "@/providers/ConfigProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function HomeScreen() {
	const theme = useTheme();
	const { config } = useConfig();
	const router = useRouter();

	return (
		<ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
			<View style={styles.hero}>
				<Text style={[styles.siteName, { color: theme.text }]}>
					{config?.site.name ?? "EmDash"}
				</Text>
				<Text style={[styles.subtitle, { color: theme.textMuted }]}>
					Welcome to your store
				</Text>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	hero: { padding: 24, paddingTop: 40, alignItems: "center", gap: 8 },
	siteName: { fontSize: 28, fontWeight: "800" },
	subtitle: { fontSize: 16 },
});
