import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { fetchAppConfig, setBaseUrl } from "@/lib/api";
import type { AppConfig } from "@/lib/types";

interface ConfigContextValue {
	config: AppConfig | null;
	loading: boolean;
	error: string | null;
	reload: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue>({
	config: null,
	loading: true,
	error: null,
	reload: async () => {},
});

export function useConfig(): ConfigContextValue {
	return useContext(ConfigContext);
}

const SITE_URL = process.env.EXPO_PUBLIC_EMDASH_URL ?? "http://localhost:4321";

export function ConfigProvider({ children }: { children: ReactNode }) {
	const [config, setConfig] = useState<AppConfig | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const load = async () => {
		try {
			setLoading(true);
			setError(null);
			setBaseUrl(SITE_URL);
			const data = await fetchAppConfig();
			setConfig(data);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load config");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	return (
		<ConfigContext.Provider value={{ config, loading, error, reload: load }}>
			{children}
		</ConfigContext.Provider>
	);
}
