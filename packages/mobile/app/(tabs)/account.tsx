import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function AccountScreen() {
	const theme = useTheme();
	const { customer, logout } = useAuth();
	const router = useRouter();

	if (!customer) {
		return (
			<View style={[styles.container, { backgroundColor: theme.background }]}>
				<Text style={[styles.heading, { color: theme.text }]}>Account</Text>
				<Text style={[styles.subtitle, { color: theme.textMuted }]}>
					Sign in to view your orders and manage your account.
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
			<Text style={[styles.heading, { color: theme.text }]}>{customer.name}</Text>
			<Text style={[styles.subtitle, { color: theme.textMuted }]}>{customer.email}</Text>

			<Pressable
				style={[styles.outlineButton, { borderColor: theme.error }]}
				onPress={async () => {
					await logout();
				}}
			>
				<Text style={[styles.outlineText, { color: theme.error }]}>Sign Out</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 24, gap: 12 },
	heading: { fontSize: 24, fontWeight: "800" },
	subtitle: { fontSize: 15 },
	button: { borderRadius: 12, padding: 16, alignItems: "center", marginTop: 16 },
	buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
	outlineButton: {
		borderRadius: 12,
		padding: 16,
		alignItems: "center",
		marginTop: 24,
		borderWidth: 1,
	},
	outlineText: { fontSize: 17, fontWeight: "600" },
});
