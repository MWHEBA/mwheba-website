import { NextRequest } from 'next/server';
import { handleFulfillmentRequest } from '@/modules/fulfillment/http';
import { approveProof } from '@/modules/fulfillment/services/fulfillmentService';

/** POST /api/orders/:id/proof/approve - the order's own customer only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleFulfillmentRequest(req, async ({ payload, user }) => approveProof(payload, { orderId: id, user }));
}
