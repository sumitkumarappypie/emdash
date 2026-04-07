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
	native: boolean;
	mobile?: {
		native?: boolean;
		entryUrl?: string;
		label?: string;
		icon?: string;
		tabs?: AppTab[];
	};
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

export interface Product {
	id: string;
	slug: string;
	name: string;
	description?: string;
	price: number;
	compareAtPrice?: number;
	images: string[];
	status: string;
	productType: string;
	variants?: ProductVariant[];
}

export interface ProductVariant {
	id: string;
	name: string;
	sku?: string;
	price: number;
	inventoryQuantity: number;
}

export interface CartItem {
	id: string;
	productId: string;
	variantId?: string;
	name: string;
	variantName?: string;
	image?: string;
	quantity: number;
	unitPrice: number;
	total: number;
}

export interface Cart {
	id: string;
	items: CartItem[];
	subtotal: number;
	itemCount: number;
}

export interface ListResponse<T> {
	items: T[];
	nextCursor?: string;
}
