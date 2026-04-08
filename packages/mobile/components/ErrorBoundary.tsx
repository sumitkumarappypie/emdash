import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
	onReset?: () => void;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("ErrorBoundary caught:", error, info.componentStack);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null });
		this.props.onReset?.();
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) return this.props.fallback;
			return (
				<View style={styles.container}>
					<Text style={styles.title}>Something went wrong</Text>
					<Text style={styles.message}>{this.state.error?.message}</Text>
					<Pressable style={styles.button} onPress={this.handleReset}>
						<Text style={styles.buttonText}>Try Again</Text>
					</Pressable>
				</View>
			);
		}
		return this.props.children;
	}
}

const styles = StyleSheet.create({
	container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
	title: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 8 },
	message: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24 },
	button: { backgroundColor: "#3B82F6", paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
	buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
