// scripts/add-push-broadcast-model.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const schemaPath = path.resolve('packages/db/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. Add pushBroadcastsCreated to User
if (!schema.includes('pushBroadcastsCreated')) {
  schema = schema.replace(
    '  receivedDirectMessages     PlatformDirectMessage[]     @relation("DirectMessageReceiver")\r\n',
    '  receivedDirectMessages     PlatformDirectMessage[]     @relation("DirectMessageReceiver")\r\n  pushBroadcastsCreated      PlatformPushBroadcast[]     @relation("PushBroadcastAuthor")\r\n'
  );
}

// 2. Add PlatformPushBroadcast model
if (!schema.includes('model PlatformPushBroadcast')) {
  schema += `\r\nmodel PlatformPushBroadcast {\r\n  id             String    @id @default(uuid())\r\n  title          String\r\n  body           String\r\n  targetRole     String    @default("ALL") // ALL, OWNER, MANAGER, CASHIER, STAFF\r\n  targetProperty String    @default("ALL") // ALL or businessId\r\n  propertySlug   String?\r\n  propertyName   String?\r\n  imageUrl       String?\r\n  channels       String[]  @default(["IN_APP", "PUSH"])\r\n  sentCount      Int       @default(0)\r\n  status         String    @default("DELIVERED") // DELIVERED, PENDING, FAILED\r\n  createdById    String\r\n  createdBy      User      @relation("PushBroadcastAuthor", fields: [createdById], references: [id], onDelete: Cascade)\r\n  createdAt      DateTime  @default(now())\r\n\r\n  @@index([targetRole, createdAt])\r\n  @@index([targetProperty, createdAt])\r\n}\r\n`;
}

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('Updated schema.prisma with PlatformPushBroadcast successfully.');

// Run prisma db push
console.log('Applying prisma db push...');
spawnSync('node', ['scripts/run-prisma-push.mjs'], { stdio: 'inherit', shell: true });

// Run prisma generate
console.log('Generating prisma client...');
spawnSync('node', ['node_modules/prisma/build/index.js', 'generate', '--schema', 'packages/db/prisma/schema.prisma'], { stdio: 'inherit', shell: true });

// Copy prisma engines
console.log('Copying prisma engines...');
spawnSync('node', ['scripts/copy-prisma-engines.mjs'], { stdio: 'inherit', shell: true });

console.log('Database schema updated and client generated successfully!');

