import { handleCreateCashMovement } from "../cash-movement/route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return handleCreateCashMovement(request, id, "CASH_OUT");
}

