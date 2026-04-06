const STRIPE_API = "https://api.stripe.com/v1";

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

interface StripeRequestOpts {
	method: "GET" | "POST";
	path: string;
	body?: Record<string, string>;
	secretKey: string;
}

async function stripeRequest<T>(fetchFn: FetchFn, opts: StripeRequestOpts): Promise<T> {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${opts.secretKey}`,
		"Content-Type": "application/x-www-form-urlencoded",
	};

	const response = await fetchFn(`${STRIPE_API}${opts.path}`, {
		method: opts.method,
		headers,
		body: opts.body ? new URLSearchParams(opts.body).toString() : undefined,
	});

	if (!response.ok) {
		const error = (await response.json()) as { error: { message: string } };
		throw new Error(`Stripe API error: ${error.error.message}`);
	}

	return response.json() as Promise<T>;
}

export async function createPaymentIntent(
	fetchFn: FetchFn,
	secretKey: string,
	opts: { amount: number; currency: string; metadata?: Record<string, string> },
): Promise<{ id: string; client_secret: string; status: string }> {
	const body: Record<string, string> = {
		amount: String(Math.round(opts.amount * 100)),
		currency: opts.currency.toLowerCase(),
		"automatic_payment_methods[enabled]": "true",
	};
	if (opts.metadata) {
		for (const [key, value] of Object.entries(opts.metadata)) {
			body[`metadata[${key}]`] = value;
		}
	}
	return stripeRequest(fetchFn, { method: "POST", path: "/payment_intents", body, secretKey });
}

export async function createRefund(
	fetchFn: FetchFn,
	secretKey: string,
	opts: { paymentIntentId: string; amount?: number },
): Promise<{ id: string; status: string }> {
	const body: Record<string, string> = { payment_intent: opts.paymentIntentId };
	if (opts.amount !== undefined) {
		body.amount = String(Math.round(opts.amount * 100));
	}
	return stripeRequest(fetchFn, { method: "POST", path: "/refunds", body, secretKey });
}
