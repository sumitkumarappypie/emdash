import type { PluginContext } from "emdash";

import type { CategoryNode } from "../categories.js";
import { header, button } from "./blocks.js";

export async function buildCategoryPage(ctx: PluginContext) {
	const { getCategoryTree } = await import("../categories.js");
	const tree = await getCategoryTree(ctx.storage.categories!);

	function renderTree(nodes: CategoryNode[], depth = 0): Array<Record<string, unknown>> {
		const blocks: Array<Record<string, unknown>> = [];
		for (const node of nodes) {
			const indent = "  ".repeat(depth);
			blocks.push({
				type: "section",
				text: `${indent}${depth > 0 ? "└ " : ""}${node.name}`,
				accessory: button("Edit", "category:edit", node.id),
			});
			if (node.children.length > 0) {
				blocks.push(...renderTree(node.children, depth + 1));
			}
		}
		return blocks;
	}

	return {
		blocks: [
			header("Categories"),
			button("New Category", "category:create", undefined, "primary"),
			...renderTree(tree),
		],
	};
}

export async function handleCategoryAction(
	_actionId: string,
	_value: string | undefined,
	ctx: PluginContext,
) {
	return buildCategoryPage(ctx);
}
