import { describe, it, expect, vi } from 'vitest';
import { createPaymobSession, queryPaymobTransaction } from '../src/logic/paymobAdapter';

describe('Paymob Live API Adapter', () => {
  it('ADAPT-TC-01: executes 3-step session creation (auth -> order -> payment_key) and extracts gatewayOrderId', async () => {
    const mockFetch = vi.fn();

    // Mock Step 1: /auth/tokens
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ token: 'mock_auth_token_xyz_123' }),
    });

    // Mock Step 2: /ecommerce/orders
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 444888 }),
    });

    // Mock Step 3: /acceptance/payment_keys
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ token: 'mock_payment_token_abc_789' }),
    });

    const result = await createPaymobSession(
      {
        apiKey: 'sec_api_key_test',
        integrationId: 12345,
        iframeId: 67890,
        amountCents: 250000,
        currency: 'EGP',
        merchantOrderId: '101',
        customer: {
          email: 'test@mwheba.com',
          firstName: 'Amr',
          lastName: 'Agency',
          phone: '+201012345678',
        },
      },
      mockFetch as any
    );

    // Verify results
    expect(result.gatewayOrderId).toBe('444888');
    expect(result.paymentToken).toBe('mock_payment_token_abc_789');
    expect(result.iframeUrl).toBe(
      'https://accept.paymob.com/api/acceptance/iframes/67890?payment_token=mock_payment_token_abc_789'
    );

    // Verify 3 distinct fetch calls were made in strict sequence
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Assert Step 1 call
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://accept.paymob.com/api/auth/tokens',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ api_key: 'sec_api_key_test' }),
      })
    );

    // Assert Step 2 call
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://accept.paymob.com/api/ecommerce/orders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          auth_token: 'mock_auth_token_xyz_123',
          delivery_needed: 'false',
          amount_cents: '250000',
          currency: 'EGP',
          merchant_order_id: '101',
        }),
      })
    );

    // Assert Step 3 call
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'https://accept.paymob.com/api/acceptance/payment_keys',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"order_id":"444888"'),
      })
    );
  });

  it('ADAPT-TC-02: executes background transaction inquiry for reconciliation', async () => {
    const mockFetch = vi.fn();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 99912345,
        success: true,
        pending: false,
        amount_cents: 250000,
        currency: 'EGP',
        is_refunded: false,
        is_voided: false,
        order: {
          id: 444888,
          merchant_order_id: '101',
        },
      }),
    });

    const txn = await queryPaymobTransaction('auth_token_sample', 99912345, mockFetch as any);

    expect(txn.id).toBe(99912345);
    expect(txn.success).toBe(true);
    expect(txn.order.merchant_order_id).toBe('101');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://accept.paymob.com/api/acceptance/transactions/99912345',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer auth_token_sample',
        }),
      })
    );
  });
});
