import node from "@astrojs/node";
import react from "@astrojs/react";
import { auditLogPlugin } from "@emdash-cms/plugin-audit-log";
import { commercePlugin } from "@emdash-cms/plugin-commerce";
import { commerceShippingBasicPlugin } from "@emdash-cms/plugin-commerce-shipping-basic";
import { commerceStorefrontPlugin } from "@emdash-cms/plugin-commerce-storefront";
import { commerceStripePlugin } from "@emdash-cms/plugin-commerce-stripe";
import { commerceTaxBasicPlugin } from "@emdash-cms/plugin-commerce-tax-basic";
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
			plugins: [
				auditLogPlugin(),
				commercePlugin(),
				commerceStorefrontPlugin(),
				commerceShippingBasicPlugin(),
				commerceTaxBasicPlugin(),
				commerceStripePlugin(),
			],
		}),
	],
	devToolbar: { enabled: false },
});
