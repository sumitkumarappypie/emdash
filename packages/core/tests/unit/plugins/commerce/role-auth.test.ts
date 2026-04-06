import { describe, it, expect } from "vitest";

import { CommerceError } from "../../../../../plugins/commerce/src/cart.js";

// Extract the role check logic to test independently.
// These mirror the helpers in sandbox-entry.ts.
function requireEditor(routeCtx: { requestMeta?: { user?: { role?: string } } }): void {
	const role = routeCtx.requestMeta?.user?.role;
	if (!role || !["admin", "editor"].includes(role)) {
		throw new CommerceError("FORBIDDEN", "Insufficient permissions");
	}
}

function requireAdmin(routeCtx: { requestMeta?: { user?: { role?: string } } }): void {
	const role = routeCtx.requestMeta?.user?.role;
	if (role !== "admin") {
		throw new CommerceError("FORBIDDEN", "Admin access required");
	}
}

describe("Role-based authorization", () => {
	describe("requireEditor", () => {
		it("allows admin role", () => {
			expect(() => requireEditor({ requestMeta: { user: { role: "admin" } } })).not.toThrow();
		});

		it("allows editor role", () => {
			expect(() => requireEditor({ requestMeta: { user: { role: "editor" } } })).not.toThrow();
		});

		it("rejects author role", () => {
			expect(() => requireEditor({ requestMeta: { user: { role: "author" } } })).toThrow(
				"Insufficient permissions",
			);
		});

		it("rejects contributor role", () => {
			expect(() => requireEditor({ requestMeta: { user: { role: "contributor" } } })).toThrow(
				"Insufficient permissions",
			);
		});

		it("rejects when no user", () => {
			expect(() => requireEditor({ requestMeta: {} })).toThrow("Insufficient permissions");
		});

		it("rejects when no requestMeta", () => {
			expect(() => requireEditor({})).toThrow("Insufficient permissions");
		});
	});

	describe("requireAdmin", () => {
		it("allows admin role", () => {
			expect(() => requireAdmin({ requestMeta: { user: { role: "admin" } } })).not.toThrow();
		});

		it("rejects editor role", () => {
			expect(() => requireAdmin({ requestMeta: { user: { role: "editor" } } })).toThrow(
				"Admin access required",
			);
		});

		it("rejects author role", () => {
			expect(() => requireAdmin({ requestMeta: { user: { role: "author" } } })).toThrow(
				"Admin access required",
			);
		});

		it("rejects when no user", () => {
			expect(() => requireAdmin({})).toThrow("Admin access required");
		});
	});
});
