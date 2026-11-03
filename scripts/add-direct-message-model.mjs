// scripts/add-direct-message-model.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const schemaPath = path.resolve('packages/db/prisma/schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. Add platformDirectMessages to Business
if (!schema.includes('platformDirectMessages')) {
  schema = schema.replace(
    '  platformSupportTickets     PlatformSupportTicket[]\r\n}',
    '  platformSupportTickets     PlatformSupportTicket[]\r\n  platformDirectMessages     PlatformDirectMessage[]\r\n}'
  );
}

// 2. Add relations to User
if (!schema.includes('sentDirectMessages')) {
  schema = schema.replace(
    '  platformSupportTickets     PlatformSupportTicket[]     @relation("PlatformTicketAuthor")\r\n',
    '  platformSupportTickets     PlatformSupportTicket[]     @relation("PlatformTicketAuthor")\r\n  sentDirectMessages         PlatformDirectMessage[]     @relation("DirectMessageSender")\r\n  receivedDirectMessages     PlatformDirectMessage[]     @relation("DirectMessageReceiver")\r\n'
  );
}

// 3. Add PlatformDirectMessage model
if (!schema.includes('model PlatformDirectMessage')) {
  schema += `\r\nmodel PlatformDirectMessage {\r\n  id         String    @id @default(uuid())\r\n  businessId String\r\n  business   Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)\r\n  senderId   String\r\n  sender     User      @relation("DirectMessageSender", fields: [senderId], references: [id], onDelete: Cascade)\r\n  receiverId String\r\n  receiver   User      @relation("DirectMessageReceiver", fields: [receiverId], references: [id], onDelete: Cascade)\r\n  content    String\r\n  isRead     Boolean   @default(false)\r\n  readAt     DateTime?\r\n  isBlocked  Boolean   @default(false)\r\n  createdAt  DateTime  @default(now())\r\n\r\n  @@index([businessId, createdAt])\r\n  @@index([senderId, receiverId, createdAt])\r\n}\r\n`;
}

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('Updated schema.prisma successfully.');

// Run prisma db push
console.log('Applying prisma db push...');
spawnSync('node', ['scripts/run-prisma-push.mjs'], { stdio: 'inherit', shell: true });

// Copy prisma engines
console.log('Copying prisma engines...');
spawnSync('node', ['scripts/copy-prisma-engines.mjs'], { stdio: 'inherit', shell: true });
console.log('All database migrations and client generation completed!');

