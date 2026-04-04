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
				["Name", "SKU", "Price", "Status", "Inventory", "Date"],
				items.map((p) => [
					p.name as string,
					(p.sku as string) || "—",
					formatCurrency(p.basePrice as number, (p.currency as string) ?? "USD"),
					statusBadge(p.status as string),
					p.trackInventory ? String(p.inventoryQuantity) : "—",
					formatDate(p.createdAt as string),
				]),
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
