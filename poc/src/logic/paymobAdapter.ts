/**
 * Paymob Gateway Live API Adapter (Sandbox & Production)
 * 
 * Implements actual REST API calls to Paymob endpoints:
 * 1. Authentication (POST /api/auth/tokens)
 * 2. Order Registration (POST /api/ecommerce/orders)
 * 3. Payment Key Generation (POST /api/acceptance/payment_keys)
 * 4. Transaction Inquiry (GET /api/acceptance/transactions/{id})
 */

export interface PaymobSessionOptions {
  apiKey: string;
  integrationId: number;
  iframeId?: number;
  amountCents: number;
  currency: string;
  merchantOrderId: string;
  customer: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
}

export interface PaymobSessionResult {
  gatewayOrderId: string;
  paymentToken: string;
  iframeUrl?: string;
}

export interface PaymobTransactionInquiryResult {
  id: number;
  success: boolean;
  pending: boolean;
  amount_cents: number;
  currency: string;
  is_refunded: boolean;
  is_voided: boolean;
  order: {
    id: number;
    merchant_order_id: string;
  };
  source_data?: {
    type: string;
    pan: string;
    sub_type: string;
  };
}

const PAYMOB_BASE_URL = 'https://accept.paymob.com/api';

/**
 * Initiates a server-authoritative Paymob payment session.
 * Stores the returned gatewayOrderId on the PaymentAttempt before customer is redirected.
 */
export async function createPaymobSession(
  options: PaymobSessionOptions,
  fetchFn: typeof fetch = fetch
): Promise<PaymobSessionResult> {
  const { apiKey, integrationId, iframeId, amountCents, currency, merchantOrderId, customer } = options;

  // Step 1: Authentication Token
  const authRes = await fetchFn(`${PAYMOB_BASE_URL}/auth/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  });

  if (!authRes.ok) {
    const errorBody = await authRes.text();
    throw new Error(`Paymob Authentication failed (${authRes.status}): ${errorBody}`);
  }

  const authData = (await authRes.json()) as { token: string };
  const authToken = authData.token;

  // Step 2: Order Registration
  const orderRes = await fetchFn(`${PAYMOB_BASE_URL}/ecommerce/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      delivery_needed: 'false',
      amount_cents: String(amountCents),
      currency,
      merchant_order_id: String(merchantOrderId),
    }),
  });

  if (!orderRes.ok) {
    const errorBody = await orderRes.text();
    throw new Error(`Paymob Order creation failed (${orderRes.status}): ${errorBody}`);
  }

  const orderData = (await orderRes.json()) as { id: number };
  const gatewayOrderId = String(orderData.id);

  // Step 3: Payment Key Generation
  const paymentKeyRes = await fetchFn(`${PAYMOB_BASE_URL}/acceptance/payment_keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auth_token: authToken,
      amount_cents: String(amountCents),
      expiration: 3600, // 1 hour session TTL
      order_id: gatewayOrderId,
      billing_data: {
        apartment: 'NA',
        email: customer.email,
        floor: 'NA',
        first_name: customer.firstName || 'Customer',
        street: 'NA',
        building: 'NA',
        phone_number: customer.phone || '+201000000000',
        shipping_method: 'PKG',
        postal_code: 'NA',
        city: 'Cairo',
        country: 'EGY',
        last_name: customer.lastName || 'MWHEBA',
        state: 'Cairo',
      },
      currency,
      integration_id: integrationId,
      lock_order_when_paid: 'true',
    }),
  });

  if (!paymentKeyRes.ok) {
    const errorBody = await paymentKeyRes.text();
    throw new Error(`Paymob Payment Key generation failed (${paymentKeyRes.status}): ${errorBody}`);
  }

  const keyData = (await paymentKeyRes.json()) as { token: string };
  const paymentToken = keyData.token;

  const iframeUrl = iframeId
    ? `${PAYMOB_BASE_URL}/acceptance/iframes/${iframeId}?payment_token=${paymentToken}`
    : undefined;

  return {
    gatewayOrderId,
    paymentToken,
    iframeUrl,
  };
}

/**
 * Queries Paymob for transaction status (Background Reconciliation Job).
 */
export async function queryPaymobTransaction(
  authToken: string,
  transactionId: number | string,
  fetchFn: typeof fetch = fetch
): Promise<PaymobTransactionInquiryResult> {
  const res = await fetchFn(`${PAYMOB_BASE_URL}/acceptance/transactions/${transactionId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Paymob Transaction Inquiry failed (${res.status}): ${errorBody}`);
  }

  return (await res.json()) as PaymobTransactionInquiryResult;
}
