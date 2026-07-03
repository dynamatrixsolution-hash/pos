import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionContext, authErrorResponse, roleErrorResponse } from "@/lib/api-helper";

// Support center tickets can be stored in the platform-admin business settings as JSON
export async function GET(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const platform = await db.business.findUnique({
      where: { slug: "platform-admin" },
      select: { settings: true },
    });

    const settings = (platform?.settings as any) || {};

    const tickets = settings.tickets || [
      {
        id: "tick-1",
        businessName: "DynaPOS Retail Demo",
        ownerName: "Alex Owner",
        email: "owner@dynapos.com",
        title: "Barcode Scanner connection lag",
        description: "Scanning multiple items rapidly has a 1-second delay in receipt list update. Please check our workspace configurations.",
        priority: "MEDIUM",
        status: "OPEN",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        replies: [],
      },
      {
        id: "tick-2",
        businessName: "Apex Retailers Ltd.",
        ownerName: "Marcus Vance",
        email: "marcus@apex.com",
        title: "Database sync failed on batch stock opening",
        description: "We are trying to load 200 opening batches for pharmaceutical stock, but the transaction timed out. Need schema size override.",
        priority: "HIGH",
        status: "OPEN",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        replies: [],
      },
      {
        id: "tick-3",
        businessName: "Metropolitan Supermarket",
        ownerName: "Dr. Sarah Lin",
        email: "sarah@metromart.com",
        title: "Plan upgrade transaction logs not updated",
        description: "Paid professional pricing but status showed trial for about 20 minutes before updating automatically.",
        priority: "LOW",
        status: "RESOLVED",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        replies: ["Platform settings updated, transaction reconciled. Thank you!"],
      },
    ];

    const announcements = settings.announcements || [
      {
        id: "ann-1",
        title: "Database Maintenance Window",
        message: "DynaOne servers will undergo routine performance audits on Sunday at 02:00 UTC. Uptime should remain unaffected.",
        target: "ALL_MERCHANTS",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
        active: true,
      },
      {
        id: "ann-2",
        title: "Version 2.4.0 Release Notes",
        message: "Pharmacy batch expiry warning thresholds can now be custom set on each individual product details form.",
        target: "PHARMACY_SECTOR",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
        active: true,
      },
    ];

    return NextResponse.json({ tickets, announcements });
  } catch (error: any) {
    console.error("GET support ticket index error:", error);
    return NextResponse.json({ error: "Failed to compile support dashboard data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const context = await getSessionContext();
  if (!context) return authErrorResponse();
  if (context.role !== "SUPER_ADMIN") return roleErrorResponse();

  try {
    const body = await request.json();
    const { action, payload } = body;

    const platform = await db.business.findUnique({
      where: { slug: "platform-admin" },
    });

    if (!platform) {
      return NextResponse.json({ error: "Platform configurations not initialized" }, { status: 404 });
    }

    const settings = (platform.settings as any) || {};
    const tickets = settings.tickets || [
      {
        id: "tick-1",
        businessName: "DynaPOS Retail Demo",
        ownerName: "Alex Owner",
        email: "owner@dynapos.com",
        title: "Barcode Scanner connection lag",
        description: "Scanning multiple items rapidly has a 1-second delay in receipt list update. Please check our workspace configurations.",
        priority: "MEDIUM",
        status: "OPEN",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
        replies: [],
      },
      {
        id: "tick-2",
        businessName: "Apex Retailers Ltd.",
        ownerName: "Marcus Vance",
        email: "marcus@apex.com",
        title: "Database sync failed on batch stock opening",
        description: "We are trying to load 200 opening batches for pharmaceutical stock, but the transaction timed out. Need schema size override.",
        priority: "HIGH",
        status: "OPEN",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        replies: [],
      },
      {
        id: "tick-3",
        businessName: "Metropolitan Supermarket",
        ownerName: "Dr. Sarah Lin",
        email: "sarah@metromart.com",
        title: "Plan upgrade transaction logs not updated",
        description: "Paid professional pricing but status showed trial for about 20 minutes before updating automatically.",
        priority: "LOW",
        status: "RESOLVED",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        replies: ["Platform settings updated, transaction reconciled. Thank you!"],
      },
    ];

    const announcements = settings.announcements || [
      {
        id: "ann-1",
        title: "Database Maintenance Window",
        message: "DynaOne servers will undergo routine performance audits on Sunday at 02:00 UTC. Uptime should remain unaffected.",
        target: "ALL_MERCHANTS",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
        active: true,
      },
      {
        id: "ann-2",
        title: "Version 2.4.0 Release Notes",
        message: "Pharmacy batch expiry warning thresholds can now be custom set on each individual product details form.",
        target: "PHARMACY_SECTOR",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
        active: true,
      },
    ];

    if (action === "REPLY_TICKET") {
      const { ticketId, replyText } = payload;
      const updatedTickets = tickets.map((t: any) => {
        if (t.id === ticketId) {
          return {
            ...t,
            status: "RESOLVED",
            replies: [...t.replies, replyText],
          };
        }
        return t;
      });

      await db.business.update({
        where: { id: platform.id },
        data: {
          settings: {
            ...settings,
            tickets: updatedTickets,
          },
        },
      });

      return NextResponse.json({ message: "Reply recorded and ticket resolved successfully" });
    }

    if (action === "ADD_ANNOUNCEMENT") {
      const { title, message, target } = payload;
      const newAnn = {
        id: `ann-${Date.now()}`,
        title,
        message,
        target,
        createdAt: new Date().toISOString(),
        active: true,
      };

      const updatedAnnouncements = [newAnn, ...announcements];

      await db.business.update({
        where: { id: platform.id },
        data: {
          settings: {
            ...settings,
            announcements: updatedAnnouncements,
          },
        },
      });

      return NextResponse.json({ message: "Notice bulletin published successfully" });
    }

    return NextResponse.json({ error: "Action not recognized" }, { status: 400 });
  } catch (error: any) {
    console.error("POST support action error:", error);
    return NextResponse.json({ error: "Failed to perform support audit action" }, { status: 500 });
  }
}
