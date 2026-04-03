export async function verifyWebhookSignature(
	payload: string,
	signature: string,
	secret: string,
): Promise<boolean> {
	const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
		const [key, value] = part.split("=");
		if (key && value) acc[key] = value;
		return acc;
	}, {});

	const timestamp = parts.t;
	const expectedSig = parts.v1;
	if (!timestamp || !expectedSig) return false;

	const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
	if (age > 300) return false;

	const signedPayload = `${timestamp}.${payload}`;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
	const computed = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");

	return computed === expectedSig;
}

export interface StripeEvent {
	id: string;
	type: string;
	data: { object: Record<string, unknown> };
}

export function parseStripeEvent(payload: string): StripeEvent {
	return JSON.parse(payload) as StripeEvent;
}
