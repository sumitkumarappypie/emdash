import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function AccountScreen() {
	const theme = useTheme();
	const { customer, loading, logout } = useAuth();
	const router = useRouter();

	if (loading) {
		return (
			<View style={[styles.container, { backgroundColor: theme.background }]}>
				<Text style={{ color: theme.textMuted }}>Loading...</Text>
			</View>
		);
	}

	if (!customer) {
		return (
			<View style={[styles.container, { backgroundColor: theme.background }]}>
				<Text style={[styles.heading, { color: theme.text }]}>Account</Text>
				<Text style={[styles.subtitle, { color: theme.textMuted }]}>
					Sign in to manage your account
				</Text>
				<Pressable
					style={[styles.button, { backgroundColor: theme.primary }]}
					onPress={() => router.push("/login")}
				>
					<Text style={styles.buttonText}>Sign In</Text>
				</Pressable>
			</View>
		);
	}

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<Text style={[styles.heading, { color: theme.text }]}>Account</Text>
			<View style={[styles.card, { backgroundColor: theme.surface }]}>
				<Text style={[styles.name, { color: theme.text }]}>{customer.name}</Text>
				<Text style={{ color: theme.textMuted }}>{customer.email}</Text>
			</View>
			<Pressable
				style={[styles.button, { backgroundColor: theme.error }]}
				onPress={logout}
			>
				<Text style={styles.buttonText}>Sign Out</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 },
	heading: { fontSize: 24, fontWeight: "800" },
	subtitle: { fontSize: 15, textAlign: "center" },
	card: { padding: 20, borderRadius: 12, width: "100%", alignItems: "center", gap: 4 },
	name: { fontSize: 18, fontWeight: "700" },
	button: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10 },
	buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
