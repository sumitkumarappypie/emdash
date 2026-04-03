import { describe, it, expect } from "vitest";

import {
	verifyWebhookSignature,
	parseStripeEvent,
} from "../../../../../plugins/commerce-stripe/src/webhook.js";

// Helper: compute a real HMAC-SHA256 signature to generate valid test fixtures
async function computeSignature(
	payload: string,
	timestamp: string,
	secret: string,
): Promise<string> {
	const signedPayload = `${timestamp}.${payload}`;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
	return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("verifyWebhookSignature", () => {
	it("accepts a valid signature with fresh timestamp", async () => {
		const secret = "whsec_test_secret";
		const payload = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" });
		const timestamp = String(Math.floor(Date.now() / 1000));
		const v1 = await computeSignature(payload, timestamp, secret);
		const signature = `t=${timestamp},v1=${v1}`;

		const result = await verifyWebhookSignature(payload, signature, secret);
		expect(result).toBe(true);
	});

	it("rejects an invalid signature", async () => {
		const secret = "whsec_test_secret";
		const payload = JSON.stringify({ id: "evt_1", type: "payment_intent.succeeded" });
		const timestamp = String(Math.floor(Date.now() / 1000));
		const signature = `t=${timestamp},v1=invalidsignature0000000000000000000000000000000000000000000000000000`;

		const result = await verifyWebhookSignature(payload, signature, secret);
		expect(result).toBe(false);
	});

	it("rejects an expired timestamp (older than 5 minutes)", async () => {
		const secret = "whsec_test_secret";
		const payload = JSON.stringify({ id: "evt_2", type: "charge.succeeded" });
		// Timestamp that is 10 minutes in the past
		const timestamp = String(Math.floor(Date.now() / 1000) - 600);
		const v1 = await computeSignature(payload, timestamp, secret);
		const signature = `t=${timestamp},v1=${v1}`;

		const result = await verifyWebhookSignature(payload, signature, secret);
		expect(result).toBe(false);
	});
});

describe("parseStripeEvent", () => {
	it("parses a Stripe event payload correctly", () => {
		const event = {
			id: "evt_abc123",
			type: "payment_intent.succeeded",
			data: {
				object: {
					id: "pi_abc123",
					amount: 2000,
					currency: "usd",
					status: "succeeded",
				},
			},
		};
		const payload = JSON.stringify(event);
		const parsed = parseStripeEvent(payload);

		expect(parsed.id).toBe("evt_abc123");
		expect(parsed.type).toBe("payment_intent.succeeded");
		expect(parsed.data.object["id"]).toBe("pi_abc123");
		expect(parsed.data.object["amount"]).toBe(2000);
	});
});
