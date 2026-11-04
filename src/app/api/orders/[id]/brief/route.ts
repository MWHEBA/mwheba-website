import { NextRequest } from 'next/server';
import { handleFulfillmentRequest } from '@/modules/fulfillment/http';
import { submitServiceBrief } from '@/modules/fulfillment/services/fulfillmentService';

/** POST /api/orders/:id/brief - the order's own customer submits the creative brief for a service line. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleFulfillmentRequest(req, async ({ payload, user, body }) =>
    submitServiceBrief(payload, {
      orderId: id,
      jobId: body?.jobId,
      user,
      answers: body?.answers ?? {},
      attachmentAssetIds: body?.attachmentAssetIds,
    })
  );
}
