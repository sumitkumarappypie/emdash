import type { PluginContext } from "emdash";

import { header, table, button, formatCurrency, formatDate, statusBadge } from "./blocks.js";

export async function buildProductList(ctx: PluginContext) {
	const products = await ctx.storage.products!.query({
		orderBy: { createdAt: "desc" },
		limit: 50,
	});

	const items = products.items.map((i) => i.data as Record<string, unknown>);

	return {
		blocks: [
			header("Products"),
			button("New Product", "product:create", undefined, "primary"),
			table(
				[
					{ key: "name", label: "Name" },
					{ key: "sku", label: "SKU" },
					{ key: "price", label: "Price" },
					{ key: "status", label: "Status", format: "badge" },
					{ key: "inventory", label: "Inventory" },
					{ key: "date", label: "Date" },
				],
				items.map((p) => ({
					name: p.name as string,
					sku: (p.sku as string) || "—",
					price: formatCurrency(p.basePrice as number, (p.currency as string) ?? "USD"),
					status: statusBadge(p.status as string),
					inventory: p.trackInventory ? String(p.inventoryQuantity) : "—",
					date: formatDate(p.createdAt as string),
				})),
				{ emptyText: "No products yet" },
			),
		],
	};
}

export async function handleProductAction(
	actionId: string,
	value: string | undefined,
	ctx: PluginContext,
) {
	if (actionId === "product:view" && value) {
		const product = await ctx.storage.products!.get(value);
		if (!product) return { blocks: [{ type: "section", text: "Product not found" }] };

		const p = product as Record<string, unknown>;
		return {
			blocks: [
				header(p.name as string),
				{
					type: "section",
					fields: [
						{ type: "mrkdwn", text: `*Status:* ${statusBadge(p.status as string)}` },
						{
							type: "mrkdwn",
							text: `*Price:* ${formatCurrency(p.basePrice as number, (p.currency as string) ?? "USD")}`,
						},
						{ type: "mrkdwn", text: `*SKU:* ${(p.sku as string) || "—"}` },
						{
							type: "mrkdwn",
							text: `*Inventory:* ${p.trackInventory ? String(p.inventoryQuantity) : "Not tracked"}`,
						},
					],
				},
				button("Back to Products", "product:list"),
			],
		};
	}

	return buildProductList(ctx);
}
