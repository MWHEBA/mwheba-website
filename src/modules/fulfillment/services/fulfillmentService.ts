import type { Payload } from 'payload';
import { sql } from '@payloadcms/db-postgres';
import { hasRole } from '@/modules/identity/access/roles';
import { createArtworkDownloadToken } from '@/modules/customization/lib/privateStorage';
import { lineHasCustomization } from '@/modules/cart-checkout/logic/customizationFee';
import {
  initialStatus,
  type FulfillmentStatus,
  type FulfillmentTrack,
} from '../logic/stateMachine';

type Actor = { id: number | string; roles?: string[] } | null | undefined;

const PRODUCTION_ROLES = ['super_admin', 'operations'] as const;
const CREATIVE_ROLES = ['super_admin', 'creative_director'] as const;

function fail(code: string, message: string, statusCode: number): never {
  const err = new Error(`${code}: ${message}`);
  (err as any).statusCode = statusCode;
  throw err;
}

const idOf = (rel: any) => (typeof rel === 'object' && rel !== null ? rel.id : rel);

/**
 * Production (operations) works the physical track only; creative directors work the service track only.
 * super_admin works both. Finance and every other role are refused.
 */
function requireStaffForTrack(user: Actor, track: FulfillmentTrack) {
  if (!user) fail('UNAUTHENTICATED', 'Authentication is required.', 401);
  const allowed = track === 'physical' ? PRODUCTION_ROLES : CREATIVE_ROLES;
  if (!hasRole(user, [...allowed])) {
    fail(
      'FORBIDDEN_TRACK',
      track === 'physical'
        ? 'Only production operations staff can work physical fulfillment jobs.'
        : 'Only creative directors can work service intake jobs.',
      403
    );
  }
}

async function beginTx(payload: Payload) {
  const db: any = payload.db;
  if (typeof db?.beginTransaction !== 'function') {
    fail('DATABASE_TRANSACTION_UNAVAILABLE', 'PostgreSQL transactions are required for fulfillment changes.', 500);
  }
  const transactionID = await db.beginTransaction();
  if (!transactionID) fail('TRANSACTION_BEGIN_FAILED', 'Could not start a database transaction.', 500);
  return {
    transactionID,
    commit: () => db.commitTransaction(transactionID),
    rollback: async () => {
      try {
        await db.rollbackTransaction(transactionID);
      } catch {
        // ignore secondary rollback errors
      }
    },
  };
}

const appendHistory = (job: any, entry: Record<string, unknown>) => [
  ...(Array.isArray(job.statusHistory) ? job.statusHistory : []),
  { ...entry, at: new Date().toISOString() },
];

/** Row lock on the job inside the active transaction (serializes concurrent customer submissions). */
async function lockJobRow(payload: Payload, transactionID: unknown, jobId: number | string) {
  const session = (payload.db as any)?.sessions?.[String(transactionID)];
  const executor = session?.db;
  if (!executor || typeof executor.execute !== 'function') return; // unique index remains the backstop
  await executor.execute(sql`SELECT "id" FROM "fulfillment_jobs" WHERE "id" = ${Number(jobId)} FOR UPDATE`);
}

function isUniqueViolation(err: any): boolean {
  const code = err?.code ?? err?.cause?.code;
  const message = String(err?.message || '');
  return code === '23505' || /unique|duplicate key/i.test(message);
}

/**
 * Creates one fulfillment job per order line inside the order transaction.
 * Physical customized lines start at pending_artwork_approval, other physical lines at queued,
 * service lines at pending_brief.
 */
export async function createJobsForOrder(payload: Payload, order: any, txReq: any) {
  const items: any[] = Array.isArray(order.items) ? order.items : [];
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    const track: FulfillmentTrack = item.fulfillmentType === 'service' ? 'service' : 'physical';
    const customized = track === 'physical' && lineHasCustomization(item);
    const status = initialStatus({ track, customized });
    await payload.create({
      collection: 'fulfillment-jobs',
      data: {
        order: order.id,
        lineIndex: index,
        track,
        status,
        customized,
        artworkAssetId: item.artworkAssetId || undefined,
        productTitle: item.productTitle || '',
        quantity: item.quantity,
        printingNotes: item.printingNotes || '',
        statusHistory: [{ from: null, to: status, by: 'system:order-created', at: new Date().toISOString() }],
      },
      context: { fulfillmentEngine: true },
      req: txReq,
    });
  }
}

