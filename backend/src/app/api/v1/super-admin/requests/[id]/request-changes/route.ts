import { POST as handleRequestAction } from "../route";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let bodyData: any = {};
  try {
    bodyData = await request.json();
  } catch {
    bodyData = {};
  }

  const syntheticRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({
      ...bodyData,
      action: "REQUEST_CHANGES",
      adminNotes: bodyData.adminNotes || bodyData.reason,
    }),
  });

  return handleRequestAction(syntheticRequest, context);
}

