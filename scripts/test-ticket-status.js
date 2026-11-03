const fs = require('fs');
const path = require('path');

if (fs.existsSync('.env.restro.local')) {
  const envContent = fs.readFileSync('.env.restro.local', 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      process.env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
  }
}

const { PrismaClient } = require(path.resolve(__dirname, '../packages/db/client'));
const prisma = new PrismaClient();

async function main() {
  const ticket = await prisma.kitchenTicket.findFirst({
    include: {
      lines: { include: { orderLine: true } },
      order: true
    }
  });

  console.log('Ticket detail:');
  console.log('ID:', ticket.id);
  console.log('businessId:', ticket.businessId);
  console.log('branchId:', ticket.branchId);

  // Check if branch exists
  const branch = await prisma.branch.findUnique({ where: { id: ticket.branchId } });
  console.log('Branch exists:', !!branch, branch?.name);

  // Check consumption postings
  const postings = await prisma.consumptionPosting.findMany({
    where: { ticketLineId: ticket.lines[0]?.id }
  });
  console.log('Consumption postings:', postings.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
