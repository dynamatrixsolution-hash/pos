import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse } from "@/lib/api-helper";

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();

  try {
    const body = await request.json();
    const { title, description, priority } = body;

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 });
    }

    const platform = await db.business.findUnique({
      where: { slug: "platform-admin" },
    });

    if (!platform) {
      return NextResponse.json({ error: "Platform configurations not initialized" }, { status: 404 });
    }

    const settings = (platform.settings as any) || {};
    const tickets = settings.tickets || [];

    const user = await db.user.findUnique({
      where: { id: context.userId },
      select: { name: true, email: true },
    });

    const business = await db.business.findUnique({
      where: { id: context.businessId },
      select: { name: true },
    });

    const newTicket = {
      id: `tick-${Date.now()}`,
      businessName: business?.name || "Unknown Business",
      ownerName: user?.name || "Unknown User",
      email: user?.email || "no-email@merchant.com",
      title: title.trim(),
      description: description.trim(),
      priority: priority || "MEDIUM",
      status: "OPEN",
      createdAt: new Date().toISOString(),
      replies: [],
    };

    const updatedTickets = [newTicket, ...tickets];

    await db.business.update({
      where: { id: platform.id },
      data: {
        settings: {
          ...settings,
          tickets: updatedTickets,
        },
      },
    });

    return NextResponse.json({ message: "Support ticket registered successfully", ticket: newTicket });
  } catch (error: any) {
    console.error("POST support ticket registration error:", error);
    return NextResponse.json({ error: "Failed to register support ticket" }, { status: 500 });
  }
}
