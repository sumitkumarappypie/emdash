import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

import {
	createCart,
	getCart,
	addCartItem,
	updateCartItemQuantity,
	removeCartItem,
	getCartItems,
	recalculateCart,
} from "./cart.js";
import {
	createCategory,
	listCategories,
	updateCategory,
	deleteCategory,
	getCategoryTree,
} from "./categories.js";
import { createOrderFromCart } from "./checkout.js";
import { createCoupon, listCoupons, updateCoupon } from "./coupons.js";
import { getCustomer, listCustomers } from "./customers.js";
import { getOrder, getOrderItems, listOrders, updateOrderStatus, fulfillOrder } from "./orders.js";
import {
	createProduct,
	getProduct,
	getProductBySlug,
	listProducts,
	updateProduct,
	deleteProduct,
} from "./products.js";
import { registerProvider, unregisterProvider, getProviderRegistry } from "./providers.js";
import { getTransactionsByOrder } from "./transactions.js";
import { createVariant, listVariantsByProduct, updateVariant, deleteVariant } from "./variants.js";

interface RouteCtx {
	input: Record<string, unknown>;
}

export default definePlugin({
	hooks: {
		"plugin:install": async (_event: unknown, ctx: PluginContext) => {
			ctx.log.info("Commerce plugin installed");
			// Initialize order counter
			await ctx.storage.orderCounter!.put("current", { value: 1000 });
		},

		"plugin:activate": async (_event: unknown, ctx: PluginContext) => {
			ctx.log.info("Commerce plugin activated");
		},
	},

	routes: {
		// ── Public storefront routes ─────────────────────────────────────

		"products/list": {
			public: true,
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return listProducts(ctx.storage.products!, {
					...routeCtx.input,
					status: "active",
				});
			},
		},

		"products/get": {
			public: true,
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const product = await getProductBySlug(
					ctx.storage.products!,
					routeCtx.input.slug as string,
				);
				if (!product) return null;
				const variants = await listVariantsByProduct(ctx.storage.variants!, product.id);
				return { ...product, variants };
			},
		},

		"categories/tree": {
			public: true,
			handler: async (_routeCtx: RouteCtx, ctx: PluginContext) => {
				return getCategoryTree(ctx.storage.categories!);
			},
		},

		"cart/create": {
			public: true,
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return createCart(ctx.storage.carts!, routeCtx.input);
			},
		},

		"cart/get": {
			public: true,
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const cart = await getCart(ctx.storage.carts!, routeCtx.input.cartId as string);
				if (!cart) return null;
				const items = await getCartItems(ctx.storage.cartItems!, cart.id);
				return { ...cart, items };
			},
		},

		"cart/add-item": {
			public: true,
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const item = await addCartItem(
					ctx.storage.carts!,
					ctx.storage.cartItems!,
					ctx.storage.products!,
					ctx.storage.variants!,
					routeCtx.input.cartId as string,
					routeCtx.input as {
						productId: string;
						variantId?: string | null;
						quantity: number;
						metadata?: Record<string, unknown>;
					},
				);
				await recalculateCart(
					ctx.storage.carts!,
					ctx.storage.cartItems!,
					routeCtx.input.cartId as string,
				);
				return item;
			},
		},

		"cart/update-item": {
			public: true,
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const item = await updateCartItemQuantity(
					ctx.storage.cartItems!,
					routeCtx.input.itemId as string,
					routeCtx.input.quantity as number,
				);
				if (item) {
					await recalculateCart(ctx.storage.carts!, ctx.storage.cartItems!, item.cartId);
				}
				return item;
			},
		},

		"cart/remove-item": {
			public: true,
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const cartItemStorage = ctx.storage.cartItems!;
				const existing = await cartItemStorage.get(routeCtx.input.itemId as string);
				const removed = await removeCartItem(cartItemStorage, routeCtx.input.itemId as string);
				if (removed && existing) {
					await recalculateCart(
						ctx.storage.carts!,
						cartItemStorage,
						(existing as Record<string, unknown>).cartId as string,
					);
				}
				return { removed };
			},
		},

		"checkout/create": {
			public: true,
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return createOrderFromCart(
					{
						carts: ctx.storage.carts!,
						cartItems: ctx.storage.cartItems!,
						orders: ctx.storage.orders!,
						orderItems: ctx.storage.orderItems!,
						products: ctx.storage.products!,
						variants: ctx.storage.variants!,
						customers: ctx.storage.customers!,
						orderCounter: ctx.storage.orderCounter!,
					},
					routeCtx.input.cartId as string,
					routeCtx.input as {
						email: string;
						name: string;
						paymentProvider: string;
						customerNotes?: string;
					},
				);
			},
		},

		// ── Admin routes ─────────────────────────────────────────────────

		"admin/products/list": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return listProducts(ctx.storage.products!, routeCtx.input);
			},
		},

		"admin/products/create": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return createProduct(ctx.storage.products!, routeCtx.input);
			},
		},

		"admin/products/get": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return getProduct(ctx.storage.products!, routeCtx.input.id as string);
			},
		},

		"admin/products/update": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return updateProduct(ctx.storage.products!, routeCtx.input.id as string, routeCtx.input);
			},
		},

		"admin/products/delete": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return deleteProduct(ctx.storage.products!, routeCtx.input.id as string);
			},
		},

		"admin/variants/create": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return createVariant(
					ctx.storage.variants!,
					routeCtx.input.productId as string,
					routeCtx.input,
				);
			},
		},

		"admin/variants/list": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return listVariantsByProduct(ctx.storage.variants!, routeCtx.input.productId as string);
			},
		},

		"admin/variants/update": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return updateVariant(ctx.storage.variants!, routeCtx.input.id as string, routeCtx.input);
			},
		},

		"admin/variants/delete": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return deleteVariant(ctx.storage.variants!, routeCtx.input.id as string);
			},
		},

		"admin/categories/list": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return listCategories(ctx.storage.categories!, routeCtx.input);
			},
		},

		"admin/categories/create": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return createCategory(ctx.storage.categories!, routeCtx.input);
			},
		},

		"admin/categories/update": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return updateCategory(ctx.storage.categories!, routeCtx.input.id as string, routeCtx.input);
			},
		},

		"admin/categories/delete": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return deleteCategory(ctx.storage.categories!, routeCtx.input.id as string);
			},
		},

		"admin/orders/list": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return listOrders(ctx.storage.orders!, routeCtx.input);
			},
		},

		"admin/orders/get": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const order = await getOrder(ctx.storage.orders!, routeCtx.input.id as string);
				if (!order) return null;
				const items = await getOrderItems(ctx.storage.orderItems!, order.id);
				const transactions = await getTransactionsByOrder(ctx.storage.transactions!, order.id);
				return { ...order, items, transactions };
			},
		},

		"admin/orders/status": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return updateOrderStatus(
					ctx.storage.orders!,
					routeCtx.input.id as string,
					routeCtx.input.status as string,
				);
			},
		},

		"admin/orders/fulfill": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return fulfillOrder(
					ctx.storage.orders!,
					ctx.storage.orderItems!,
					routeCtx.input.id as string,
					routeCtx.input as {
						itemIds: string[];
						trackingNumber?: string;
						trackingUrl?: string;
					},
				);
			},
		},

		"admin/customers/list": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return listCustomers(ctx.storage.customers!, routeCtx.input);
			},
		},

		"admin/customers/get": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return getCustomer(ctx.storage.customers!, routeCtx.input.id as string);
			},
		},

		"admin/coupons/list": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return listCoupons(ctx.storage.coupons!, routeCtx.input);
			},
		},

		"admin/coupons/create": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return createCoupon(ctx.storage.coupons!, routeCtx.input);
			},
		},

		"admin/coupons/update": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return updateCoupon(ctx.storage.coupons!, routeCtx.input.id as string, routeCtx.input);
			},
		},

		"providers/register": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				await registerProvider(
					ctx.kv,
					routeCtx.input.type as "payment" | "shipping" | "tax",
					routeCtx.input.providerId as string,
				);
				return { success: true };
			},
		},

		"providers/unregister": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				await unregisterProvider(
					ctx.kv,
					routeCtx.input.type as "payment" | "shipping" | "tax",
					routeCtx.input.providerId as string,
				);
				return { success: true };
			},
		},

		"providers/list": {
			handler: async (_routeCtx: RouteCtx, ctx: PluginContext) => {
				return getProviderRegistry(ctx.kv);
			},
		},

		admin: {
			handler: async (_routeCtx: RouteCtx, _ctx: PluginContext) => {
				return {
					blocks: [{ type: "header", text: "Commerce Dashboard" }],
				};
			},
		},
	},
});
