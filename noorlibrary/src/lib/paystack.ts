// src/lib/paystack.ts
// Paystack API helpers — server-side only (API routes).

const SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const BASE_URL   = 'https://api.paystack.co';

interface PaystackInitResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number; // in kobo/pesewas
    currency: string;
    metadata: Record<string, unknown>;
  };
}

/**
 * Initialize a Paystack transaction.
 * Returns the authorization_url to redirect the user to.
 */
export async function initializeTransaction(params: {
  email: string;
  amountKobo: number; // Amount in smallest currency unit (kobo for NGN, pesewas for GHS)
  reference: string;
  metadata: Record<string, unknown>;
  callbackUrl: string;
  currency?: string;
}): Promise<PaystackInitResponse> {
  const response = await fetch(`${BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email:        params.email,
      amount:       params.amountKobo,
      reference:    params.reference,
      metadata:     params.metadata,
      callback_url: params.callbackUrl,
      currency:     params.currency,
    }),
  });

  if (!response.ok) {
    throw new Error(`Paystack init failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Verify a Paystack transaction by reference.
 * Call this from your webhook or callback handler.
 */
export async function verifyTransaction(reference: string): Promise<PaystackVerifyResponse> {
  const response = await fetch(`${BASE_URL}/transaction/verify/${reference}`, {
    headers: {
      Authorization: `Bearer ${SECRET_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Paystack verify failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Generate a unique transaction reference.
 */
export function generateReference(prefix = 'noor'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
