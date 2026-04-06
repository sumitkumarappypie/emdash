import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { AstroIntegration } from "astro";

export interface CommerceStorefrontOptions {
	/** Base path for shop routes. Default: "/shop" */
	basePath?: string;
	/**
	 * Path to your site's layout component. The layout must accept a `title` prop
	 * and render a `<slot />` for page content.
	 *
	 * Example: `"./src/layouts/Base.astro"`
	 *
	 * If not provided, uses a minimal built-in layout.
	 */
	layout?: string;
}

const VIRTUAL_MODULE_ID = "virtual:commerce-storefront/config";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_MODULE_ID}`;

/**
 * Astro integration that injects shop pages.
 *
 * ```ts
 * import { commerceStorefront } from "@emdash-cms/plugin-commerce/storefront";
 *
 * export default defineConfig({
 *   integrations: [
 *     emdash({ plugins: [commercePlugin()] }),
 *     commerceStorefront({
 *       layout: "./src/layouts/Base.astro",
 *     }),
 *   ],
 * });
 * ```
 */
export function commerceStorefront(options: CommerceStorefrontOptions = {}): AstroIntegration {
	const basePath = options.basePath ?? "/shop";

	return {
		name: "@emdash-cms/plugin-commerce/storefront",
		hooks: {
			"astro:config:setup": ({ injectRoute, updateConfig, config }) => {
				const __dirname = dirname(fileURLToPath(import.meta.url));

				// Resolve the layout path
				const defaultLayout = resolve(__dirname, "layouts", "ShopLayout.astro");
				const layoutPath = options.layout
					? resolve(config.root ? fileURLToPath(config.root) : process.cwd(), options.layout)
					: defaultLayout;

				// Register virtual module so route files can import the configured layout
				updateConfig({
					vite: {
						plugins: [
							{
								name: "commerce-storefront-virtual",
								resolveId(id: string) {
									if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_ID;
								},
								load(id: string) {
									if (id === RESOLVED_VIRTUAL_ID) {
										return `export { default as Layout } from ${JSON.stringify(layoutPath)};`;
									}
								},
							},
						],
					},
				});

				function resolveRoute(file: string): string {
					return resolve(__dirname, "routes", file);
				}

				injectRoute({ pattern: basePath, entrypoint: resolveRoute("shop.astro") });
				injectRoute({ pattern: `${basePath}/[slug]`, entrypoint: resolveRoute("product.astro") });
				injectRoute({ pattern: `${basePath}/cart`, entrypoint: resolveRoute("cart.astro") });
				injectRoute({
					pattern: `${basePath}/checkout`,
					entrypoint: resolveRoute("checkout.astro"),
				});
				injectRoute({ pattern: `${basePath}/login`, entrypoint: resolveRoute("login.astro") });
				injectRoute({
					pattern: `${basePath}/register`,
					entrypoint: resolveRoute("register.astro"),
				});
				injectRoute({ pattern: `${basePath}/account`, entrypoint: resolveRoute("account.astro") });
				injectRoute({
					pattern: `${basePath}/account/order/[id]`,
					entrypoint: resolveRoute("order.astro"),
				});
			},
		},
	};
}
