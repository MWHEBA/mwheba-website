import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile, rm } from 'node:fs/promises';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Window } from 'happy-dom';
import { sql } from '@payloadcms/db-postgres';
import { getPayload } from 'payload';
import { NextRequest } from 'next/server';
import configPromise from '@/payload.config';
import { getOrCreateCart } from '@/modules/cart-checkout/services/cartStorage';
import { buildCheckoutQuote } from '@/modules/orders/services/checkoutQuote';
import { createOrderFromCart } from '@/modules/orders/services/orderService';
import { submitServiceBrief } from '@/modules/fulfillment/services/fulfillmentService';
import { ServiceBriefForm } from '@/modules/fulfillment/ui/ServiceBriefForm';
import {
  allowedNext,
  initialStatus,
  validateTransition,
} from '@/modules/fulfillment/logic/stateMachine';
import { saveArtworkFile, verifyArtworkDownloadToken } from '@/modules/customization/lib/privateStorage';
import { POST as transitionRoute } from '@/app/api/fulfillment/jobs/[id]/transition/route';
import { POST as artworkLinkRoute } from '@/app/api/fulfillment/jobs/[id]/artwork-link/route';
import { POST as approveProofRoute } from '@/app/api/orders/[id]/proof/approve/route';
import { POST as briefRoute } from '@/app/api/orders/[id]/brief/route';
import { POST as legacySignRoute } from '@/app/api/customization/artwork/[id]/sign/route';
import { POST as briefAttachmentLinkRoute } from '@/app/api/fulfillment/briefs/[id]/attachments/[assetId]/link/route';
import { GET as artworkDownloadRoute } from '@/app/api/customization/artwork/[id]/download/route';

