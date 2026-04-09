import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { apiFetch, API_BASE, parseApiResponse } from "../lib/api/client.js";

interface Customer {
	id: string;
	email: string;
	name: string;
	status: string;
	createdAt: string;
	updatedAt: string;
	lastLoginAt: string | null;
}

interface CustomersResponse {
	items: Customer[];
	nextCursor?: string;
}

async function fetchCustomers(params: {
	search?: string;
	status?: string;
	cursor?: string;
}): Promise<CustomersResponse> {
	const query = new URLSearchParams();
	if (params.search) query.set("search", params.search);
	if (params.status) query.set("status", params.status);
	if (params.cursor) query.set("cursor", params.cursor);
	const qs = query.toString();
	const response = await apiFetch(`${API_BASE}/admin/customers${qs ? `?${qs}` : ""}`);
	return parseApiResponse<CustomersResponse>(response);
}

export function CustomersPage() {
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState("");

	const { data, isLoading, error } = useQuery({
		queryKey: ["customers", search, statusFilter],
		queryFn: () =>
			fetchCustomers({ search: search || undefined, status: statusFilter || undefined }),
	});

	return (
		<div className="p-6">
			<div className="mb-6">
				<h1 className="text-2xl font-bold">Customers</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Manage customers registered through the storefront.
				</p>
			</div>

			<div className="flex gap-3 mb-4">
				<input
					type="text"
					placeholder="Search by name or email..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
				/>
				<select
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					<option value="">All statuses</option>
					<option value="active">Active</option>
					<option value="inactive">Inactive</option>
				</select>
			</div>

			{isLoading && <p className="text-muted-foreground">Loading...</p>}

			{error && (
				<p className="text-destructive">
					Failed to load customers. The admin customers API may not be deployed yet.
				</p>
			)}

			{data?.items && data.items.length > 0 && (
				<div className="rounded-md border">
					<table className="w-full">
						<thead>
							<tr className="border-b bg-muted/50">
								<th className="p-3 text-left text-sm font-medium">Name</th>
								<th className="p-3 text-left text-sm font-medium">Email</th>
								<th className="p-3 text-left text-sm font-medium">Status</th>
								<th className="p-3 text-left text-sm font-medium">Last Login</th>
								<th className="p-3 text-left text-sm font-medium">Joined</th>
							</tr>
						</thead>
						<tbody>
							{data.items.map((customer) => (
								<tr key={customer.id} className="border-b last:border-0">
									<td className="p-3 text-sm font-medium">{customer.name}</td>
									<td className="p-3 text-sm text-muted-foreground">{customer.email}</td>
									<td className="p-3 text-sm">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
												customer.status === "active"
													? "bg-green-100 text-green-700"
													: "bg-gray-100 text-gray-600"
											}`}
										>
											{customer.status}
										</span>
									</td>
									<td className="p-3 text-sm text-muted-foreground">
										{customer.lastLoginAt
											? new Date(customer.lastLoginAt).toLocaleDateString()
											: "Never"}
									</td>
									<td className="p-3 text-sm text-muted-foreground">
										{new Date(customer.createdAt).toLocaleDateString()}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{data?.items && data.items.length === 0 && (
				<p className="text-muted-foreground text-center py-8">No customers found.</p>
			)}
		</div>
	);
}
