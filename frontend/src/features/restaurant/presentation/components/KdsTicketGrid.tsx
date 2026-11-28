"use client";

import React, { useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  UtensilsCrossed,
  Store,
  ShoppingBag,
  Truck,
  RotateCcw,
  Check,
  X,
} from "lucide-react";
import {
  useRestaurantKdsStore,
  KitchenTicketItem,
  TicketLineItem,
} from "../../state/restaurant-kds.store";

function formatElapsedTime(isoDate: string, now: number) {
  if (!isoDate) return { display: "0s", isDelayed: false, isWarning: false };
  const totalSecs = Math.max(0, Math.floor((now - new Date(isoDate).getTime()) / 1000));
  const totalMins = Math.floor(totalSecs / 60);
  const totalHours = Math.floor(totalMins / 60);
  const totalDays = Math.floor(totalHours / 24);

  let display: string;
  if (totalDays > 0) {
    const remH = totalHours % 24;
    display = remH > 0 ? `${totalDays}d ${remH}h` : `${totalDays}d`;
  } else if (totalHours > 0) {
    const remM = totalMins % 60;
    display = remM > 0 ? `${totalHours}h ${remM}m` : `${totalHours}h`;
  } else if (totalMins > 0) {
    display = `${totalMins}m ${(totalSecs % 60).toString().padStart(2, "0")}s`;
  } else {
    display = `${totalSecs}s`;
  }

  return {
    display,
    isDelayed: totalMins >= 15,
    isWarning: totalMins >= 8 && totalMins < 15,
  };
}

/** Strips internal system routing tags like [DINE-IN] so chefs only see real notes & parcel tags. */
function parseLineNote(raw?: string | null): { isParcel: boolean; cleanNote: string } {
  if (!raw) return { isParcel: false, cleanNote: "" };
  const isParcel = /\b(TAKEAWAY|PARCEL)\b/i.test(raw);
  const cleanNote = raw
    .replace(/\[(DINE-IN|TAKEAWAY|DELIVERY|PARCEL)\]/gi, "")
    .trim();
  return { isParcel, cleanNote };
}

const LINE_STATUS_META = {
  QUEUED: { label: "New", badge: "bg-[#EEE7DD] text-[#71675E] border-[#D8CEC1]" },
  PREPARING: { label: "Cooking", badge: "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]" },
  READY: { label: "Ready", badge: "bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]" },
  SERVED: { label: "Served", badge: "bg-[#EDF4F9] text-[#315F85] border-[#B8D2E6]" },
  CANCELLED: { label: "Cancelled", badge: "bg-[#FAEAEC] text-[#B33432] border-[#E9B6B7]" },
} as const;

