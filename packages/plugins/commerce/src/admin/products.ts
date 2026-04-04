import type { PluginContext } from "emdash";

import { createProduct, updateProduct, deleteProduct } from "../products.js";
import { header, table, formatCurrency, formatDate, statusBadge } from "./blocks.js";

export async function buildProductList(ctx: PluginContext) {
	const products = await ctx.storage.products!.query({
		orderBy: { createdAt: "desc" },
		limit: 50,
	});

	const items = products.items.map((i) => i.data as Record<string, unknown>);

	return {
		blocks: [
			header("Products"),
			{
				type: "actions",
				elements: [
					{ type: "button", label: "New Product", action_id: "product:create", style: "primary" },
				],
			},
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
				{ emptyText: "No products yet. Click 'New Product' to create one." },
			),
		],
	};
}

function buildProductForm(existing?: Record<string, unknown>) {
	const isEdit = !!existing;
	return {
		blocks: [
			header(isEdit ? `Edit: ${existing!.name}` : "New Product"),
			{
				type: "form",
				fields: [
					{
						type: "text_input",
						action_id: "name",
						label: "Product Name",
						placeholder: "e.g. Premium Widget",
						initial_value: (existing?.name as string) ?? "",
					},
					{
						type: "text_input",
						action_id: "slug",
						label: "Slug (URL-friendly)",
						placeholder: "e.g. premium-widget",
						initial_value: (existing?.slug as string) ?? "",
					},
					{
						type: "number_input",
						action_id: "basePrice",
						label: "Price",
						initial_value: (existing?.basePrice as number) ?? 0,
						min: 0,
					},
					{
						type: "text_input",
						action_id: "sku",
						label: "SKU",
						placeholder: "e.g. PW-001",
						initial_value: (existing?.sku as string) ?? "",
					},
					{
						type: "select",
						action_id: "status",
						label: "Status",
						options: [
							{ label: "Draft", value: "draft" },
							{ label: "Active", value: "active" },
							{ label: "Archived", value: "archived" },
						],
						initial_value: (existing?.status as string) ?? "draft",
					},
					{
						type: "select",
						action_id: "productType",
						label: "Product Type",
						options: [
							{ label: "Physical", value: "physical" },
							{ label: "Digital", value: "digital" },
							{ label: "Subscription", value: "subscription" },
						],
						initial_value: (existing?.productType as string) ?? "physical",
					},
					{
						type: "text_input",
						action_id: "shortDescription",
						label: "Short Description",
						placeholder: "Brief product summary",
						initial_value: (existing?.shortDescription as string) ?? "",
						multiline: false,
					},
					{
						type: "text_input",
						action_id: "description",
						label: "Description",
						placeholder: "Full product description",
						initial_value: (existing?.description as string) ?? "",
						multiline: true,
					},
					{
						type: "toggle",
						action_id: "trackInventory",
						label: "Track Inventory",
						description: "Enable stock tracking for this product",
						initial_value: (existing?.trackInventory as boolean) ?? false,
					},
					{
						type: "number_input",
						action_id: "inventoryQuantity",
						label: "Stock Quantity",
						initial_value: (existing?.inventoryQuantity as number) ?? 0,
						min: 0,
						condition: { field: "trackInventory", value: true },
					},
					{
						type: "toggle",
						action_id: "isFeatured",
						label: "Featured Product",
						description: "Show this product in featured sections",
						initial_value: (existing?.isFeatured as boolean) ?? false,
					},
				],
				submit: {
					label: isEdit ? "Save Changes" : "Create Product",
					action_id: isEdit ? `product:save:${existing!.id}` : "product:save:new",
				},
			},
			{
				type: "actions",
				elements: [
					{ type: "button", label: "Cancel", action_id: "nav:products" },
					...(isEdit
						? [
								{
									type: "button",
									text: "Delete Product",
									action_id: `product:delete:${existing!.id}`,
									style: "danger",
								},
							]
						: []),
				],
			},
		],
	};
}

function buildProductDetail(p: Record<string, unknown>) {
	return {
		blocks: [
			header(p.name as string),
			{
				type: "fields",
				fields: [
					{ label: "Status", value: statusBadge(p.status as string) },
					{
						label: "Price",
						value: formatCurrency(p.basePrice as number, (p.currency as string) ?? "USD"),
					},
					{ label: "SKU", value: (p.sku as string) || "—" },
					{ label: "Type", value: (p.productType as string) || "physical" },
					{
						label: "Inventory",
						value: p.trackInventory ? String(p.inventoryQuantity) : "Not tracked",
					},
					{ label: "Featured", value: p.isFeatured ? "Yes" : "No" },
				],
			},
			...(p.shortDescription ? [{ type: "section", text: p.shortDescription as string }] : []),
			{
				type: "actions",
				elements: [
					{
						type: "button",
						text: "Edit Product",
						action_id: `product:edit:${p.id}`,
						style: "primary",
					},
					{ type: "button", label: "Back to Products", action_id: "nav:products" },
				],
			},
		],
	};
}

export async function handleProductAction(actionId: string, value: unknown, ctx: PluginContext) {
	// Show create form
	if (actionId === "product:create") {
		return buildProductForm();
	}

	// Show edit form
	if (actionId.startsWith("product:edit:")) {
		const productId = actionId.replace("product:edit:", "");
		const product = await ctx.storage.products!.get(productId);
		if (!product) return { blocks: [{ type: "section", text: "Product not found" }] };
		return buildProductForm(product as Record<string, unknown>);
	}

	// View product detail
	if (actionId.startsWith("product:view:")) {
		const productId = actionId.replace("product:view:", "");
		const product = await ctx.storage.products!.get(productId);
		if (!product) return { blocks: [{ type: "section", text: "Product not found" }] };
		return buildProductDetail(product as Record<string, unknown>);
	}

	// Handle form submission (create or update)
	if (actionId.startsWith("product:save:")) {
		const formValues = value as Record<string, unknown>;
		const productId = actionId.replace("product:save:", "");

		if (productId === "new") {
			// Create new product
			await createProduct(ctx.storage.products!, formValues);
			const list = await buildProductList(ctx);
			return {
				...list,
				toast: { type: "success", message: "Product created successfully" },
			};
		} else {
			// Update existing product
			await updateProduct(ctx.storage.products!, productId, formValues);
			const list = await buildProductList(ctx);
			return {
				...list,
				toast: { type: "success", message: "Product updated successfully" },
			};
		}
	}

	// Delete product
	if (actionId.startsWith("product:delete:")) {
		const productId = actionId.replace("product:delete:", "");
		await deleteProduct(ctx.storage.products!, productId);
		const list = await buildProductList(ctx);
		return {
			...list,
			toast: { type: "success", message: "Product archived" },
		};
	}

	// Default: show list
	return buildProductList(ctx);
}
