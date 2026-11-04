import { NextRequest } from 'next/server';
import { handleFulfillmentRequest } from '@/modules/fulfillment/http';
import { signBriefAttachmentLink } from '@/modules/fulfillment/services/fulfillmentService';

/** POST /api/fulfillment/briefs/:id/attachments/:assetId/link - creative directors only; 15-minute signed private link. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assetId: string }> }
) {
  const { id, assetId } = await params;
  return handleFulfillmentRequest(req, async ({ payload, user }) =>
    signBriefAttachmentLink(payload, { briefId: id, assetId, user })
  );
}
