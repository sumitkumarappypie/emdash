import { useQuery } from "@tanstack/react-query";

import { apiFetch, API_BASE, parseApiResponse } from "../lib/api/client.js";

interface Customer {
	id: string;
	email: string;
	name: string;
	status: string;
	createdAt: string;
}

async function fetchCustomers(): Promise<{ items: Customer[] }> {
	const response = await apiFetch(`${API_BASE}/admin/customers`);
	return parseApiResponse<{ items: Customer[] }>(response);
}

export function CustomersPage() {
	const { data, isLoading, error } = useQuery({
		queryKey: ["customers"],
		queryFn: fetchCustomers,
	});

	return (
		<div style={{ padding: "2rem" }}>
			<h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1rem" }}>
				Customers
			</h1>
			{isLoading && <p>Loading...</p>}
			{error && (
				<p style={{ color: "#6b7280" }}>
					Customer management is coming soon. Customers registered through the storefront
					will appear here.
				</p>
			)}
			{data?.items && data.items.length > 0 && (
				<table style={{ width: "100%", borderCollapse: "collapse" }}>
					<thead>
						<tr style={{ borderBottom: "1px solid #e5e7eb", textAlign: "left" }}>
							<th style={{ padding: "0.75rem" }}>Name</th>
							<th style={{ padding: "0.75rem" }}>Email</th>
							<th style={{ padding: "0.75rem" }}>Status</th>
							<th style={{ padding: "0.75rem" }}>Joined</th>
						</tr>
					</thead>
					<tbody>
						{data.items.map((customer) => (
							<tr key={customer.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
								<td style={{ padding: "0.75rem" }}>{customer.name}</td>
								<td style={{ padding: "0.75rem" }}>{customer.email}</td>
								<td style={{ padding: "0.75rem" }}>{customer.status}</td>
								<td style={{ padding: "0.75rem" }}>
									{new Date(customer.createdAt).toLocaleDateString()}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
			{data?.items && data.items.length === 0 && (
				<p style={{ color: "#6b7280" }}>No customers yet.</p>
			)}
		</div>
	);
}
