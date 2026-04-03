import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

import { calculateShippingRates } from "./rates.js";
import type { ShippingConfig } from "./rates.js";

const DEFAULT_CONFIG: ShippingConfig = {
	methods: [
		{
			id: "standard",
			name: "Standard Shipping",
			type: "flat_rate",
			price: 5.99,
			currency: "USD",
			estimatedDays: 5,
		},
		{
			id: "free",
			name: "Free Shipping",
			type: "free_over",
			threshold: 50,
			currency: "USD",
			estimatedDays: 7,
		},
	],
};

export default definePlugin({
	hooks: {
		"plugin:install": async (_event: unknown, ctx: PluginContext) => {
			await ctx.kv.set("settings:config", DEFAULT_CONFIG);
			ctx.log.info("Commerce Shipping Basic installed with default config");
		},
	},
	routes: {
		rates: {
			public: true,
			handler: async (
				routeCtx: { input: { subtotal: number; currency: string } },
				ctx: PluginContext,
			) => {
				const config = (await ctx.kv.get<ShippingConfig>("settings:config")) ?? DEFAULT_CONFIG;
				return calculateShippingRates(config, routeCtx.input);
			},
		},
		"admin/config": {
			handler: async (
				routeCtx: { input: { type: string; config?: ShippingConfig } },
				ctx: PluginContext,
			) => {
				if (routeCtx.input.type === "get") {
					return (await ctx.kv.get<ShippingConfig>("settings:config")) ?? DEFAULT_CONFIG;
				}
				if (routeCtx.input.type === "set" && routeCtx.input.config) {
					await ctx.kv.set("settings:config", routeCtx.input.config);
					return { success: true };
				}
				return { success: false };
			},
		},
	},
});
