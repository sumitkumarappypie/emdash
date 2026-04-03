import type { PluginDescriptor } from "emdash";

export function commerceStorefrontPlugin(): PluginDescriptor {
	return {
		id: "commerce-storefront",
		version: "0.1.0",
		format: "standard",
		entrypoint: "@emdash-cms/plugin-commerce-storefront/sandbox",
		capabilities: ["page:inject"],
		storage: {},
		adminPages: [],
	};
}
