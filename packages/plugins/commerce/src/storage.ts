import type { PluginStorageConfig } from "emdash";

export type CommerceStorage = PluginStorageConfig & {
	products: {
		indexes: ["slug", "status", "productType", "isFeatured", "createdAt"];
		uniqueIndexes: ["slug"];
	};
	variants: {
		indexes: ["productId", "sku", "status", ["productId", "sortOrder"]];
	};
	categories: {
		indexes: ["slug", "parentId", "sortOrder"];
		uniqueIndexes: ["slug"];
	};
	productCategories: {
		indexes: ["productId", "categoryId", ["productId", "categoryId"]];
	};
	carts: {
		indexes: ["sessionId", "customerId", "expiresAt", "createdAt"];
	};
	cartItems: {
		indexes: ["cartId", ["cartId", "productId"]];
	};
	orders: {
		indexes: [
			"orderNumber",
			"customerId",
			"status",
			"paymentStatus",
			"fulfillmentStatus",
			"createdAt",
			["customerId", "createdAt"],
		];
		uniqueIndexes: ["orderNumber"];
	};
	orderItems: {
		indexes: ["orderId", ["orderId", "fulfillmentStatus"]];
	};
	transactions: {
		indexes: ["orderId", "provider", "providerTransactionId", "createdAt"];
		uniqueIndexes: ["providerTransactionId"];
	};
	customers: {
		indexes: ["email", "userId", "createdAt"];
		uniqueIndexes: ["email"];
	};
	coupons: {
		indexes: ["code", "status", "startsAt", "expiresAt", "createdAt"];
		uniqueIndexes: ["code"];
	};
	orderCounter: {
		indexes: [];
	};
};

export const COMMERCE_STORAGE_CONFIG = {
	products: {
		indexes: ["slug", "status", "productType", "isFeatured", "createdAt"] as const,
		uniqueIndexes: ["slug"] as const,
	},
	variants: {
		indexes: ["productId", "sku", "status", ["productId", "sortOrder"]] as const,
	},
	categories: {
		indexes: ["slug", "parentId", "sortOrder"] as const,
		uniqueIndexes: ["slug"] as const,
	},
	productCategories: {
		indexes: ["productId", "categoryId", ["productId", "categoryId"]] as const,
	},
	carts: {
		indexes: ["sessionId", "customerId", "expiresAt", "createdAt"] as const,
	},
	cartItems: {
		indexes: ["cartId", ["cartId", "productId"]] as const,
	},
	orders: {
		indexes: [
			"orderNumber",
			"customerId",
			"status",
			"paymentStatus",
			"fulfillmentStatus",
			"createdAt",
			["customerId", "createdAt"],
		] as const,
		uniqueIndexes: ["orderNumber"] as const,
	},
	orderItems: {
		indexes: ["orderId", ["orderId", "fulfillmentStatus"]] as const,
	},
	transactions: {
		indexes: ["orderId", "provider", "providerTransactionId", "createdAt"] as const,
		uniqueIndexes: ["providerTransactionId"] as const,
	},
	customers: {
		indexes: ["email", "userId", "createdAt"] as const,
		uniqueIndexes: ["email"] as const,
	},
	coupons: {
		indexes: ["code", "status", "startsAt", "expiresAt", "createdAt"] as const,
		uniqueIndexes: ["code"] as const,
	},
	orderCounter: {
		indexes: [] as const,
	},
} satisfies PluginStorageConfig;
