import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

import { createPaymentIntent, createRefund } from "./client.js";
import { verifyWebhookSignature, parseStripeEvent } from "./webhook.js";

interface RouteCtx {
	input: Record<string, unknown>;
	request: { url: string };
}

export default definePlugin({
	hooks: {
		"plugin:install": async (_event: unknown, ctx: PluginContext) => {
			ctx.log.info("Commerce Stripe plugin installed");
		},

		"plugin:activate": async (_event: unknown, ctx: PluginContext) => {
			ctx.log.info("Commerce Stripe plugin activated");
		},
	},

	routes: {
		"payment/create": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const secretKey = await ctx.kv.get<string>("settings:secret_key");
				if (!secretKey) {
					return { success: false, error: "Stripe secret key not configured" };
				}

				const fetchFn = ctx.http?.fetch ?? fetch;
				const result = await createPaymentIntent(fetchFn, secretKey, {
					amount: routeCtx.input.amount as number,
					currency: routeCtx.input.currency as string,
					metadata: routeCtx.input.metadata as Record<string, string> | undefined,
				});

				return { success: true, paymentIntent: result };
			},
		},

		"payment/refund": {
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const secretKey = await ctx.kv.get<string>("settings:secret_key");
				if (!secretKey) {
					return { success: false, error: "Stripe secret key not configured" };
				}

				const fetchFn = ctx.http?.fetch ?? fetch;
				const result = await createRefund(fetchFn, secretKey, {
					paymentIntentId: routeCtx.input.paymentIntentId as string,
					amount: routeCtx.input.amount as number | undefined,
				});

				return { success: true, refund: result };
			},
		},

		webhook: {
			public: true,
			handler: async (routeCtx: RouteCtx, ctx: PluginContext) => {
				const webhookSecret = await ctx.kv.get<string>("settings:webhook_secret");
				if (!webhookSecret) {
					return { success: false, error: "Webhook secret not configured" };
				}

				const payload = routeCtx.input.payload as string;
				const signature = routeCtx.input.signature as string;

				const valid = await verifyWebhookSignature(payload, signature, webhookSecret);
				if (!valid) {
					return { success: false, error: "Invalid webhook signature" };
				}

				const event = parseStripeEvent(payload);
				ctx.log.info(`Stripe webhook received: ${event.type}`);

				return { success: true, event };
			},
		},

		"admin/config": {
			handler: async (
				routeCtx: { input: { type: string; secretKey?: string; webhookSecret?: string } },
				ctx: PluginContext,
			) => {
				if (routeCtx.input.type === "get") {
					const secretKey = await ctx.kv.get<string>("settings:secret_key");
					const webhookSecret = await ctx.kv.get<string>("settings:webhook_secret");
					return {
						configured: !!secretKey,
						hasWebhookSecret: !!webhookSecret,
					};
				}
				if (routeCtx.input.type === "set") {
					if (routeCtx.input.secretKey) {
						await ctx.kv.set("settings:secret_key", routeCtx.input.secretKey);
					}
					if (routeCtx.input.webhookSecret) {
						await ctx.kv.set("settings:webhook_secret", routeCtx.input.webhookSecret);
					}
					return { success: true };
				}
				return { success: false };
			},
		},
	},
});
