import { useLocalSearchParams } from "expo-router";

import { WebViewScreen } from "@/components/WebViewScreen";
import { useConfig } from "@/providers/ConfigProvider";

export default function PluginScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const { config } = useConfig();

	const plugin = config?.plugins.find((p) => p.id === id);
	const entryUrl = plugin?.mobile?.entryUrl ?? "/";
	const title = plugin?.mobile?.label ?? plugin?.name ?? "Plugin";

	return <WebViewScreen url={entryUrl} title={title} />;
}
