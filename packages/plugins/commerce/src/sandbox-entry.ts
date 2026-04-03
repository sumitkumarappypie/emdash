import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

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

	routes: {},
});
