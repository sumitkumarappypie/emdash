// Shared Block Kit helpers for commerce admin pages
// See packages/blocks/src/types.ts for the correct block shapes

const NAV_TABS = [
	{ id: "dashboard", label: "Dashboard" },
	{ id: "products", label: "Products" },
	{ id: "categories", label: "Categories" },
	{ id: "orders", label: "Orders" },
	{ id: "coupons", label: "Coupons" },
	{ id: "settings", label: "Settings" },
];

export function commerceNav(activeTab: string) {
	return {
		type: "actions",
		elements: NAV_TABS.map((tab) => ({
			type: "button",
			label: tab.label,
			action_id: `nav:${tab.id}`,
			...(tab.id === activeTab ? { style: "primary" } : {}),
		})),
	};
}

export function header(text: string) {
	return { type: "header", text };
}

export function section(text: string) {
	return { type: "section", text };
}

// FieldsBlock: type: "fields", fields: [{label, value}]
export function fields(items: Array<{ label: string; value: string }>) {
	return { type: "fields", fields: items };
}

// StatsBlock: type: "stats", items: [{label, value}]
export function stats(items: Array<{ label: string; value: string }>) {
	return { type: "stats", items };
}

export function table(
	columns: Array<{ key: string; label: string; format?: string }>,
	rows: Array<Record<string, unknown>>,
	opts?: { emptyText?: string; actionId?: string },
) {
	return {
		type: "table",
		columns,
		rows,
		empty_text: opts?.emptyText ?? "No data",
		page_action_id: opts?.actionId ?? "table:page",
	};
}

// ButtonElement uses "label" not "text"
export function button(
	label: string,
	actionId: string,
	value?: string,
	style?: "primary" | "danger" | "secondary",
) {
	return {
		type: "button",
		label,
		action_id: actionId,
		...(value ? { value } : {}),
		...(style ? { style } : {}),
	};
}

export function formatCurrency(amount: number, currency: string): string {
	return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function statusBadge(status: string): string {
	const badges: Record<string, string> = {
		pending: "Pending",
		paid: "Paid",
		processing: "Processing",
		shipped: "Shipped",
		delivered: "Delivered",
		completed: "Completed",
		cancelled: "Cancelled",
		refunded: "Refunded",
		active: "Active",
		draft: "Draft",
		archived: "Archived",
		unfulfilled: "Unfulfilled",
		fulfilled: "Fulfilled",
		partially_fulfilled: "Partial",
	};
	return badges[status] ?? status;
}
