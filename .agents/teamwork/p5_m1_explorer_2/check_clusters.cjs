const { readFileSync } = require('fs');
const { PrismaClient } = require('../../../packages/db/client/index.js');

async function check() {
  const env = Object.fromEntries(
    readFileSync('.env.restro.local', 'utf8')
      .split(/\r?\n/)
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
  );
  const client = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  const migrations = await client.$queryRaw`SELECT migration_name, checksum, finished_at FROM "_prisma_migrations" ORDER BY migration_name`;
  console.log('Source (55439) Migrations count:', migrations.length);
  for (const m of migrations) {
    console.log('  -', m.migration_name, m.finished_at ? 'FINISHED' : 'PENDING');
  }
  await client.$disconnect();

  const restoreEnv = Object.fromEntries(
    readFileSync('.env.restro-restore.local', 'utf8')
      .split(/\r?\n/)
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
  );
  const restoreClient = new PrismaClient({ datasources: { db: { url: restoreEnv.RESTORE_TARGET_DATABASE_URL } } });
  const restoreMigrations = await restoreClient.$queryRaw`SELECT migration_name, checksum, finished_at FROM "_prisma_migrations" ORDER BY migration_name`;
  console.log('Restore (55440) Migrations count:', restoreMigrations.length);
  for (const m of restoreMigrations) {
    console.log('  -', m.migration_name, m.finished_at ? 'FINISHED' : 'PENDING');
  }
  await restoreClient.$disconnect();
}

check().catch(console.error);
