import node from "@astrojs/node";
import react from "@astrojs/react";
import { auditLogPlugin } from "@emdash-cms/plugin-audit-log";
import { commercePlugin } from "@emdash-cms/plugin-commerce";
import { commerceShippingBasicPlugin } from "@emdash-cms/plugin-commerce-shipping-basic";
import { commerceStripePlugin } from "@emdash-cms/plugin-commerce-stripe";
import { commerceTaxBasicPlugin } from "@emdash-cms/plugin-commerce-tax-basic";
import { commerceStorefront } from "@emdash-cms/plugin-commerce/storefront";
import { defineConfig } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";

export default defineConfig({
	output: "server",
	adapter: node({
		mode: "standalone",
	}),
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	integrations: [
		react(),
		emdash({
			database: sqlite({ url: "file:./data.db" }),
			storage: local({
				directory: "./uploads",
				baseUrl: "/_emdash/api/media/file",
			}),
			runtimeRoutes: ["/shop"],
			plugins: [
				auditLogPlugin(),
				commercePlugin(),
				commerceShippingBasicPlugin(),
				commerceTaxBasicPlugin(),
				commerceStripePlugin(),
			],
		}),
		// Auto-injects /shop, /shop/[slug], /shop/cart, /shop/checkout
		commerceStorefront({ layout: "./src/layouts/Base.astro" }),
	],
	devToolbar: { enabled: false },
});
