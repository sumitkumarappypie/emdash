import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

import { commerceNav } from "./admin/blocks.js";
import { buildCategoryPage, handleCategoryAction } from "./admin/categories.js";
import { buildCouponList, handleCouponAction } from "./admin/coupons.js";
import { buildCustomerList } from "./admin/customers.js";
import { buildDashboard, buildRevenueWidget, buildRecentOrdersWidget } from "./admin/dashboard.js";
import { buildOrderList, handleOrderAction } from "./admin/orders.js";
import { buildProductList, handleProductAction } from "./admin/products.js";
import { buildSettingsPage, handleSettingsAction } from "./admin/settings.js";
import {
	createCart,
	getCart,
	addCartItem,
	updateCartItemQuantity,
	removeCartItem,
	getCartItems,
	recalculateCart,
	mergeCarts,
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
import { dispatchCommerceEvent } from "./hooks.js";
import {
	getOrder,
	getOrderItems,
	listOrders,
	updateOrderStatus,
	fulfillOrder,
	refundOrder,
} from "./orders.js";
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

// Standard format: route handlers receive two args (routeCtx, pluginCtx)
// via adapt-sandbox-entry.ts which splits the RouteContext.
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
			// Schedule daily cart cleanup
			if (ctx.cron) {
				await ctx.cron.schedule("cleanup-expired-carts", {
					schedule: "0 3 * * *", // Daily at 3 AM
				});
			}
		},

		cron: {
			handler: async (event: { name: string }, ctx: PluginContext) => {
				if (event.name === "cleanup-expired-carts") {
					const now = new Date().toISOString();
					// Query carts and check expiry in app code since storage may not support $lt
					const result = await ctx.storage.carts!.query({ limit: 100 });
					let cleaned = 0;
					for (const cart of result.items) {
						const cartData = cart.data as Record<string, unknown>;
						if (cartData.expiresAt && (cartData.expiresAt as string) < now) {
							const cartItems = await ctx.storage.cartItems!.query({
								where: { cartId: cart.id },
								limit: 1000,
							});
							for (const item of cartItems.items) {
								await ctx.storage.cartItems!.delete(item.id);
							}
							await ctx.storage.carts!.delete(cart.id);
							cleaned++;
						}
					}
					ctx.log.info(`Cleaned up ${cleaned} expired carts`);
				}
			},
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
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
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

		"cart/merge": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const merged = await mergeCarts(
					ctx.storage.carts!,
					ctx.storage.cartItems!,
					routeCtx.input.sourceCartId as string,
					routeCtx.input.targetCartId as string,
				);
				await recalculateCart(ctx.storage.carts!, ctx.storage.cartItems!, merged.id);
				return merged;
			},
		},

		"checkout/create": {
			public: true,
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const order = await createOrderFromCart(
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
				// Generate confirmation token for public order lookup
				const confirmationToken = crypto.randomUUID();
				await ctx.kv.set(`state:order-token:${order.id}`, confirmationToken);

				await dispatchCommerceEvent(ctx, {
					type: "commerce:order:created",
					order,
				});
				return { ...order, confirmationToken };
			},
		},

		"orders/confirmation": {
			public: true,
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const storedToken = await ctx.kv.get<string>(
					`state:order-token:${routeCtx.input.orderId as string}`,
				);
				if (!storedToken || storedToken !== routeCtx.input.token) {
					return { error: "UNAUTHORIZED", message: "Invalid confirmation token" };
				}
				const order = await getOrder(ctx.storage.orders!, routeCtx.input.orderId as string);
				if (!order) return null;
				const items = await getOrderItems(ctx.storage.orderItems!, order.id);
				return { ...order, items };
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
				const product = await createProduct(ctx.storage.products!, routeCtx.input);
				await dispatchCommerceEvent(ctx, {
					type: "commerce:product:afterSave",
					product,
				});
				return product;
			},
		},

		"admin/products/get": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return getProduct(ctx.storage.products!, routeCtx.input.id as string);
			},
		},

		"admin/products/update": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const product = await updateProduct(
					ctx.storage.products!,
					routeCtx.input.id as string,
					routeCtx.input,
				);
				if (product) {
					await dispatchCommerceEvent(ctx, {
						type: "commerce:product:afterSave",
						product,
					});
				}
				return product;
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
				const existing = await getOrder(ctx.storage.orders!, routeCtx.input.id as string);
				const previousStatus = existing?.status ?? "pending";
				const updated = await updateOrderStatus(
					ctx.storage.orders!,
					routeCtx.input.id as string,
					routeCtx.input.status as string,
				);
				if (updated) {
					await dispatchCommerceEvent(ctx, {
						type: "commerce:order:statusChanged",
						order: updated,
						previousStatus,
					});
				}
				return updated;
			},
		},

		"admin/orders/refund": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const refunded = await refundOrder(
					ctx.storage.orders!,
					ctx.storage.transactions!,
					routeCtx.input.id as string,
					routeCtx.input as { amount?: number; reason?: string },
					{ orderItems: ctx.storage.orderItems!, products: ctx.storage.products! },
				);
				await dispatchCommerceEvent(ctx, {
					type: "commerce:order:refunded",
					order: refunded,
					amount: (routeCtx.input.amount as number) ?? refunded.total,
				});
				return refunded;
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
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				return getProviderRegistry(ctx.kv);
			},
		},

		admin: {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const { type, page, action_id, value } = routeCtx.input as Record<string, string>;

				// Helper to prepend nav bar to page content
				async function withNav(
					tab: string,
					builder: (c: PluginContext) => Promise<{ blocks: unknown[] }>,
				) {
					const result = await builder(ctx);
					return { blocks: [commerceNav(tab), ...result.blocks] };
				}

				// Widget renders (no nav)
				if (type === "page_load") {
					if (page === "widget:revenue") return buildRevenueWidget(ctx);
					if (page === "widget:recent-orders") return buildRecentOrdersWidget(ctx);
					// Default page load → dashboard with nav
					return withNav("dashboard", buildDashboard);
				}

				if (type === "block_action" || type === "form_submit") {
					// Form submissions pass values in the 'values' field
					const actionValue =
						type === "form_submit" ? (routeCtx.input as Record<string, unknown>).values : value;

					// Navigation between sub-pages
					if (action_id?.startsWith("nav:")) {
						const tab = action_id.replace("nav:", "");
						switch (tab) {
							case "dashboard":
								return withNav("dashboard", buildDashboard);
							case "products":
								return withNav("products", buildProductList);
							case "orders":
								return withNav("orders", buildOrderList);
							case "categories":
								return withNav("categories", buildCategoryPage);
							case "customers":
								return withNav("customers", buildCustomerList);
							case "coupons":
								return withNav("coupons", buildCouponList);
							case "settings":
								return withNav("settings", buildSettingsPage);
						}
					}

					// Sub-page actions (pass form values for form_submit)
					if (action_id?.startsWith("product:"))
						return handleProductAction(action_id, actionValue, ctx);
					if (action_id?.startsWith("order:")) return handleOrderAction(action_id, value, ctx);
					if (action_id?.startsWith("category:"))
						return handleCategoryAction(action_id, value, ctx);
					if (action_id?.startsWith("coupon:")) return handleCouponAction(action_id, value, ctx);
					if (action_id?.startsWith("settings:"))
						return handleSettingsAction(action_id, value, ctx);
				}

				return { blocks: [] };
			},
		},
	},
});
