export interface AppConfig {
	site: {
		name: string;
		url: string;
		locale: string;
	};
	theme: ThemeColors;
	plugins: AppPlugin[];
	navigation: {
		tabs: AppTab[];
	};
	features: Record<string, boolean>;
}

export interface ThemeColors {
	primary: string;
	secondary: string;
	background: string;
	surface: string;
	text: string;
	textMuted: string;
	error: string;
	success: string;
}

export interface AppPlugin {
	id: string;
	name: string;
	version: string;
	mobile?: PluginMobileConfig;
}

export interface PluginMobileConfig {
	native?: boolean;
	entryUrl?: string;
	label?: string;
	icon?: string;
	tabs?: AppTab[];
	supportsCart?: boolean;
	cartScreen?: string;
	cartBadgeKey?: string;
}

export interface AppTab {
	key: string;
	label: string;
	icon: string;
	screen: string;
	badge?: string;
}

export interface Customer {
	id: string;
	email: string;
	name: string;
	status: string;
	created_at: string;
}

export interface AuthState {
	customer: Customer | null;
	token: string | null;
	loading: boolean;
}
