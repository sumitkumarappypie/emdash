import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

export default function LoginScreen() {
	const theme = useTheme();
	const { login } = useAuth();
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleLogin = async () => {
		setError("");
		setLoading(true);
		try {
			await login(email, password);
			router.back();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Login failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<Text style={[styles.heading, { color: theme.text }]}>Sign In</Text>

			<TextInput
				style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
				placeholder="Email"
				placeholderTextColor={theme.textMuted}
				value={email}
				onChangeText={setEmail}
				keyboardType="email-address"
				autoCapitalize="none"
			/>
			<TextInput
				style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
				placeholder="Password"
				placeholderTextColor={theme.textMuted}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
			/>

			{error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}

			<Pressable
				style={[styles.button, { backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 }]}
				onPress={handleLogin}
				disabled={loading}
			>
				<Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign In"}</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 24, justifyContent: "center", gap: 14 },
	heading: { fontSize: 24, fontWeight: "800", textAlign: "center", marginBottom: 12 },
	input: { borderRadius: 10, padding: 14, fontSize: 16 },
	error: { fontSize: 14, textAlign: "center" },
	button: { borderRadius: 10, padding: 16, alignItems: "center", marginTop: 8 },
	buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
