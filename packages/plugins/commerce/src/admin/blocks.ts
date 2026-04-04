// Shared Block Kit helpers for commerce admin pages

export function header(text: string) {
	return { type: "header", text };
}

export function section(text: string) {
	return { type: "section", text };
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

export function button(
	text: string,
	actionId: string,
	value?: string,
	style?: "primary" | "danger",
) {
	return {
		type: "button",
		text,
		action_id: actionId,
		...(value ? { value } : {}),
		...(style ? { style } : {}),
	};
}

export function statsRow(stats: Array<{ label: string; value: string }>) {
	return {
		type: "section",
		fields: stats.map((s) => ({ type: "mrkdwn", text: `*${s.label}*\n${s.value}` })),
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
