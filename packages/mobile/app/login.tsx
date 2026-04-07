import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { ApiError } from "@/lib/api";

export default function LoginScreen() {
	const theme = useTheme();
	const router = useRouter();
	const { login, register } = useAuth();

	const [mode, setMode] = useState<"login" | "register">("login");
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async () => {
		setError("");
		setLoading(true);
		try {
			if (mode === "register") {
				await register(email, name, password);
			} else {
				await login(email, password);
			}
			router.back();
		} catch (err) {
			setError(err instanceof ApiError ? err.message : "Something went wrong");
		} finally {
			setLoading(false);
		}
	};

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<Text style={[styles.heading, { color: theme.text }]}>
				{mode === "login" ? "Sign In" : "Create Account"}
			</Text>

			{error ? <Text style={[styles.error, { color: theme.error }]}>{error}</Text> : null}

			{mode === "register" && (
				<TextInput
					style={[styles.input, { color: theme.text, borderColor: theme.surface, backgroundColor: theme.surface }]}
					placeholder="Name"
					placeholderTextColor={theme.textMuted}
					value={name}
					onChangeText={setName}
					autoCapitalize="words"
				/>
			)}

			<TextInput
				style={[styles.input, { color: theme.text, borderColor: theme.surface, backgroundColor: theme.surface }]}
				placeholder="Email"
				placeholderTextColor={theme.textMuted}
				value={email}
				onChangeText={setEmail}
				autoCapitalize="none"
				keyboardType="email-address"
			/>

			<TextInput
				style={[styles.input, { color: theme.text, borderColor: theme.surface, backgroundColor: theme.surface }]}
				placeholder="Password"
				placeholderTextColor={theme.textMuted}
				value={password}
				onChangeText={setPassword}
				secureTextEntry
			/>

			<Pressable
				style={[styles.button, { backgroundColor: theme.primary, opacity: loading ? 0.6 : 1 }]}
				onPress={handleSubmit}
				disabled={loading}
			>
				<Text style={styles.buttonText}>{loading ? "..." : mode === "login" ? "Sign In" : "Create Account"}</Text>
			</Pressable>

			<Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
				<Text style={[styles.switchText, { color: theme.primary }]}>
					{mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
				</Text>
			</Pressable>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, padding: 24, gap: 14 },
	heading: { fontSize: 28, fontWeight: "800", marginBottom: 8 },
	error: { fontSize: 14, padding: 12, borderRadius: 8 },
	input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16 },
	button: { borderRadius: 12, padding: 16, alignItems: "center", marginTop: 8 },
	buttonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
	switchText: { fontSize: 14, textAlign: "center", marginTop: 8 },
});
