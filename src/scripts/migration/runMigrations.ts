import { getPayload } from 'payload';
import config from '../../payload.config';

async function main() {
  const payload = await getPayload({ config });
  console.log('Running migrations...');
  await payload.db.migrate();
  console.log('Migrations completed successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