describe('B2B-05: Operations Fulfillment Engine & Service Intake Workflow', () => {
  // Signing secrets for temporary private-download tokens (same dev fixtures as the artwork tests)
  process.env.MEDIA_SIGNING_SECRET = process.env.MEDIA_SIGNING_SECRET || 'mwheba-media-signing-secret-dev-2026-32chars';
  process.env.PAYLOAD_SECRET = process.env.PAYLOAD_SECRET || 'mwheba-dev-foundation-secret-key-32chars-min';

  let payload: any;
  let flask: any; // physical, MOQ 10, customization fee 30
  let service: any; // fixed-price service
  let opsUser: any;
  let financeUser: any;
  let opsToken: string;
  let financeToken: string;
  let creativeUser: any;
  let creativeToken: string;
  let artworkAsset: any;
  let artworkAbsolutePath: string;

  const cleanup = {
    orders: [] as any[],
    users: [] as any[],
    carts: [] as any[],
    assets: [] as any[],
    products: [] as any[],
    files: [] as string[],
  };

  const unique = () => `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

  const asReq = (url: string, token: string | null, body?: any) =>
    new NextRequest(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `JWT ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  const params = (id: any) => ({ params: Promise.resolve({ id: String(id) }) });

  const loginToken = async (email: string, password: string) => {
    const res = await payload.login({ collection: 'users', data: { email, password } });
    return res.token as string;
  };

  const createStaff = async (role: 'operations' | 'finance' | 'creative_director') => {
    const password = 'StaffPassword2026!';
    const user = await payload.create({
      collection: 'users',
      data: { email: `${role}_${unique()}@mwheba.test`, password, roles: [role] },
      context: { isSystemSeed: true },
    });
    cleanup.users.push(user.id);
    return { user, token: await loginToken(user.email, password) };
  };

  /** Places a real order through the checkout engine (quote first, then confirm that total). */
  const placeOrder = async (opts: {
    items: Record<string, unknown>[];
    paymentMethod?: 'bank_transfer' | 'cod';
    delivery?: 'pickup' | 'shipping';
  }) => {
    const cart = await getOrCreateCart(payload);
    cleanup.carts.push(cart.id);
    await payload.update({ collection: 'carts', id: cart.id, data: { items: opts.items } });

    const method = opts.delivery ?? 'pickup';
    const delivery =
      method === 'shipping'
        ? { method, shippingAddress: { governorate: 'Cairo', city: 'Maadi', streetAddress: 'Street 9' } }
        : { method };
    const quote = await buildCheckoutQuote(payload, cart.id, {
      method,
      governorate: method === 'shipping' ? 'Cairo' : undefined,
    });
    const password = 'CustomerPassword2026!';
    const email = `cust_${unique()}@mwheba.test`;
    const result = await createOrderFromCart(payload, {
      cartId: cart.id,
      guestSecret: cart.secret,
      customer: { email, password, companyName: 'Fulfillment Test Corp', contactPerson: 'Buyer', phone: '+201012345678' },
      delivery: delivery as any,
      paymentMethod: opts.paymentMethod ?? 'bank_transfer',
      expectedGrandTotal: quote.grandTotal,
    });
    cleanup.orders.push(result.order.id);
    cleanup.users.push(result.customerId);
    const jobs = await payload.find({
      collection: 'fulfillment-jobs',
      where: { order: { equals: result.order.id } },
      sort: 'lineIndex',
      limit: 50,
      depth: 0,
    });
    const customer = await payload.findByID({ collection: 'users', id: result.customerId });
    return {
      orderId: result.order.id as number,
      customer,
      customerToken: await loginToken(email, password),
      jobs: jobs.docs as any[],
    };
  };

  const jobOf = async (id: number) => payload.findByID({ collection: 'fulfillment-jobs', id, depth: 0 });
  const orderOf = async (id: number) => payload.findByID({ collection: 'orders', id, depth: 0 });

  /** A fresh private artwork file + asset (an asset can be bound to only one customer's order). */
  const makeAsset = async () => {
    const saved = await saveArtworkFile(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), `b05-${unique()}.svg`);
    const asset = await payload.create({
      collection: 'artwork-assets',
      data: {
        storageKey: saved.storageKey,
        originalFilename: 'b05-logo.svg',
        mimeType: 'image/svg+xml',
        fileSize: 40,
        status: 'pending_order',
        scanStatus: 'clean',
        verificationStatus: 'valid',
        ownerSession: 'b05-session',
      },
      context: { isTrustedUpload: true },
    });
    cleanup.assets.push(asset.id);
    cleanup.files.push(saved.absolutePath);
    return { asset, absolutePath: saved.absolutePath };
  };

  beforeAll(async () => {
    payload = await getPayload({ config: configPromise });

    flask = await payload.create({
      collection: 'products',
      data: {
        title: 'B2B-05 Flask',
        slug: `b05-flask-${unique()}`,
        itemType: 'physical',
        basePrice: 200,
        priceInEGP: 200,
        customizationFee: 30,
        minOrderQuantity: 10,
        sku: 'B05-FLASK',
        _status: 'published',
      },
    });
    service = await payload.create({
      collection: 'products',
      data: {
        title: 'B2B-05 Brand Identity Package',
        slug: `b05-service-${unique()}`,
        itemType: 'service',
        basePrice: 15000,
        priceInEGP: 15000,
        customizationFee: 0,
        minOrderQuantity: 1,
        sku: 'B05-SRV',
        _status: 'published',
      },
    });
    cleanup.products.push(flask.id, service.id);

    const ops = await createStaff('operations');
    opsUser = ops.user;
    opsToken = ops.token;
    const fin = await createStaff('finance');
    financeUser = fin.user;
    financeToken = fin.token;
    const creative = await createStaff('creative_director');
    creativeUser = creative.user;
    creativeToken = creative.token;

    // A never-attached asset: used to prove customers cannot reference files they do not own
    const made = await makeAsset();
    artworkAsset = made.asset;
    artworkAbsolutePath = made.absolutePath;
  });

  afterAll(async () => {
    const del = async (collection: string, id: any, context?: any) => {
      try {
        await payload.delete({ collection, id, context });
      } catch {
        // best effort
      }
    };
    for (const orderId of cleanup.orders) {
      const briefs = await payload.find({ collection: 'service-briefs', where: { order: { equals: orderId } }, limit: 50, depth: 0 }).catch(() => ({ docs: [] }));
      for (const b of briefs.docs as any[]) await del('service-briefs', b.id);
      const jobs = await payload.find({ collection: 'fulfillment-jobs', where: { order: { equals: orderId } }, limit: 50, depth: 0 }).catch(() => ({ docs: [] }));
      for (const j of jobs.docs as any[]) await del('fulfillment-jobs', j.id);
      await del('orders', orderId);
    }
    for (const id of cleanup.users) await del('users', id);
    for (const id of cleanup.assets) await del('artwork-assets', id, { isTrustedUpload: true });
    for (const id of cleanup.products) await del('products', id);
    for (const id of cleanup.carts) await del('carts', id);
    if (artworkAbsolutePath) await rm(artworkAbsolutePath, { force: true }).catch(() => undefined);
    for (const file of cleanup.files) await rm(file, { force: true }).catch(() => undefined);
  });

  // ===========================================================================
  // 1. State machines (pure)
  // ===========================================================================
  describe('1. Separate physical and service state machines', () => {
    it('starts each line on the correct track and status', () => {
      expect(initialStatus({ track: 'physical', customized: true })).toBe('pending_artwork_approval');
      expect(initialStatus({ track: 'physical', customized: false })).toBe('queued');
      expect(initialStatus({ track: 'service', customized: false })).toBe('pending_brief');
    });

    it('uses pickup vs shipping branches and never skips or regresses', () => {
      expect(allowedNext({ track: 'physical', from: 'quality_check', deliveryMethod: 'pickup' })).toEqual(['ready_for_pickup']);
      expect(allowedNext({ track: 'physical', from: 'quality_check', deliveryMethod: 'shipping' })).toEqual(['shipped']);
      expect(allowedNext({ track: 'physical', from: 'delivered', deliveryMethod: 'shipping' })).toEqual([]);
      expect(allowedNext({ track: 'service', from: 'completed', deliveryMethod: 'pickup' })).toEqual([]);

      const base = { deliveryMethod: 'shipping' as const, customized: false, proofApproved: false, actor: 'operator' as const };
      expect(validateTransition({ ...base, track: 'physical', from: 'queued', to: 'quality_check' }).ok).toBe(false);
      expect(validateTransition({ ...base, track: 'physical', from: 'shipped', to: 'in_printing' }).ok).toBe(false);
      // Cross-track statuses are rejected
      expect(validateTransition({ ...base, track: 'physical', from: 'queued', to: 'in_progress' as any }))
        .toMatchObject({ ok: false, code: 'WRONG_TRACK' });
      expect(validateTransition({ ...base, track: 'service', from: 'in_progress', to: 'shipped' as any }))
        .toMatchObject({ ok: false, code: 'WRONG_TRACK' });
    });
  });

  // ===========================================================================
  // 2. Job creation per line
  // ===========================================================================
  describe('2. Jobs are created per order line, split by track', () => {
    it('creates pending_artwork_approval / queued / pending_brief jobs for a mixed order', async () => {
      const { jobs } = await placeOrder({
        items: [
          { product: flask.id, quantity: 10, printingNotes: 'Engrave logo' },
          { product: service.id, quantity: 1 },
        ],
      });
      expect(jobs).toHaveLength(2);
      expect(jobs[0]).toMatchObject({ track: 'physical', status: 'pending_artwork_approval', customized: true });
      expect(jobs[1]).toMatchObject({ track: 'service', status: 'pending_brief', customized: false });
    });

    it('queues a physical line without customization immediately', async () => {
      const { jobs } = await placeOrder({ items: [{ product: flask.id, quantity: 10 }] });
      expect(jobs[0]).toMatchObject({ track: 'physical', status: 'queued', customized: false });
    });
  });

  // ===========================================================================
  // 3. Proof gate
  // ===========================================================================
  describe('3. Customized goods cannot start production before proof approval', () => {
    it('blocks every way around the gate and releases production only after the customer approves', async () => {
      const gateAsset = await makeAsset();
      const { orderId, jobs, customerToken, customer } = await placeOrder({
        items: [{ product: flask.id, quantity: 10, artworkAssetId: String(gateAsset.asset.id) }],
        delivery: 'shipping',
      });
      const jobId = jobs[0].id;
      expect((await orderOf(orderId)).proofStatus).toBe('proof_pending');

      // Operator cannot skip ahead or release the gate through the service/API
      for (const to of ['in_printing', 'shipped', 'delivered', 'queued']) {
        const res = await transitionRoute(
          asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, opsToken, { to }),
          params(jobId)
        );
        expect([403, 409]).toContain(res.status);
      }
      const gated = await transitionRoute(
        asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, opsToken, { to: 'queued' }),
        params(jobId)
      );
      expect(gated.status).toBe(403);
      expect((await gated.json()).error).toContain('CUSTOMER_APPROVAL_REQUIRED');

      // Direct edits are blocked at the data layer
      await expect(
        payload.update({ collection: 'fulfillment-jobs', id: jobId, data: { status: 'in_printing' }, user: opsUser, overrideAccess: false })
      ).rejects.toThrow(/FULFILLMENT_STATUS_ENGINE_ONLY/);
      await expect(
        payload.update({ collection: 'orders', id: orderId, data: { proofStatus: 'proof_approved' } })
      ).rejects.toThrow(/PROOF_STATUS_ENGINE_ONLY/);
      await expect(
        payload.update({
          collection: 'orders',
          id: orderId,
          data: { fulfillmentStatus: 'in_production', proofStatus: 'proof_approved' },
        })
      ).rejects.toThrow(/PROOF_STATUS_ENGINE_ONLY|PROOF_NOT_APPROVED|FULFILLMENT_STATUS_ENGINE_ONLY/);
      await expect(
        payload.update({ collection: 'orders', id: orderId, data: { fulfillmentStatus: 'in_production' } })
      ).rejects.toThrow(/PROOF_NOT_APPROVED/);

      // Operations and other customers cannot approve the proof
      const opsApprove = await approveProofRoute(asReq(`http://localhost:3000/api/orders/${orderId}/proof/approve`, opsToken), params(orderId));
      expect(opsApprove.status).toBe(404);
      const anonApprove = await approveProofRoute(asReq(`http://localhost:3000/api/orders/${orderId}/proof/approve`, null), params(orderId));
      expect(anonApprove.status).toBe(401);
      expect((await jobOf(jobId)).status).toBe('pending_artwork_approval');

      // The owner approves
      const approve = await approveProofRoute(asReq(`http://localhost:3000/api/orders/${orderId}/proof/approve`, customerToken), params(orderId));
      expect(approve.status).toBe(200);
      expect((await approve.json()).releasedJobs).toBe(1);
      const approvedOrder = await orderOf(orderId);
      expect(approvedOrder.proofStatus).toBe('proof_approved');
      expect(approvedOrder.proofApprovedAt).toBeTruthy();
      expect(String(JSON.stringify(approvedOrder.auditLog))).toContain(`customer #${customer.id}`);
      expect((await jobOf(jobId)).status).toBe('queued');

      // Approving twice is rejected
      const again = await approveProofRoute(asReq(`http://localhost:3000/api/orders/${orderId}/proof/approve`, customerToken), params(orderId));
      expect(again.status).toBe(409);

      // Production now progresses step by step; skipping is still impossible
      const step = async (to: string) =>
        transitionRoute(asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, opsToken, { to }), params(jobId));
      expect((await step('quality_check')).status).toBe(409);
      expect((await step('in_printing')).status).toBe(200);
      expect((await orderOf(orderId)).fulfillmentStatus).toBe('in_production');
      expect((await step('quality_check')).status).toBe(200);
      expect((await step('ready_for_pickup')).status).toBe(409); // shipping order
      expect((await step('shipped')).status).toBe(200);
      expect((await orderOf(orderId)).fulfillmentStatus).toBe('shipped');
      expect((await step('delivered')).status).toBe(200);
      expect((await orderOf(orderId)).fulfillmentStatus).toBe('delivered');
      expect((await step('in_printing')).status).toBe(409); // no regression

      const history = (await jobOf(jobId)).statusHistory as any[];
      expect(history.map((h) => h.to)).toEqual(['pending_artwork_approval', 'queued', 'in_printing', 'quality_check', 'shipped', 'delivered']);
    });

    it("rejects another customer's proof approval without revealing the order", async () => {
      const victim = await placeOrder({ items: [{ product: flask.id, quantity: 10, printingNotes: 'Logo' }] });
      const other = await placeOrder({ items: [{ product: flask.id, quantity: 10 }] });
      const res = await approveProofRoute(
        asReq(`http://localhost:3000/api/orders/${victim.orderId}/proof/approve`, other.customerToken),
        params(victim.orderId)
      );
      expect(res.status).toBe(404);
      expect((await orderOf(victim.orderId)).proofStatus).toBe('proof_pending');
    });

    it('lets non-customized physical lines start production without a proof', async () => {
      const { jobs } = await placeOrder({ items: [{ product: flask.id, quantity: 10 }] });
      const res = await transitionRoute(
        asReq(`http://localhost:3000/api/fulfillment/jobs/${jobs[0].id}/transition`, opsToken, { to: 'in_printing' }),
        params(jobs[0].id)
      );
      expect(res.status).toBe(200);
    });
  });

  // ===========================================================================
  // 4. COD stays unpaid
  // ===========================================================================
  describe('4. COD remains unpaid until collection is recorded', () => {
    it('keeps paymentStatus unpaid through delivery and blocks manual paid', async () => {
      const { orderId, jobs } = await placeOrder({
        items: [{ product: flask.id, quantity: 10 }],
        paymentMethod: 'cod',
        delivery: 'shipping',
      });
      let order = await orderOf(orderId);
      expect(order.paymentStatus).toBe('unpaid');
      expect(order.remittanceStatus).toBe('pending_collection');

      const jobId = jobs[0].id;
      for (const to of ['in_printing', 'quality_check', 'shipped', 'delivered']) {
        const res = await transitionRoute(asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, opsToken, { to }), params(jobId));
        expect(res.status).toBe(200);
      }
      order = await orderOf(orderId);
      expect(order.fulfillmentStatus).toBe('delivered');
      expect(order.paymentStatus).toBe('unpaid');
      expect(order.remittanceStatus).toBe('pending_collection');
      expect(order.paidAt).toBeFalsy();

      await expect(
        payload.update({ collection: 'orders', id: orderId, data: { paymentStatus: 'paid' } })
      ).rejects.toThrow(/DIRECT_COD_PAYMENT_STATUS_MUTATION_FORBIDDEN/);
      expect((await orderOf(orderId)).paymentStatus).toBe('unpaid');
    });
  });

  // ===========================================================================
  // 5. Service intake (creative track)
  // ===========================================================================
  describe('5. Service brief intake workflow', () => {
    const answers = {
      targetAudience: 'Corporate HR directors in Cairo',
      brandValues: 'Trust, precision, craft',
      existingGuidelines: 'None yet',
    };
    const briefReq = (orderId: number, token: string | null, body: any) =>
      briefRoute(asReq(`http://localhost:3000/api/orders/${orderId}/brief`, token, body), params(orderId));

    it('keeps the service track separate and requires the customer brief to start work', async () => {
      const { orderId, jobs, customerToken } = await placeOrder({ items: [{ product: service.id, quantity: 1 }] });
      const jobId = jobs[0].id;
      expect(jobs[0].status).toBe('pending_brief');

      const step = async (to: string, token = creativeToken) =>
        transitionRoute(asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, token, { to }), params(jobId));

      // Production ops and finance cannot work the service track at all
      expect((await step('in_progress', opsToken)).status).toBe(403);
      expect((await step('in_progress', financeToken)).status).toBe(403);
      // Creative cannot fake the brief or jump ahead; physical statuses do not exist on this track
      expect((await step('brief_submitted')).status).toBe(403);
      expect((await step('in_progress')).status).toBe(409);
      expect((await step('shipped')).status).toBe(409);

      // Validation, ownership, auth
      expect((await briefReq(orderId, null, { answers })).status).toBe(401);
      expect((await briefReq(orderId, customerToken, { answers: { brandValues: 'x' } })).status).toBe(400);
      expect((await briefReq(orderId, customerToken, { answers: { ...answers, targetAudience: 'x'.repeat(4001) } })).status).toBe(400);
      const foreignAsset = await briefReq(orderId, customerToken, { answers, attachmentAssetIds: [artworkAsset.id] });
      expect(foreignAsset.status).toBe(400);
      expect((await foreignAsset.json()).error).toContain('INVALID_ATTACHMENT');
      expect((await jobOf(jobId)).status).toBe('pending_brief');

      const stranger = await placeOrder({ items: [{ product: flask.id, quantity: 10 }] });
      expect((await briefReq(orderId, stranger.customerToken, { answers })).status).toBe(404);

      // The owner submits; the notification is recorded as outstanding work, never as delivered
      const ok = await briefReq(orderId, customerToken, { answers });
      expect(ok.status).toBe(200);
      const okBody = await ok.json();
      expect(okBody.notification).toEqual({ status: 'pending', delivered: false });
      expect((await jobOf(jobId)).status).toBe('brief_submitted');
      const stored = await payload.findByID({ collection: 'service-briefs', id: okBody.briefId, depth: 0 });
      expect(stored.answers.targetAudience).toBe(answers.targetAudience);
      expect(stored.notificationStatus).toBe('pending');
      expect(stored.submittedAt).toBeTruthy();
      // Nothing may mark it delivered: briefs are append-only
      await expect(
        payload.update({ collection: 'service-briefs', id: okBody.briefId, data: { notificationStatus: 'sent' } , overrideAccess: false, user: creativeUser })
      ).rejects.toThrow();

      // Duplicate submission is rejected
      expect((await briefReq(orderId, customerToken, { answers })).status).toBe(409);

      // Creative team progresses the service; order-level fulfillment is untouched
      expect((await step('review')).status).toBe(409);
      expect((await step('in_progress')).status).toBe(200);
      expect((await step('review')).status).toBe(200);
      expect((await step('completed')).status).toBe(200);
      expect((await orderOf(orderId)).fulfillmentStatus).toBe('unfulfilled');
      expect((await step('in_progress')).status).toBe(409); // terminal
    });

    it('lets only the creative team download brief attachments, and only attachments of that brief', async () => {
      const { orderId, jobs, customerToken, customer } = await placeOrder({ items: [{ product: service.id, quantity: 1 }] });
      const attachment = await makeAsset();
      // The customer's own private upload
      await payload.update({
        collection: 'artwork-assets',
        id: attachment.asset.id,
        data: { uploader: customer.id },
        context: { isTrustedUpload: true },
      });

      const res = await briefReq(orderId, customerToken, { answers, attachmentAssetIds: [attachment.asset.id] });
      expect(res.status).toBe(200);
      const { briefId } = await res.json();
      expect(jobs).toHaveLength(1);

      const link = (token: string | null, assetId: any) =>
        briefAttachmentLinkRoute(
          asReq(`http://localhost:3000/api/fulfillment/briefs/${briefId}/attachments/${assetId}/link`, token),
          { params: Promise.resolve({ id: String(briefId), assetId: String(assetId) }) }
        );

      expect((await link(null, attachment.asset.id)).status).toBe(401);
      expect((await link(opsToken, attachment.asset.id)).status).toBe(403);
      expect((await link(financeToken, attachment.asset.id)).status).toBe(403);
      expect((await link(customerToken, attachment.asset.id)).status).toBe(403);
      expect((await link(creativeToken, artworkAsset.id)).status).toBe(404); // not an attachment of this brief

      const ok = await link(creativeToken, attachment.asset.id);
      expect(ok.status).toBe(200);
      const { url } = await ok.json();
      const file = await artworkDownloadRoute(new NextRequest(`http://localhost:3000${url}`), params(attachment.asset.id));
      expect(file.status).toBe(200);
      expect(Buffer.from(await file.arrayBuffer()).toString()).toBe((await readFile(attachment.absolutePath)).toString());
    });
  });

  // ===========================================================================
  // 6. Concurrency: one brief per service job
  // ===========================================================================
  describe('6. Concurrent brief submissions create exactly one brief', () => {
    const answers = { targetAudience: 'Audience', brandValues: 'Values' };

    it('serializes simultaneous submissions (2 and 6 parallel requests)', async () => {
      for (const parallel of [2, 6]) {
        const { orderId, jobs, customer } = await placeOrder({ items: [{ product: service.id, quantity: 1 }] });
        const jobId = jobs[0].id;
        const user = { id: customer.id, roles: ['customer'] };

        const results = await Promise.allSettled(
          Array.from({ length: parallel }, () => submitServiceBrief(payload, { orderId, user, answers }))
        );

        const fulfilled = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
        expect(fulfilled).toHaveLength(1);
        expect(rejected).toHaveLength(parallel - 1);
        for (const r of rejected) {
          expect(String(r.reason?.message)).toMatch(/BRIEF_NOT_EXPECTED/);
          expect(r.reason?.statusCode).toBe(409);
        }

        const briefs = await payload.find({ collection: 'service-briefs', where: { job: { equals: jobId } }, limit: 20, depth: 0 });
        expect(briefs.totalDocs).toBe(1);
        const job = await jobOf(jobId);
        expect(job.status).toBe('brief_submitted');
        expect((job.statusHistory as any[]).filter((h) => h.to === 'brief_submitted')).toHaveLength(1);
        expect(orderId).toBeTruthy();
      }
    });

    it('is enforced by the database itself: a second brief row for the same job is impossible', async () => {
      const { orderId, jobs, customer } = await placeOrder({ items: [{ product: service.id, quantity: 1 }] });
      const jobId = jobs[0].id;
      await submitServiceBrief(payload, { orderId, user: { id: customer.id, roles: ['customer'] }, answers });

      // Bypass the service entirely and insert directly
      await expect(
        payload.create({
          collection: 'service-briefs',
          data: { order: orderId, job: jobId, customer: customer.id, answers, submittedAt: new Date().toISOString() },
          context: { fulfillmentEngine: true },
        })
      ).rejects.toThrow();

      const indexes = await (payload.db as any).drizzle.execute(
        sql`SELECT indexdef FROM pg_indexes WHERE tablename = 'service_briefs' AND indexname = 'service_briefs_job_idx'`
      );
      expect(String(indexes.rows[0]?.indexdef)).toContain('UNIQUE');
      expect((await payload.find({ collection: 'service-briefs', where: { job: { equals: jobId } }, depth: 0 })).totalDocs).toBe(1);
    });
  });

  // ===========================================================================
  // 7. Permissions: production vs creative vs finance, private downloads
  // ===========================================================================
  describe('7. Role separation and private artwork downloads', () => {
    it('limits job transitions and artwork links to the right team', async () => {
      const dl = await makeAsset();
      const dlAsset = dl.asset;
      const { jobs, customerToken, orderId } = await placeOrder({
        items: [{ product: flask.id, quantity: 10, artworkAssetId: String(dlAsset.id) }],
      });
      const jobId = jobs[0].id;
      const link = (token: string | null) =>
        artworkLinkRoute(asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/artwork-link`, token), params(jobId));
      const move = (token: string | null) =>
        transitionRoute(asReq(`http://localhost:3000/api/fulfillment/jobs/${jobId}/transition`, token, { to: 'queued' }), params(jobId));

      expect((await link(null)).status).toBe(401);
      expect((await link(financeToken)).status).toBe(403);
      expect((await link(creativeToken)).status).toBe(403);
      expect((await link(customerToken)).status).toBe(403);
      expect((await move(null)).status).toBe(401);
      expect((await move(financeToken)).status).toBe(403);
      expect((await move(creativeToken)).status).toBe(403); // creative cannot touch physical jobs
      expect((await move(customerToken)).status).toBe(403);

      const ok = await link(opsToken);
      expect(ok.status, await ok.clone().text()).toBe(200);
      const { url, expiresIn } = await ok.json();
      expect(expiresIn).toBeGreaterThan(0);
      expect(expiresIn).toBeLessThanOrEqual(900);

      // The link is bound to this asset and actually serves the private file
      const token = new URL(`http://localhost:3000${url}`).searchParams.get('token')!;
      expect(verifyArtworkDownloadToken(token, String(dlAsset.id))).toBeTruthy();
      expect(verifyArtworkDownloadToken(token, '999999')).toBeFalsy();

      const file = await artworkDownloadRoute(new NextRequest(`http://localhost:3000${url}`), params(dlAsset.id));
      expect(file.status, await file.clone().text()).toBe(200);
      expect(file.headers.get('cache-control')).toContain('no-store');
      expect(Buffer.from(await file.arrayBuffer()).toString()).toBe((await readFile(dl.absolutePath)).toString());

      // Tampered, foreign-asset and token-less requests are refused
      expect((await artworkDownloadRoute(new NextRequest(`http://localhost:3000${url}x`), params(dlAsset.id))).status).toBe(403);
      expect((await artworkDownloadRoute(new NextRequest(`http://localhost:3000${url}`), params(999999))).status).toBe(403);
      const tokenless = await artworkDownloadRoute(
        new NextRequest(`http://localhost:3000/api/customization/artwork/${dlAsset.id}/download`),
        params(dlAsset.id)
      );
      expect(tokenless.status).toBe(403);

      // Service jobs have no production artwork to download
      const svc = await placeOrder({ items: [{ product: service.id, quantity: 1 }] });
      const svcLink = await artworkLinkRoute(
        asReq(`http://localhost:3000/api/fulfillment/jobs/${svc.jobs[0].id}/artwork-link`, opsToken),
        params(svc.jobs[0].id)
      );
      expect(svcLink.status).toBe(404);
      expect(orderId).toBeTruthy();
    });

    it('does not leave the legacy artwork signing route as a back door for finance (or creative)', async () => {
      const legacyAsset = await makeAsset();
      const sign = (token: string | null) =>
        legacySignRoute(asReq(`http://localhost:3000/api/customization/artwork/${legacyAsset.asset.id}/sign`, token), params(legacyAsset.asset.id));

      expect((await sign(financeToken)).status).toBe(403);
      expect((await sign(creativeToken)).status).toBe(403);
      expect((await sign(null)).status).toBe(403);
      expect((await sign(opsToken)).status).toBe(200);

      // Collection-level read is closed to finance as well
      const financeRead = await payload.find({ collection: 'artwork-assets', user: financeUser, overrideAccess: false, depth: 0 });
      expect(financeRead.docs.some((a: any) => String(a.id) === String(legacyAsset.asset.id))).toBe(false);
    });

    it('enforces collection access: production sees physical jobs only, creative sees service jobs only, finance sees none', async () => {
      const mine = await placeOrder({
        items: [
          { product: flask.id, quantity: 10 },
          { product: service.id, quantity: 1 },
        ],
      });
      const theirs = await placeOrder({ items: [{ product: flask.id, quantity: 10 }] });
      const read = (user: any) =>
        payload.find({ collection: 'fulfillment-jobs', user, overrideAccess: false, limit: 200, depth: 0 }).catch(() => ({ docs: [] as any[] }));

      const ops = await read(opsUser);
      expect(ops.docs.length).toBeGreaterThan(0);
      expect(ops.docs.every((j: any) => j.track === 'physical')).toBe(true);

      const creative = await read(creativeUser);
      expect(creative.docs.length).toBeGreaterThan(0);
      expect(creative.docs.every((j: any) => j.track === 'service')).toBe(true);

      expect((await read(financeUser)).docs).toHaveLength(0);

      // Customers: only their own order's jobs
      const own = await read(mine.customer);
      expect(own.docs.length).toBe(2);
      expect(own.docs.every((j: any) => String(j.order) === String(mine.orderId))).toBe(true);
      expect(own.docs.some((j: any) => String(j.order) === String(theirs.orderId))).toBe(false);

      // Service briefs: creative only (production and finance excluded)
      const briefs = (user: any) =>
        payload.find({ collection: 'service-briefs', user, overrideAccess: false, depth: 0 }).catch(() => ({ docs: [] as any[] }));
      expect((await briefs(opsUser)).docs).toHaveLength(0);
      expect((await briefs(financeUser)).docs).toHaveLength(0);

      // Customers cannot edit or create jobs; nobody can create jobs through the API
      await expect(
        payload.update({ collection: 'fulfillment-jobs', id: mine.jobs[0].id, data: { status: 'delivered' }, user: mine.customer, overrideAccess: false })
      ).rejects.toThrow();
      for (const user of [mine.customer, opsUser, creativeUser]) {
        await expect(
          payload.create({
            collection: 'fulfillment-jobs',
            data: { order: mine.orderId, lineIndex: 9, track: 'physical', status: 'queued' },
            user,
            overrideAccess: false,
          })
        ).rejects.toThrow();
      }

      // Immutable identity fields
      await expect(
        payload.update({
          collection: 'fulfillment-jobs',
          id: mine.jobs[0].id,
          data: { track: 'service' },
          context: { fulfillmentEngine: true },
        })
      ).rejects.toThrow(/FULFILLMENT_JOB_FIELD_IMMUTABLE/);
    });
  });

  // ===========================================================================
  // 8. Customer brief form (client component) against the real API
  // ===========================================================================
  describe('8. Brief submission page component', () => {
    it('shows sign-in when anonymous, and submits the brief for the signed-in owner', async () => {
      (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
      const window = new Window();
      const document = window.document;
      const originalWindow = global.window;
      const originalDocument = global.document;
      const originalFetch = global.fetch;
      global.window = window as any;
      global.document = document as any;

      const { orderId, jobs, customerToken, customer } = await placeOrder({ items: [{ product: service.id, quantity: 1 }] });
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container as any);
      const text = () => container.textContent || '';
      const setValue = (el: any, value: string) => {
        const propsKey = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
        const props = propsKey ? el[propsKey] : null;
        if (!props?.onChange) throw new Error('Input has no React onChange handler');
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
        props.onChange({ target: el, currentTarget: el });
      };

      global.fetch = (async (url: string, init?: any) => {
        const req = new NextRequest(`http://localhost:3000${url}`, {
          method: init?.method || 'GET',
          headers: { 'Content-Type': 'application/json', Authorization: `JWT ${customerToken}`, ...(init?.headers || {}) },
          body: init?.body,
        });
        if (url === `/api/orders/${orderId}/brief`) return briefRoute(req, params(orderId));
        throw new Error(`Unexpected fetch ${url}`);
      }) as any;

      const summary = jobs.map((j: any) => ({ id: j.id, title: j.productTitle, status: j.status }));
      try {
        // Anonymous: only the sign-in panel, no order details
        await act(async () => {
          root.render(React.createElement(ServiceBriefForm, { locale: 'en', orderId, orderNumber: null, authenticated: false, jobs: [] }));
          await wait(20);
        });
        expect(text()).toContain('Sign in to submit your brief');
        expect(container.querySelector('textarea')).toBeNull();

        // Authenticated owner: the form
        await act(async () => {
          root.render(React.createElement(ServiceBriefForm, { locale: 'en', orderId, orderNumber: 'MWH-TEST', authenticated: true, jobs: summary }));
          await wait(20);
        });
        expect(text()).toContain('Creative Brief');
        const areas = Array.from(container.querySelectorAll('textarea')) as any[];
        expect(areas.length).toBe(4);
        await act(async () => {
          setValue(areas[0], 'Procurement managers');
          setValue(areas[1], 'Reliability and craft');
          await wait(20);
        });

        const form = container.querySelector('form') as any;
        await act(async () => {
          form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
          await wait(50);
        });
        for (let i = 0; i < 40 && !text().includes('received and recorded'); i++) {
          await act(async () => {
            await wait(100);
          });
        }
        expect(text(), text()).toContain('received and recorded');
        expect(text().toLowerCase()).not.toContain('notified');

        const stored = await payload.find({ collection: 'service-briefs', where: { order: { equals: orderId } }, depth: 0 });
        expect(stored.totalDocs).toBe(1);
        expect((stored.docs[0] as any).answers.targetAudience).toBe('Procurement managers');
        expect(String((stored.docs[0] as any).customer)).toBe(String(customer.id));
        expect((await jobOf(jobs[0].id)).status).toBe('brief_submitted');

      } finally {
        await act(async () => {
          root.unmount();
          await wait(20);
        });
        global.window = originalWindow;
        global.document = originalDocument;
        global.fetch = originalFetch;
      }
    });
  });
});
