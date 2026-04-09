/**
 * Commerce Plugin Mobile Screen Props
 *
 * All plugin screens receive these props from the shell.
 * The shell provides infrastructure; the plugin handles business logic.
 */

export interface PluginScreenProps {
	/** Theme colors from the shell */
	theme: {
		primary: string;
		secondary: string;
		background: string;
		surface: string;
		text: string;
		textMuted: string;
		error: string;
		success: string;
	};
	/** Navigate to another screen */
	navigate: (screen: string, params?: Record<string, string>) => void;
	/** Go back */
	goBack: () => void;
	/** Route params passed to this screen */
	params: Record<string, string>;
	/** Auth token (if customer is logged in) */
	authToken: string | null;
	/** Request the shell to show the login screen. Resolves true if login succeeded. */
	requestLogin: () => Promise<boolean>;
	/** Update the cart badge count displayed in the header */
	updateCartBadge: (count: number) => void;
}

export type { Product, ProductVariant, Cart, CartItem } from "./api/types";
