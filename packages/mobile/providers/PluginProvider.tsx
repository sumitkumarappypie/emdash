import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

import { getBaseUrl, getAuthToken } from "@/lib/api";
import { initializePlugin } from "@/lib/registry";
import type { AppPlugin } from "@/lib/types";

import { useConfig } from "./ConfigProvider";

interface PluginState {
	cartBadge: number;
}

interface PluginContextValue {
	activePlugin: AppPlugin | null;
	setActivePlugin: (plugin: AppPlugin | null) => void;
	pluginState: Record<string, PluginState>;
	updatePluginBadge: (pluginId: string, count: number) => void;
}

const PluginContext = createContext<PluginContextValue>({
	activePlugin: null,
	setActivePlugin: () => {},
	pluginState: {},
	updatePluginBadge: () => {},
});

export function usePlugin(): PluginContextValue {
	return useContext(PluginContext);
}

export function PluginProvider({ children }: { children: ReactNode }) {
	const { config } = useConfig();
	const [activePlugin, setActivePlugin] = useState<AppPlugin | null>(null);
	const [pluginState, setPluginState] = useState<Record<string, PluginState>>({});

	// Initialize plugin API clients when config loads
	useEffect(() => {
		if (!config) return;

		const baseUrl = getBaseUrl();

		for (const plugin of config.plugins) {
			if (plugin.mobile?.native) {
				initializePlugin(plugin.id, baseUrl, () => getAuthToken());
			}
		}
	}, [config]);

	const updatePluginBadge = useCallback((pluginId: string, count: number) => {
		setPluginState((prev) => ({
			...prev,
			[pluginId]: { ...prev[pluginId], cartBadge: count },
		}));
	}, []);

	const value = useMemo(
		() => ({ activePlugin, setActivePlugin, pluginState, updatePluginBadge }),
		[activePlugin, pluginState, updatePluginBadge],
	);

	return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}
