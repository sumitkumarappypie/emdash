import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchPublicContent } from "@/lib/api";
import { useConfig } from "@/providers/ConfigProvider";
import { useTheme } from "@/providers/ThemeProvider";

interface ContentItem {
	id: string;
	title: string;
	slug: string;
	status: string;
	created_at: string;
}

export default function HomeScreen() {
	const theme = useTheme();
	const { config } = useConfig();
	const router = useRouter();

	const { data: pages } = useQuery({
		queryKey: ["public-pages"],
		queryFn: () =>
			fetchPublicContent<{ items: ContentItem[] }>("pages", { limit: 10 }),
	});

	const { data: posts } = useQuery({
		queryKey: ["public-posts"],
		queryFn: () =>
			fetchPublicContent<{ items: ContentItem[] }>("posts", { limit: 10 }),
	});

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

			{pages?.items && pages.items.length > 0 && (
				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: theme.text }]}>Pages</Text>
					{pages.items.map((page) => (
						<Pressable
							key={page.id}
							style={[styles.card, { backgroundColor: theme.surface }]}
						>
							<Text style={[styles.cardTitle, { color: theme.text }]}>
								{page.title}
							</Text>
							<Text style={[styles.cardDate, { color: theme.textMuted }]}>
								{new Date(page.created_at).toLocaleDateString()}
							</Text>
						</Pressable>
					))}
				</View>
			)}

			{posts?.items && posts.items.length > 0 && (
				<View style={styles.section}>
					<Text style={[styles.sectionTitle, { color: theme.text }]}>
						Recent Posts
					</Text>
					{posts.items.map((post) => (
						<Pressable
							key={post.id}
							style={[styles.card, { backgroundColor: theme.surface }]}
						>
							<Text style={[styles.cardTitle, { color: theme.text }]}>
								{post.title}
							</Text>
							<Text style={[styles.cardDate, { color: theme.textMuted }]}>
								{new Date(post.created_at).toLocaleDateString()}
							</Text>
						</Pressable>
					))}
				</View>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	hero: { padding: 24, paddingTop: 40, alignItems: "center", gap: 8 },
	siteName: { fontSize: 28, fontWeight: "800" },
	subtitle: { fontSize: 16 },
	section: { paddingHorizontal: 16, marginTop: 24 },
	sectionTitle: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
	card: {
		padding: 16,
		borderRadius: 12,
		marginBottom: 10,
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	cardTitle: { fontSize: 16, fontWeight: "600", flex: 1 },
	cardDate: { fontSize: 13 },
});
