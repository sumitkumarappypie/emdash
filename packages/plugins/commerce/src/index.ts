import type { PluginDescriptor } from "emdash";

import { COMMERCE_STORAGE_CONFIG } from "./storage.js";

export type {
	Product,
	Variant,
	Category,
	Cart,
	CartItem,
	Order,
	OrderItem,
	Transaction,
	Customer,
	Coupon,
	Address,
	ShippingRate,
	TaxResult,
	PaymentCreateResult,
} from "./types.js";

export function commercePlugin(): PluginDescriptor {
	return {
		id: "commerce",
		version: "0.1.0",
		format: "standard",
		entrypoint: "@emdash-cms/plugin-commerce/sandbox",
		capabilities: ["read:content", "write:content", "email:send", "menus:manage"],
		storage: COMMERCE_STORAGE_CONFIG,
		adminPages: [{ path: "/", label: "Commerce", icon: "shopping-cart" }],
		adminWidgets: [
			{ id: "revenue", title: "Revenue", size: "half" },
			{ id: "recent-orders", title: "Recent Orders", size: "half" },
		],
	};
}