/** Derives the order-level fulfillment status from its physical jobs (service jobs never affect it). */
export async function syncOrderFulfillment(payload: Payload, orderId: number | string, req?: any) {
  const jobs = await payload.find({
    collection: 'fulfillment-jobs',
    where: { order: { equals: orderId } },
    limit: 200,
    depth: 0,
    req,
  });
  const physical = jobs.docs.filter((j: any) => j.track === 'physical');
  if (physical.length === 0) return;

  const statuses = physical.map((j: any) => j.status as string);
  let derived: string = 'unfulfilled';
  if (statuses.every((s) => s === 'delivered')) derived = 'delivered';
  else if (statuses.some((s) => s === 'shipped')) derived = 'shipped';
  else if (statuses.some((s) => s === 'ready_for_pickup')) derived = 'ready_for_pickup';
  else if (statuses.some((s) => s === 'in_printing' || s === 'quality_check')) derived = 'in_production';

  const order: any = await payload.findByID({ collection: 'orders', id: orderId, depth: 0, req });
  if (order.fulfillmentStatus === derived) return;
  if (['cancelled', 'returned_to_origin'].includes(order.fulfillmentStatus)) return;

  await payload.update({
    collection: 'orders',
    id: orderId,
    data: { fulfillmentStatus: derived as any },
    context: { fulfillmentEngine: true },
    req,
  });
}

