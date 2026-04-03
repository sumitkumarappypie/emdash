import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

import { calculateTax } from "./calculate.js";
import type { TaxConfig } from "./calculate.js";

const DEFAULT_CONFIG: TaxConfig = {
	rates: [
		{ country: "US", state: "CA", rate: 8.25, name: "CA Sales Tax" },
		{ country: "US", state: "NY", rate: 8.0, name: "NY Sales Tax" },
	],
};

export default definePlugin({
	hooks: {
		"plugin:install": async (_event: unknown, ctx: PluginContext) => {
			await ctx.kv.set("settings:config", DEFAULT_CONFIG);
			ctx.log.info("Commerce Tax Basic installed with default config");
		},
	},
	routes: {
		calculate: {
			handler: async (
				routeCtx: {
					input: {
						items: Array<{ itemId: string; amount: number }>;
						address: { country: string; state?: string };
					};
				},
				ctx: PluginContext,
			) => {
				const config = (await ctx.kv.get<TaxConfig>("settings:config")) ?? DEFAULT_CONFIG;
				return calculateTax(config, routeCtx.input.items, routeCtx.input.address);
			},
		},
		"admin/config": {
			handler: async (
				routeCtx: { input: { type: string; config?: TaxConfig } },
				ctx: PluginContext,
			) => {
				if (routeCtx.input.type === "get") {
					return (await ctx.kv.get<TaxConfig>("settings:config")) ?? DEFAULT_CONFIG;
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
