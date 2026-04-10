/**
 * Commerce Plugin — Mobile Screen Registry
 *
 * Exports all native screens that the mobile shell can render.
 * The shell imports this registry and maps screen identifiers to components.
 */

import type { ComponentType } from "react";

import CartScreen from "./screens/Cart";
import CheckoutScreen from "./screens/Checkout";
import ProductDetailScreen from "./screens/ProductDetail";
import ProductListScreen from "./screens/ProductList";
import type { PluginScreenProps } from "./types";

export { configureCommerceApi } from "./api/client";
export type { PluginScreenProps } from "./types";

/**
 * Screen registry for the commerce plugin.
 *
 * Keys match the screen identifiers declared in the plugin's mobile config
 * (e.g., "commerce:product-list" in PluginMobileConfig.tabs[].screen).
 */
export const screens: Record<string, ComponentType<PluginScreenProps>> = {
	"commerce:product-list": ProductListScreen,
	"commerce:product-detail": ProductDetailScreen,
	"commerce:cart": CartScreen,
	"commerce:checkout": CheckoutScreen,
};