/** Operator transition of a single job (production / service progress). */
export async function transitionJob(
  payload: Payload,
  params: { jobId: number | string; to: FulfillmentStatus; user: Actor }
) {
  if (!params.user) fail('UNAUTHENTICATED', 'Authentication is required.', 401);

  const job: any = await payload
    .findByID({ collection: 'fulfillment-jobs', id: params.jobId, depth: 0 })
    .catch(() => null);
  if (!job) fail('JOB_NOT_FOUND', 'Fulfillment job not found.', 404);
  requireStaffForTrack(params.user, job.track);

  const tx = await beginTx(payload);
  const txReq: any = { payload, transactionID: tx.transactionID };
  try {
    let updated: any;
    try {
      updated = await payload.update({
        collection: 'fulfillment-jobs',
        id: job.id,
        data: {
          status: params.to as any,
          statusHistory: appendHistory(job, {
            from: job.status,
            to: params.to,
            by: `user:${params.user!.id}`,
          }),
        },
        context: { fulfillmentEngine: true, fulfillmentActor: 'operator' },
        req: txReq,
      });
    } catch (err: any) {
      // Surface state-machine verdicts as 409/403 instead of a generic failure
      const message = String(err?.message || err);
      const code = message.split(':')[0];
      const status = code === 'CUSTOMER_APPROVAL_REQUIRED' || code === 'PROOF_NOT_APPROVED' ? 403 : 409;
      const mapped = new Error(message);
      (mapped as any).statusCode = ['INVALID_TRANSITION', 'WRONG_TRACK', 'CUSTOMER_APPROVAL_REQUIRED', 'PROOF_NOT_APPROVED'].includes(code)
        ? status
        : err?.statusCode || 400;
      throw mapped;
    }
    await syncOrderFulfillment(payload, idOf(job.order), txReq);
    await tx.commit();
    return updated;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/**
 * Customer approves the artwork proof. Only the order's own customer can do it; operations cannot.
 * Moves proofStatus to proof_approved and releases customized physical jobs to the queue.
 */
export async function approveProof(payload: Payload, params: { orderId: number | string; user: Actor }) {
  if (!params.user) fail('UNAUTHENTICATED', 'Authentication is required.', 401);

  const order: any = await payload
    .findByID({ collection: 'orders', id: params.orderId, depth: 0 })
    .catch(() => null);
  if (!order || String(idOf(order.customer)) !== String(params.user!.id)) {
    // Do not reveal whether the order exists
    fail('ORDER_NOT_FOUND', 'Order not found.', 404);
  }
  if (order.proofStatus !== 'proof_pending') {
    fail('PROOF_NOT_PENDING', `Order proof status is '${order.proofStatus}', nothing to approve.`, 409);
  }

  const tx = await beginTx(payload);
  const txReq: any = { payload, transactionID: tx.transactionID };
  try {
    const nowIso = new Date().toISOString();
    await payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        proofStatus: 'proof_approved',
        proofApprovedAt: nowIso,
        auditLog: [
          ...(Array.isArray(order.auditLog) ? order.auditLog : []),
          { entry: `Artwork proof approved by customer #${params.user!.id} at ${nowIso}.` },
        ],
      },
      context: { isProofApprovalEngine: true },
      req: txReq,
    });

    const jobs = await payload.find({
      collection: 'fulfillment-jobs',
      where: { and: [{ order: { equals: order.id } }, { status: { equals: 'pending_artwork_approval' } }] },
      limit: 200,
      depth: 0,
      req: txReq,
    });
    for (const job of jobs.docs as any[]) {
      await payload.update({
        collection: 'fulfillment-jobs',
        id: job.id,
        data: {
          status: 'queued',
          statusHistory: appendHistory(job, { from: job.status, to: 'queued', by: `customer:${params.user!.id}`, reason: 'proof_approved' }),
        },
        context: { fulfillmentEngine: true, fulfillmentActor: 'customer_engine' },
        req: txReq,
      });
    }
    await tx.commit();
    return { orderId: order.id, releasedJobs: jobs.docs.length };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/** Production staff request a short-lived signed link to a physical job's private artwork file. */
export async function signJobArtworkLink(payload: Payload, params: { jobId: number | string; user: Actor }) {
  if (!params.user) fail('UNAUTHENTICATED', 'Authentication is required.', 401);
  const job: any = await payload
    .findByID({ collection: 'fulfillment-jobs', id: params.jobId, depth: 0 })
    .catch(() => null);
  if (!job) fail('JOB_NOT_FOUND', 'Fulfillment job not found.', 404);
  requireStaffForTrack(params.user, 'physical');
  if (job.track !== 'physical' || !job.artworkAssetId) {
    fail('NO_ARTWORK_FOR_JOB', 'This job has no private artwork file.', 404);
  }
  const { token, expiresIn } = createArtworkDownloadToken(job.artworkAssetId, 900);
  return { url: `/api/customization/artwork/${job.artworkAssetId}/download?token=${token}`, expiresIn };
}

/** Creative directors request a signed link to one reference attachment of a submitted brief. */
export async function signBriefAttachmentLink(
  payload: Payload,
  params: { briefId: number | string; assetId: number | string; user: Actor }
) {
  if (!params.user) fail('UNAUTHENTICATED', 'Authentication is required.', 401);
  requireStaffForTrack(params.user, 'service');
  const brief: any = await payload
    .findByID({ collection: 'service-briefs', id: params.briefId, depth: 0 })
    .catch(() => null);
  const attachments: unknown[] = Array.isArray(brief?.attachmentAssetIds) ? brief.attachmentAssetIds : [];
  if (!brief || !attachments.map(String).includes(String(params.assetId))) {
    fail('ATTACHMENT_NOT_FOUND', 'Attachment not found on this brief.', 404);
  }
  const { token, expiresIn } = createArtworkDownloadToken(String(params.assetId), 900);
  return { url: `/api/customization/artwork/${params.assetId}/download?token=${token}`, expiresIn };
}

export interface BriefInput {
  targetAudience?: unknown;
  brandValues?: unknown;
  existingGuidelines?: unknown;
  notes?: unknown;
}

const MAX_BRIEF_FIELD = 4000;
const MAX_ATTACHMENTS = 10;

function cleanText(value: unknown, field: string, required: boolean): string {
  if (value === undefined || value === null || value === '') {
    if (required) fail('INVALID_BRIEF', `'${field}' is required.`, 400);
    return '';
  }
  if (typeof value !== 'string') fail('INVALID_BRIEF', `'${field}' must be text.`, 400);
  const trimmed = value.trim();
  if (required && !trimmed) fail('INVALID_BRIEF', `'${field}' is required.`, 400);
  if (trimmed.length > MAX_BRIEF_FIELD) fail('INVALID_BRIEF', `'${field}' exceeds ${MAX_BRIEF_FIELD} characters.`, 400);
  return trimmed;
}

/** Customer submits the creative brief for a service line; moves it pending_brief -> brief_submitted. */
export async function submitServiceBrief(
  payload: Payload,
  params: { orderId: number | string; jobId?: number | string; user: Actor; answers: BriefInput; attachmentAssetIds?: unknown }
) {
  if (!params.user) fail('UNAUTHENTICATED', 'Authentication is required.', 401);

  const order: any = await payload
    .findByID({ collection: 'orders', id: params.orderId, depth: 0 })
    .catch(() => null);
  if (!order || String(idOf(order.customer)) !== String(params.user!.id)) {
    fail('ORDER_NOT_FOUND', 'Order not found.', 404);
  }

  const answers = {
    targetAudience: cleanText(params.answers?.targetAudience, 'targetAudience', true),
    brandValues: cleanText(params.answers?.brandValues, 'brandValues', true),
    existingGuidelines: cleanText(params.answers?.existingGuidelines, 'existingGuidelines', false),
    notes: cleanText(params.answers?.notes, 'notes', false),
  };

  const rawAttachments = params.attachmentAssetIds ?? [];
  if (!Array.isArray(rawAttachments) || rawAttachments.length > MAX_ATTACHMENTS) {
    fail('INVALID_BRIEF', `attachmentAssetIds must be an array of up to ${MAX_ATTACHMENTS} asset ids.`, 400);
  }
  for (const assetId of rawAttachments) {
    const asset: any = await payload
      .findByID({ collection: 'artwork-assets', id: assetId as any, depth: 0 })
      .catch(() => null);
    // Attachments must be the caller's own private uploads
    if (!asset || String(idOf(asset.uploader)) !== String(params.user!.id)) {
      fail('INVALID_ATTACHMENT', `Attachment ${String(assetId)} is not available to this customer.`, 400);
    }
  }

  const pending = await payload.find({
    collection: 'fulfillment-jobs',
    where: { and: [{ order: { equals: order.id } }, { track: { equals: 'service' } }, { status: { equals: 'pending_brief' } }] },
    limit: 50,
    depth: 0,
  });
  let job: any;
  if (params.jobId !== undefined) {
    job = (pending.docs as any[]).find((j) => String(j.id) === String(params.jobId));
  } else if (pending.docs.length === 1) {
    job = pending.docs[0];
  } else if (pending.docs.length > 1) {
    fail('JOB_ID_REQUIRED', 'This order has several service lines awaiting a brief; specify jobId.', 400);
  }
  if (!job) fail('BRIEF_NOT_EXPECTED', 'No service line of this order is awaiting a brief.', 409);

  const tx = await beginTx(payload);
  const txReq: any = { payload, transactionID: tx.transactionID };
  try {
    // Serialize concurrent submissions for this job: lock the job row, then re-check the status
    // INSIDE the transaction. The UNIQUE index on service_briefs.job_id is the final database backstop.
    await lockJobRow(payload, tx.transactionID, job.id);
    const lockedJob: any = await payload.findByID({ collection: 'fulfillment-jobs', id: job.id, depth: 0, req: txReq });
    if (!lockedJob || lockedJob.status !== 'pending_brief') {
      fail('BRIEF_NOT_EXPECTED', 'A brief was already submitted for this service line.', 409);
    }

    const nowIso = new Date().toISOString();
    let brief: any;
    try {
      brief = await payload.create({
        collection: 'service-briefs',
        data: {
          order: order.id,
          job: job.id,
          customer: params.user!.id as any,
          answers,
          attachmentAssetIds: rawAttachments as any,
          submittedAt: nowIso,
          notificationStatus: 'pending',
        },
        context: { fulfillmentEngine: true },
        req: txReq,
      });
    } catch (err: any) {
      if (isUniqueViolation(err)) {
        fail('BRIEF_NOT_EXPECTED', 'A brief was already submitted for this service line.', 409);
      }
      throw err;
    }
    await payload.update({
      collection: 'fulfillment-jobs',
      id: job.id,
      data: {
        status: 'brief_submitted',
        statusHistory: appendHistory(lockedJob, { from: lockedJob.status, to: 'brief_submitted', by: `customer:${params.user!.id}`, briefId: brief.id }),
      },
      context: { fulfillmentEngine: true, fulfillmentActor: 'customer_engine' },
      req: txReq,
    });
    await tx.commit();
    // The creative-director notification is recorded as outstanding work only; nothing has been delivered.
    return {
      briefId: brief.id,
      jobId: job.id,
      notification: { status: 'pending', delivered: false },
    };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}
