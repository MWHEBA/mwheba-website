/**
 * Standalone Worker Process for Cross-Process COD Concurrency Testing
 * Runs in an isolated Node.js OS process with zero shared in-memory state.
 */

import configPromise from '../../src/payload.config';
import { getPayload } from 'payload';
import { recordCodCollection, reconcileCourierRemittanceBatch } from '../../src/logic/codEngine';

async function main() {
  const args = process.argv.slice(2);
  const action = args[0];

  if (!action) {
    console.error('Usage: tsx standaloneCodWorker.ts <action> [...params]');
    process.exit(1);
  }

  const payload = await getPayload({ config: configPromise });

  if (action === 'record_collection') {
    // Usage: tsx standaloneCodWorker.ts record_collection <orderId> <amount> <collectorType> <collectorName> <receiptRef> <actorId> <actorRolesCommaSeparated>
    const orderId = Number(args[1]) || args[1];
    const amount = Number(args[2]);
    const collectorType = args[3] as 'courier' | 'office_staff';
    const collectorName = args[4];
    const receiptReference = args[5];
    const actorId = args[6];
    const roles = (args[7] || 'admin,finance').split(',');

    try {
      const result = await recordCodCollection(payload, {
        orderId,
        collectedAmount: amount,
        collectorType,
        collectorName,
        receiptReference,
        actor: { id: actorId, roles },
      });
      console.log(JSON.stringify(result));
      setTimeout(() => process.exit(0), 100);
    } catch (err: any) {
      console.log(JSON.stringify({ error: err.message || String(err), statusCode: err.statusCode || 500 }));
      setTimeout(() => process.exit(0), 100);
    }
  } else if (action === 'reconcile_remittance') {
    // Usage: tsx standaloneCodWorker.ts reconcile_remittance <batchId> <courier> <orderIdsCSV> <gross> <net> <depositSlip> <actorId> <actorRolesCommaSeparated>
    const batchId = args[1];
    const courierCompany = args[2];
    const orderIds = args[3].split(',').map((id) => (Number(id) ? Number(id) : id));
    const grossCollectedAmount = Number(args[4]);
    const netDepositAmount = Number(args[5]);
    const depositSlipReference = args[6];
    const actorId = args[7];
    const roles = (args[8] || 'finance').split(',');

    try {
      const result = await reconcileCourierRemittanceBatch(payload, {
        batchId,
        courierCompany,
        orderIds,
        grossCollectedAmount,
        netDepositAmount,
        depositSlipReference,
        depositDate: new Date().toISOString(),
        actor: { id: actorId, roles },
      });
      console.log(JSON.stringify(result));
      setTimeout(() => process.exit(0), 100);
    } catch (err: any) {
      console.log(JSON.stringify({ error: err.message || String(err), statusCode: err.statusCode || 500 }));
      setTimeout(() => process.exit(0), 100);
    }
  } else if (action === 'approve_bank_transfer') {
    // Usage: tsx standaloneCodWorker.ts approve_bank_transfer <transferId> <confirmedAmount> <internalReconciliationCode> <actorId> <actorRolesCommaSeparated>
    const transferId = Number(args[1]) || args[1];
    const confirmedAmount = Number(args[2]);
    const internalReconciliationCode = args[3];
    const actorId = args[4];
    const roles = (args[5] || 'finance').split(',');

    try {
      const result = await payload.update({
        collection: 'bank-transfers',
        id: transferId,
        data: {
          status: 'approved',
          confirmedAmount,
          internalReconciliationCode,
        },
        user: { id: actorId, roles },
      });
      console.log(JSON.stringify(result));
      setTimeout(() => process.exit(0), 100);
    } catch (err: any) {
      console.log(JSON.stringify({ error: err.message || String(err), statusCode: err.statusCode || 500 }));
      setTimeout(() => process.exit(0), 100);
    }
  } else {
    console.error(`Unknown action: ${action}`);
    setTimeout(() => process.exit(1), 100);
  }
}

main().catch((err) => {
  console.error(err);
  setTimeout(() => process.exit(1), 100);
});
