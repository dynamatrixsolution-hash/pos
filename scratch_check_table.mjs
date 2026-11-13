import { PrismaClient } from "./packages/db/client/index.js";
const prisma = new PrismaClient();
async function check() {
  const table = await prisma.restaurantTable.findUnique({
    where: { id: "63b6dc28-d92c-4fc6-8a38-925de4202e15" },
    include: { tableSessions: { where: { status: "ACTIVE" } } }
  });
  console.log("TABLE:", table?.tableNumber, "STATUS:", table?.status, "currentSessionId:", table?.currentSessionId);
  console.log("ACTIVE SESSIONS:", table?.tableSessions);
}
check().finally(() => prisma.$disconnect());

