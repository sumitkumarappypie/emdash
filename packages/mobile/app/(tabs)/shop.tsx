import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";

import { fetchProducts } from "@/lib/api";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ProductCard } from "@/components/ProductCard";
import { useTheme } from "@/providers/ThemeProvider";

export default function ShopScreen() {
	const theme = useTheme();
	const router = useRouter();

	const { data, isLoading } = useQuery({
		queryKey: ["products"],
		queryFn: () => fetchProducts({ limit: 20 }),
	});

	if (isLoading) return <LoadingScreen />;

	return (
		<View style={[styles.container, { backgroundColor: theme.background }]}>
			<FlatList
				data={data?.items ?? []}
				numColumns={2}
				keyExtractor={(item) => item.id}
				contentContainerStyle={styles.list}
				renderItem={({ item }) => (
					<ProductCard
						product={item}
						onPress={() => router.push(`/product/${item.slug}`)}
					/>
				)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	list: { padding: 6 },
});
