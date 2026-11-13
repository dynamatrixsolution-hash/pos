import { PrismaClient } from "./packages/db/client/index.js";
const prisma = new PrismaClient();
async function check() {
  const session = await prisma.tableSession.findUnique({
    where: { id: "ebbf44d7-aece-437d-b9a3-b44e09247959" },
    include: { restaurantOrders: true }
  });
  console.log("ORDERS IN SESS-20261112-0001:", session?.restaurantOrders);
}
check().finally(() => prisma.$disconnect());

