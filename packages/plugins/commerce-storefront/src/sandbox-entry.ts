import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

export default definePlugin({
	hooks: {
		"page:fragments": {
			handler: async (_event: unknown, _ctx: PluginContext) => {
				return {
					head: "",
					bodyEnd: "",
				};
			},
		},
	},
	routes: {},
});
