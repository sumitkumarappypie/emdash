import type { PluginDescriptor } from "emdash";

export function commerceShippingBasicPlugin(): PluginDescriptor {
	return {
		id: "commerce-shipping-basic",
		version: "0.1.0",
		format: "standard",
		entrypoint: "@emdash-cms/plugin-commerce-shipping-basic/sandbox",
		capabilities: [],
		storage: {},
		adminPages: [],
	};
}
