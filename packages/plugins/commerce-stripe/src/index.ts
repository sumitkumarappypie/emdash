import type { PluginDescriptor } from "emdash";

export function commerceStripePlugin(): PluginDescriptor {
	return {
		id: "commerce-stripe",
		version: "0.1.0",
		format: "standard",
		entrypoint: "@emdash-cms/plugin-commerce-stripe/sandbox",
		capabilities: ["network:fetch"],
		allowedHosts: ["api.stripe.com"],
		storage: {},
		adminPages: [],
	};
}
