import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";

interface PriceDisplayProps {
	price: number;
	compareAtPrice?: number;
	currency?: string;
	size?: "small" | "medium" | "large";
}

export function PriceDisplay({ price, compareAtPrice, currency = "USD", size = "medium" }: PriceDisplayProps) {
	const theme = useTheme();
	const fontSize = size === "small" ? 14 : size === "large" ? 24 : 18;

	const formatted = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(price);

	const compareFormatted = compareAtPrice
		? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(compareAtPrice)
		: null;

	return (
		<View style={styles.container}>
			<Text style={[styles.price, { color: theme.text, fontSize }]}>{formatted}</Text>
			{compareFormatted && (
				<Text style={[styles.comparePrice, { color: theme.textMuted, fontSize: fontSize - 4 }]}>
					{compareFormatted}
				</Text>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flexDirection: "row", alignItems: "baseline", gap: 6 },
	price: { fontWeight: "700" },
	comparePrice: { textDecorationLine: "line-through" },
});
