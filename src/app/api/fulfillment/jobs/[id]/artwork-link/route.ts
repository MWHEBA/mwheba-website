import { NextRequest } from 'next/server';
import { handleFulfillmentRequest } from '@/modules/fulfillment/http';
import { signJobArtworkLink } from '@/modules/fulfillment/services/fulfillmentService';

/** POST /api/fulfillment/jobs/:id/artwork-link - operations only; returns a 15-minute signed private download URL. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleFulfillmentRequest(req, async ({ payload, user }) => signJobArtworkLink(payload, { jobId: id, user }));
}
