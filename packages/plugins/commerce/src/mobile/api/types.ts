/**
 * Commerce Plugin Mobile Types
 *
 * Types used by the commerce plugin's mobile screens.
 * These mirror the server-side types but are optimized for mobile consumption.
 */

export interface Product {
	id: string;
	slug: string;
	name: string;
	description?: string;
	shortDescription?: string;
	basePrice: number;
	compareAtPrice?: number | null;
	currency?: string;
	images: string[];
	status: string;
	productType: string;
	sku?: string;
	inventoryQuantity?: number;
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