export const KdsTicketGrid: React.FC = () => {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const tickets = useRestaurantKdsStore((s) => s.tickets);
  const servedTickets = useRestaurantKdsStore((s) => s.servedTickets);
  const activeTab = useRestaurantKdsStore((s) => s.activeTab);

  const selectedStationId = useRestaurantKdsStore((s) => s.selectedStationId);
  const selectedFloorId = useRestaurantKdsStore((s) => s.selectedFloorId);
  const selectedOrderType = useRestaurantKdsStore((s) => s.selectedOrderType);

  const updateTicketStatus = useRestaurantKdsStore((s) => s.updateTicketStatus);
  const updateLineStatus = useRestaurantKdsStore((s) => s.updateLineStatus);
  const updatingLineIds = useRestaurantKdsStore((s) => s.updatingLineIds);
  const setCancellingTarget = useRestaurantKdsStore((s) => s.setCancellingTarget);

  const currentList = activeTab === "ACTIVE" ? tickets : servedTickets;

  const filteredTickets = useMemo(() => {
    return currentList.filter((t) => {
      if (selectedStationId !== "ALL" && t.stationId !== selectedStationId) return false;
      if (selectedFloorId !== "ALL" && t.order?.table?.floor?.id !== selectedFloorId) return false;
      if (selectedOrderType !== "ALL" && t.order?.orderType !== selectedOrderType) return false;
      return true;
    });
  }, [currentList, selectedStationId, selectedFloorId, selectedOrderType]);

  const groupedRounds = useMemo(() => {
    if (selectedStationId !== "ALL") {
      return filteredTickets.map((t) => ({
        key: t.id,
        isConsolidated: false,
        primaryTicket: t,
        tickets: [t],
        allLines: (t.lines || []).map((l) => ({
          ...l,
          stationName: t.station?.name || "Kitchen",
          ticketId: t.id,
        })),
        status: t.status,
        createdAt: t.createdAt,
      }));
    }

    const groupsMap = new Map<
      string,
      {
        key: string;
        isConsolidated: boolean;
        primaryTicket: KitchenTicketItem;
        tickets: KitchenTicketItem[];
        allLines: Array<TicketLineItem & { stationName: string; ticketId: string }>;
        status: "QUEUED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
        createdAt: string;
      }
    >();

    for (const ticket of filteredTickets) {
      const orderId = ticket.order?.id || ticket.order?.orderNumber || ticket.id;
      const roundNum = ticket.round?.roundNumber || 1;
      const groupKey = `${orderId}_R${roundNum}`;

      const linesWithStation = (ticket.lines || []).map((l) => ({
        ...l,
        stationName: ticket.station?.name || "Kitchen",
        ticketId: ticket.id,
      }));

      const existing = groupsMap.get(groupKey);
      if (!existing) {
        groupsMap.set(groupKey, {
          key: groupKey,
          isConsolidated: false,
          primaryTicket: ticket,
          tickets: [ticket],
          allLines: [...linesWithStation],
          status: ticket.status,
          createdAt: ticket.createdAt,
        });
      } else {
        existing.isConsolidated = true;
        existing.tickets.push(ticket);
        existing.allLines.push(...linesWithStation);
        if (new Date(ticket.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
          existing.createdAt = ticket.createdAt;
        }
      }
    }

    for (const group of groupsMap.values()) {
      if (group.tickets.length > 1) {
        const statuses = group.tickets.map((t) => t.status);
        if (statuses.every((s) => s === "SERVED")) group.status = "SERVED";
        else if (statuses.every((s) => s === "READY" || s === "SERVED")) group.status = "READY";
        else if (statuses.some((s) => s === "PREPARING" || s === "READY")) group.status = "PREPARING";
        else group.status = "QUEUED";
      }
    }

    return Array.from(groupsMap.values());
  }, [filteredTickets, selectedStationId]);

  if (groupedRounds.length === 0) {
    return (
      <div className="py-20 text-center rounded-lg border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-2.5">
        <UtensilsCrossed className="h-9 w-9 text-[#71675E]/40 mx-auto" />
        <h3 className="text-sm font-bold text-[#292320]">
          {activeTab === "ACTIVE" ? "No Active Kitchen Orders" : "No Served Orders"}
        </h3>
        <p className="text-xs text-[#71675E]">
          {activeTab === "ACTIVE"
            ? "New dining, takeaway, and delivery orders will appear here automatically."
            : "Completed order rounds will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3.5 pb-8">
      {groupedRounds.map((group) => {
        const ticket = group.primaryTicket;
        const timeInfo = formatElapsedTime(group.createdAt, now);
        const isQueued = group.status === "QUEUED";
        const isPreparing = group.status === "PREPARING";
        const isReady = group.status === "READY";
        const isServed = group.status === "SERVED";

        const isDelayed = activeTab === "ACTIVE" && !isServed && timeInfo.isDelayed;
        const isWarning = activeTab === "ACTIVE" && !isServed && timeInfo.isWarning;

        const orderType = ticket.order?.orderType;
        const tableName = ticket.order?.table?.tableNumber;
        const destinationLabel =
          orderType === "DINE_IN"
            ? tableName
              ? `Table ${tableName}`
              : "Counter Dine-In"
            : orderType === "BAR_WALK_IN"
            ? "Counter Dine-In"
            : orderType === "TAKEAWAY"
            ? "Takeaway"
            : "Delivery";

        const shortTicketDisplay = (() => {
          const ref = ticket.order?.orderNumber || ticket.ticketNumber || ticket.id;
          const parts = ref.split("-");
          return `#${parts[parts.length - 1] || ref.slice(0, 6)}`;
        })();

        const advanceGroupStatus = (newStatus: "PREPARING" | "READY" | "SERVED") => {
          for (const t of group.tickets) {
            updateTicketStatus(t.id, newStatus);
          }
        };

        const headerBg = isServed || isReady
          ? "bg-[#EAF3EE] border-[#C3DED0]"
          : isDelayed
          ? "bg-[#FAEAEC] border-[#E9B6B7]"
          : isWarning
          ? "bg-[#FDF5E7] border-[#EDD7AD]"
          : "bg-[#EEE7DD] border-[#D8CEC1]";

        return (
          <div
            key={group.key}
            className={`rounded-lg border bg-[#FFFCF7] flex flex-col justify-between overflow-hidden ${
              isDelayed
                ? "border-[#E9B6B7]"
                : isReady
                ? "border-[#C3DED0]"
                : "border-[#D8CEC1]"
            }`}
          >
            {/* Ticket Header */}
            <div className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 ${headerBg}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-bold text-[#292320] text-sm tabular-nums truncate">
                  {shortTicketDisplay}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#6B2837] text-[#FFFCF7] shrink-0">
                  R{ticket.round?.roundNumber || 1}
                </span>
                <span className="text-xs font-semibold text-[#292320] truncate flex items-center gap-1">
                  {orderType === "TAKEAWAY" ? (
                    <ShoppingBag className="h-3.5 w-3.5 text-[#946000] shrink-0" />
                  ) : orderType === "DELIVERY" ? (
                    <Truck className="h-3.5 w-3.5 text-[#315F85] shrink-0" />
                  ) : (
                    <Store className="h-3.5 w-3.5 text-[#6B2837] shrink-0" />
                  )}
                  <span className="truncate">{destinationLabel}</span>
                </span>
              </div>

              {isServed ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FFFCF7] text-[#28634B] border border-[#C3DED0] shrink-0">
                  <CheckCircle2 className="h-3 w-3" />
                  Served
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md tabular-nums shrink-0 border ${
                    isDelayed
                      ? "bg-[#B33432] text-[#FFFCF7] border-[#B33432]"
                      : isWarning
                      ? "bg-[#946000] text-[#FFFCF7] border-[#946000]"
                      : "bg-[#FFFCF7] text-[#292320] border-[#D8CEC1]"
                  }`}
                  title={`Ordered at ${new Date(group.createdAt).toLocaleTimeString()}`}
                >
                  <Clock className="h-3 w-3" />
                  {timeInfo.display}
                </span>
              )}
            </div>

            {/* Station Sub-Bar */}
            <div className="px-3.5 py-1.5 bg-[#F7F3EC]/60 border-b border-[#D8CEC1]/60 flex items-center justify-between text-[11px] text-[#71675E]">
              <span className="font-medium truncate">
                {group.isConsolidated && group.tickets.length > 1
                  ? `${group.tickets.length} Stations`
                  : ticket.station?.name || "Main Kitchen"}
              </span>
              <span className="tabular-nums shrink-0">
                {group.allLines.filter((l) => l.status !== "CANCELLED").length}{" "}
                {group.allLines.filter((l) => l.status !== "CANCELLED").length === 1 ? "item" : "items"}
              </span>
            </div>

            {/* Dish Lines — Clean Single-Row Per-Item Controls */}
            <div className="divide-y divide-[#D8CEC1]/50 flex-1 overflow-y-auto">
              {group.allLines.map((line) => {
                const status = (line.status || "QUEUED") as keyof typeof LINE_STATUS_META;
                const statusMeta = LINE_STATUS_META[status] || LINE_STATUS_META.QUEUED;
                const isLineQueued = status === "QUEUED";
                const isLinePreparing = status === "PREPARING";
                const isLineReady = status === "READY";
                const isLineServed = status === "SERVED";
                const isLineCancelled = status === "CANCELLED";
                const isLineBusy = Boolean(updatingLineIds[line.id]);
                const { isParcel, cleanNote } = parseLineNote(line.notes);

                return (
                  <div
                    key={`${line.ticketId}_${line.id}`}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2.5 transition-colors ${
                      isLineCancelled ? "opacity-50 bg-[#F7F3EC]/40" : "hover:bg-[#F7F3EC]/40"
                    }`}
                  >
                    {/* Left: Qty + Item Info + Status */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-[#292320] text-xs tabular-nums shrink-0 px-1.5 py-0.5 rounded bg-[#EEE7DD]">
                          {line.quantity}x
                        </span>
                        <span
                          className={`text-xs font-semibold truncate ${
                            isLineCancelled || isLineServed
                              ? "line-through text-[#71675E]"
                              : "text-[#292320]"
                          }`}
                          title={line.itemName}
                        >
                          {line.itemName}
                        </span>
                      </div>

                      <div className="flex items-center flex-wrap gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${statusMeta.badge}`}
                        >
                          {statusMeta.label}
                        </span>

                        {isParcel && orderType === "DINE_IN" && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FDF5E7] text-[#946000] border border-[#EDD7AD]">
                            Parcel
                          </span>
                        )}

                        {group.isConsolidated && group.tickets.length > 1 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F7F3EC] text-[#71675E] border border-[#D8CEC1]">
                            {line.stationName}
                          </span>
                        )}

                        {line.modifiersSnapshot?.map((mod: any, mIdx: number) => (
                          <span
                            key={mIdx}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FDF5E7] text-[#946000] border border-[#EDD7AD]"
                          >
                            {mod.optionName || mod.name}
                          </span>
                        ))}
                      </div>

                      {cleanNote && (
                        <p className="text-[11px] text-[#946000] font-medium leading-snug">
                          Note: {cleanNote}
                        </p>
                      )}
                    </div>

                    {/* Right: 1-Tap Item Progress + Item Cancel */}
                    {!isLineCancelled && !isServed && (
                      <div className="flex items-center gap-1 shrink-0">
                        {isLineQueued && (
                          <button
                            type="button"
                            disabled={isLineBusy}
                            onClick={() => updateLineStatus(line.ticketId, line.id, "PREPARING")}
                            className="h-7 px-2.5 rounded-md bg-[#6B2837] hover:bg-[#541E2A] disabled:opacity-50 text-[#FFFCF7] text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            {isLineBusy ? "..." : "Start"}
                          </button>
                        )}
                        {isLinePreparing && (
                          <button
                            type="button"
                            disabled={isLineBusy}
                            onClick={() => updateLineStatus(line.ticketId, line.id, "READY")}
                            className="h-7 px-2.5 rounded-md bg-[#28634B] hover:bg-[#1E4D3A] disabled:opacity-50 text-[#FFFCF7] text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            {isLineBusy ? "..." : "Ready"}
                          </button>
                        )}
                        {isLineReady && (
                          <button
                            type="button"
                            disabled={isLineBusy}
                            onClick={() => updateLineStatus(line.ticketId, line.id, "SERVED")}
                            className="h-7 px-2.5 rounded-md bg-[#315F85] hover:bg-[#264B6A] disabled:opacity-50 text-[#FFFCF7] text-[11px] font-semibold cursor-pointer transition-colors"
                          >
                            {isLineBusy ? "..." : "Serve"}
                          </button>
                        )}
                        {isLineServed && (
                          <button
                            type="button"
                            disabled={isLineBusy}
                            onClick={() => updateLineStatus(line.ticketId, line.id, "READY")}
                            className="h-7 px-2 rounded-md border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] disabled:opacity-50 text-[#71675E] text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                            title="Move item back to Ready"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Undo</span>
                          </button>
                        )}

                        {!isLineServed && (
                          <button
                            type="button"
                            disabled={isLineBusy}
                            onClick={() =>
                              setCancellingTarget({
                                kind: "LINE",
                                ticketId: line.ticketId,
                                lineId: line.id,
                                itemName: line.itemName,
                                quantity: line.quantity,
                                tableNumber: destinationLabel,
                              })
                            }
                            aria-label={`Cancel ${line.itemName}`}
                            title={`Cancel ${line.itemName}`}
                            className="h-7 w-7 rounded-md border border-[#E9B6B7] bg-[#FAEAEC] hover:bg-[#F4D5D9] disabled:opacity-50 text-[#B33432] flex items-center justify-center cursor-pointer transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Bulk Footer */}
            <div className="px-3.5 py-2.5 border-t border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between gap-2 shrink-0">
              {activeTab === "ACTIVE" && ticket.order?.id && (
                <button
                  type="button"
                  onClick={() =>
                    setCancellingTarget({
                      kind: "ORDER",
                      ticketId: ticket.id,
                      orderId: ticket.order.id!,
                      tableNumber: destinationLabel,
                    })
                  }
                  className="h-8 px-2.5 rounded-lg border border-[#E9B6B7] bg-[#FAEAEC] hover:bg-[#F4D5D9] text-[#B33432] text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  title="Cancel entire order from kitchen"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Cancel Order</span>
                </button>
              )}

              {isQueued && (
                <button
                  type="button"
                  onClick={() => advanceGroupStatus("PREPARING")}
                  className="flex-1 h-8 px-3 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-semibold transition-colors cursor-pointer"
                >
                  Start All
                </button>
              )}

              {isPreparing && (
                <button
                  type="button"
                  onClick={() => advanceGroupStatus("READY")}
                  className="flex-1 h-8 px-3 rounded-lg bg-[#28634B] hover:bg-[#1E4D3A] text-[#FFFCF7] text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Ready All</span>
                </button>
              )}

              {isReady && (
                <button
                  type="button"
                  onClick={() => advanceGroupStatus("SERVED")}
                  className="flex-1 h-8 px-3 rounded-lg bg-[#315F85] hover:bg-[#264B6A] text-[#FFFCF7] text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Serve All</span>
                </button>
              )}

              {isServed && (
                <button
                  type="button"
                  onClick={() => advanceGroupStatus("READY")}
                  className="flex-1 h-8 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#292320] text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Recall to Ready</span>
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
