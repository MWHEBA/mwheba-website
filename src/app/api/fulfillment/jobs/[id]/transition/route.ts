import { NextRequest } from 'next/server';
import { handleFulfillmentRequest } from '@/modules/fulfillment/http';
import { transitionJob } from '@/modules/fulfillment/services/fulfillmentService';

/** POST /api/fulfillment/jobs/:id/transition  { to } - operations only. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleFulfillmentRequest(req, async ({ payload, user, body }) => {
    if (typeof body?.to !== 'string') {
      const err = new Error("INVALID_PAYLOAD: 'to' (target status) is required.");
      (err as any).statusCode = 400;
      throw err;
    }
    const job = await transitionJob(payload, { jobId: id, to: body.to, user });
    return { jobId: job.id, status: job.status };
  });
}
