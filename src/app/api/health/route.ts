import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  let dbStatus = 'disconnected';
  let dbLatencyMs = -1;

  try {
    const payload = await getPayload({ config });
    const count = await payload.count({ collection: 'users' });
    dbStatus = typeof count?.totalDocs === 'number' ? 'connected' : 'unknown';
    dbLatencyMs = Date.now() - startedAt;
  } catch (err: any) {
    dbStatus = `error: ${err.message || 'unknown'}`;
  }

  const isHealthy = dbStatus === 'connected';

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
