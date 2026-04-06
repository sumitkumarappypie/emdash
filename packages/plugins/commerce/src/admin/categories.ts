import type { PluginContext } from "emdash";

import type { CategoryNode } from "../categories.js";
import { createCategory, updateCategory, deleteCategory, getCategoryTree } from "../categories.js";
import { header, button } from "./blocks.js";

export async function buildCategoryPage(ctx: PluginContext) {
	const tree = await getCategoryTree(ctx.storage.categories!);

	function renderTree(nodes: CategoryNode[], depth = 0): Array<Record<string, unknown>> {
		const blocks: Array<Record<string, unknown>> = [];
		for (const node of nodes) {
			const indent = "\u00A0\u00A0".repeat(depth);
			blocks.push({
				type: "section",
				text: `${indent}${depth > 0 ? "\u2514 " : ""}**${node.name}** (${node.slug})`,
				accessory: button("Edit", `category:edit:${node.id}`),
			});
			if (node.children.length > 0) {
				blocks.push(...renderTree(node.children, depth + 1));
			}
		}
		return blocks;
	}

	const treeBlocks = renderTree(tree);

	return {
		blocks: [
			header("Categories"),
			{
				type: "actions",
				elements: [
					{ type: "button", label: "New Category", action_id: "category:create", style: "primary" },
				],
			},
			...(treeBlocks.length > 0
				? treeBlocks
				: [{ type: "section", text: "No categories yet. Click 'New Category' to create one." }]),
		],
	};
}

async function buildCategoryForm(ctx: PluginContext, existing?: Record<string, unknown>) {
	const isEdit = !!existing;
	// Get flat list for parent dropdown
	const tree = await getCategoryTree(ctx.storage.categories!);
	function flatten(nodes: CategoryNode[], depth = 0): Array<{ label: string; value: string }> {
		const result: Array<{ label: string; value: string }> = [];
		for (const node of nodes) {
			if (isEdit && node.id === existing!.id) continue;
			result.push({ label: "\u00A0\u00A0".repeat(depth) + node.name, value: node.id });
			result.push(...flatten(node.children, depth + 1));
		}
		return result;
	}
	const parentOptions = [{ label: "None (top level)", value: "" }, ...flatten(tree)];

	return {
		blocks: [
			header(isEdit ? `Edit: ${existing!.name}` : "New Category"),
			{
				type: "form",
				fields: [
					{
						type: "text_input",
						action_id: "name",
						label: "Category Name",
						placeholder: "e.g. Electronics",
						initial_value: (existing?.name as string) ?? "",
					},
					{
						type: "text_input",
						action_id: "slug",
						label: "Slug",
						placeholder: "e.g. electronics",
						initial_value: (existing?.slug as string) ?? "",
					},
					{
						type: "text_input",
						action_id: "description",
						label: "Description",
						placeholder: "Category description",
						initial_value: (existing?.description as string) ?? "",
						multiline: true,
					},
					{
						type: "select",
						action_id: "parentId",
						label: "Parent Category",
						options: parentOptions,
						initial_value: (existing?.parentId as string) ?? "",
					},
					{
						type: "number_input",
						action_id: "sortOrder",
						label: "Sort Order",
						initial_value: (existing?.sortOrder as number) ?? 0,
						min: 0,
					},
				],
				submit: {
					label: isEdit ? "Save Changes" : "Create Category",
					action_id: isEdit ? `category:save:${existing!.id}` : "category:save:new",
				},
			},
			{
				type: "actions",
				elements: [
					{ type: "button", label: "Cancel", action_id: "nav:categories" },
					...(isEdit
						? [
								{
									type: "button",
									label: "Delete Category",
									action_id: `category:delete:${existing!.id}`,
									style: "danger",
								},
							]
						: []),
				],
			},
		],
	};
}

export async function handleCategoryAction(actionId: string, value: unknown, ctx: PluginContext) {
	if (actionId === "category:create") {
		return buildCategoryForm(ctx);
	}

	if (actionId.startsWith("category:edit:")) {
		const id = actionId.replace("category:edit:", "");
		const category = await ctx.storage.categories!.get(id);
		if (!category) return { blocks: [{ type: "section", text: "Category not found" }] };
		return buildCategoryForm(ctx, category as Record<string, unknown>);
	}

	if (actionId.startsWith("category:save:")) {
		const formValues = value as Record<string, unknown>;
		const id = actionId.replace("category:save:", "");
		// Convert empty parentId to null
		if (formValues.parentId === "") formValues.parentId = null;

		if (id === "new") {
			await createCategory(ctx.storage.categories!, formValues);
			const list = await buildCategoryPage(ctx);
			return { ...list, toast: { type: "success", message: "Category created" } };
		} else {
			await updateCategory(ctx.storage.categories!, id, formValues);
			const list = await buildCategoryPage(ctx);
			return { ...list, toast: { type: "success", message: "Category updated" } };
		}
	}

	if (actionId.startsWith("category:delete:")) {
		const id = actionId.replace("category:delete:", "");
		await deleteCategory(ctx.storage.categories!, id);
		const list = await buildCategoryPage(ctx);
		return { ...list, toast: { type: "success", message: "Category deleted" } };
	}

	return buildCategoryPage(ctx);
}
