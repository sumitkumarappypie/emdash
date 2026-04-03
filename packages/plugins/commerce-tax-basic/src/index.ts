import type { PluginDescriptor } from "emdash";

export function commerceTaxBasicPlugin(): PluginDescriptor {
	return {
		id: "commerce-tax-basic",
		version: "0.1.0",
		format: "standard",
		entrypoint: "@emdash-cms/plugin-commerce-tax-basic/sandbox",
		capabilities: [],
		storage: {},
		adminPages: [],
	};
}
