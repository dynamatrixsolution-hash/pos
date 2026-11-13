"use client";

import React, { useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  UtensilsCrossed,
  Store,
  ShoppingBag,
  Truck,
  RotateCcw,
  Check,
  Trash2,
} from "lucide-react";
import { useRestaurantKdsStore, KitchenTicketItem, TicketLineItem } from "../../state/restaurant-kds.store";

function formatElapsedTime(isoDate: string, now: number): {
  display: string;
  totalMins: number;
  isDelayed: boolean;
  isWarning: boolean;
} {
  if (!isoDate) {
    return { display: "0s", totalMins: 0, isDelayed: false, isWarning: false };
  }
  const diffMs = Math.max(0, now - new Date(isoDate).getTime());
  const totalSecs = Math.floor(diffMs / 1000);
  const totalMins = Math.floor(totalSecs / 60);
  const totalHours = Math.floor(totalMins / 60);
  const totalDays = Math.floor(totalHours / 24);

  let display: string;
  if (totalDays > 0) {
    const remHours = totalHours % 24;
    display = remHours > 0 ? `${totalDays}d ${remHours}h` : `${totalDays}d`;
  } else if (totalHours > 0) {
    const remMins = totalMins % 60;
    display = remMins > 0 ? `${totalHours}h ${remMins}m` : `${totalHours}h`;
  } else if (totalMins > 0) {
    const remSecs = totalSecs % 60;
    display = `${totalMins}m ${remSecs.toString().padStart(2, "0")}s`;
  } else {
    display = `${totalSecs}s`;
  }

  const isDelayed = totalMins >= 15;
  const isWarning = totalMins >= 8 && totalMins < 15;

  return { display, totalMins, isDelayed, isWarning };
}

export const KdsTicketGrid: React.FC = () => {
  const [now, setNow] = React.useState(() => Date.now());

  // 1-second live ticker so kitchen timers count up in real time (seconds, minutes, hours, days)
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
  const setCancellingOrder = useRestaurantKdsStore((s) => s.setCancellingOrder);

  const currentList = activeTab === "ACTIVE" ? tickets : servedTickets;

  const filteredTickets = useMemo(() => {
    return currentList.filter((t) => {
      if (selectedStationId !== "ALL" && t.stationId !== selectedStationId) return false;
      if (selectedFloorId !== "ALL" && t.order?.table?.floor?.id !== selectedFloorId) return false;
      if (selectedOrderType !== "ALL" && t.order?.orderType !== selectedOrderType) return false;
      return true;
    });
  }, [currentList, selectedStationId, selectedFloorId, selectedOrderType]);

  // Consolidate tickets by order round when viewing "ALL" stations so a single order round
  // is never split into disconnected double widgets.
  const groupedRounds = useMemo(() => {
    if (selectedStationId !== "ALL") {
      // Individual station selected: show only that station's tickets
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

    // Determine group overall status
    for (const group of groupsMap.values()) {
      if (group.tickets.length > 1) {
        const statuses = group.tickets.map((t) => t.status);
        if (statuses.every((s) => s === "SERVED")) {
          group.status = "SERVED";
        } else if (statuses.every((s) => s === "READY" || s === "SERVED")) {
          group.status = "READY";
        } else if (statuses.some((s) => s === "PREPARING" || s === "READY")) {
          group.status = "PREPARING";
        } else {
          group.status = "QUEUED";
        }
      }
    }

    return Array.from(groupsMap.values());
  }, [filteredTickets, selectedStationId]);

  if (groupedRounds.length === 0) {
    return (
      <div className="py-20 text-center rounded-xl border border-dashed border-[#D8CEC1] bg-[#FFFCF7] space-y-3">
        <UtensilsCrossed className="h-10 w-10 text-[#71675E]/40 mx-auto" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#292320]">
            {activeTab === "ACTIVE" ? "All Kitchen Queues Clear" : "No Served Tickets"}
          </h3>
          <p className="text-xs text-[#71675E]">
            {activeTab === "ACTIVE"
              ? "New dining orders routed to this station will appear here instantly."
              : "Completed order rounds will appear in the served history."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 pb-8">
      {groupedRounds.map((group) => {
        const ticket = group.primaryTicket;
        const timeInfo = formatElapsedTime(group.createdAt, now);
        const isQueued = group.status === "QUEUED";
        const isPreparing = group.status === "PREPARING";
        const isReady = group.status === "READY";
        const isServed = group.status === "SERVED";

        // Delay warnings only apply to active non-served orders
        const isDelayed = activeTab === "ACTIVE" && !isServed && timeInfo.isDelayed;
        const isWarning = activeTab === "ACTIVE" && !isServed && timeInfo.isWarning;

        const orderType = ticket.order?.orderType;
        const tableName = ticket.order?.table?.tableNumber;

        // Clean single order/ticket number (never concatenate station ticket IDs like #1982 + #8280)
        const shortTicketDisplay = (() => {
          if (ticket.order?.orderNumber) {
            const orderParts = ticket.order.orderNumber.split("-");
            return `#${orderParts[orderParts.length - 1]}`;
          }
          if (!ticket.ticketNumber) return `#${ticket.id.slice(0, 4)}`;
          const parts = ticket.ticketNumber.split("-");
          return `#${parts[parts.length - 1]}`;
        })();

        const advanceGroupStatus = (newStatus: "PREPARING" | "READY" | "SERVED") => {
          for (const t of group.tickets) {
            updateTicketStatus(t.id, newStatus);
          }
        };

        return (
          <div
            key={group.key}
            className={`rounded-xl border bg-[#FFFCF7] shadow-2xs flex flex-col justify-between overflow-hidden transition-all ${
              isServed
                ? "border-[#D8CEC1]/80 opacity-90"
                : isReady
                ? "border-[#16A34A]"
                : isDelayed
                ? "border-[#DC2626] ring-1 ring-[#DC2626]/30"
                : isWarning
                ? "border-[#D97706]"
                : "border-[#D8CEC1]"
            }`}
          >
            {/* Ticket Header */}
            <div
              className={`p-3 border-b flex items-center justify-between text-xs ${
                isServed
                  ? "bg-[#EDF5ED] border-[#C8DFCD]"
                  : isReady
                  ? "bg-[#EDF5ED] border-[#C8DFCD]"
                  : isDelayed
                  ? "bg-red-50 border-red-200"
                  : isWarning
                  ? "bg-amber-50 border-amber-200"
                  : "bg-[#F7F3EC] border-[#D8CEC1]"
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="font-mono font-black text-[#6B2837] text-sm tracking-tight truncate"
                  title={ticket.ticketNumber || ticket.id}
                >
                  {shortTicketDisplay}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#6B2837] text-white shrink-0">
                  R{ticket.round?.roundNumber || 1}
                </span>
                {group.isConsolidated && group.tickets.length > 1 && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#292320]/10 text-[#292320] shrink-0">
                    {group.tickets.length} Stations
                  </span>
                )}
              </div>

              {/* Timer / Served Badge */}
              {isServed ? (
                <div className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#2D6A4F]/10 text-[#2D6A4F] border border-[#C8DFCD]">
                  <CheckCircle2 className="h-3 w-3 text-[#16A34A]" />
                  <span>Served</span>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                    isDelayed
                      ? "bg-[#DC2626] text-white animate-pulse"
                      : isWarning
                      ? "bg-[#D97706] text-white"
                      : "bg-[#292320]/10 text-[#292320]"
                  }`}
                  title={`Ordered at ${new Date(group.createdAt).toLocaleTimeString()}`}
                >
                  <Clock className="h-3 w-3" />
                  <span>{timeInfo.display}</span>
                </div>
              )}
            </div>

            {/* Destination Info & Station */}
            <div className="p-3 bg-[#FFFCF7] border-b border-[#D8CEC1]/50 flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-1.5 font-bold text-[#292320] min-w-0">
                {orderType === "DINE_IN" ? (
                  <>
                    <Store className="h-3.5 w-3.5 text-[#6B2837] shrink-0" />
                    <span className="truncate">
                      {tableName ? `Table ${tableName}` : "Dine-In (Counter)"}
                    </span>
                  </>
                ) : orderType === "BAR_WALK_IN" ? (
                  <>
                    <Store className="h-3.5 w-3.5 text-[#6B2837] shrink-0" />
                    <span className="truncate">Counter Dine-In</span>
                  </>
                ) : orderType === "TAKEAWAY" ? (
                  <>
                    <ShoppingBag className="h-3.5 w-3.5 text-[#B45309] shrink-0" />
                    <span className="truncate">Takeaway</span>
                  </>
                ) : (
                  <>
                    <Truck className="h-3.5 w-3.5 text-[#2D6A4F] shrink-0" />
                    <span className="truncate">Delivery</span>
                  </>
                )}
              </div>

              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F7F3EC] border border-[#D8CEC1] text-[#71675E] shrink-0 max-w-[140px] truncate"
                title={
                  group.isConsolidated && group.tickets.length > 1
                    ? group.tickets.map((t) => t.station?.name).filter(Boolean).join(", ")
                    : ticket.station?.name || "Kitchen"
                }
              >
                {group.isConsolidated && group.tickets.length > 1
                  ? `${group.tickets.length} Stations`
                  : ticket.station?.name || "Kitchen"}
              </span>
            </div>

            {/* Dish Lines List */}
            <div className="p-3 flex-1 overflow-y-auto space-y-2 text-xs divide-y divide-[#D8CEC1]/40">
              {group.allLines.map((line) => {
                const isLineReady = line.status === "READY" || line.status === "SERVED";
                const isLineCancelled = line.status === "CANCELLED";

                return (
                  <div
                    key={`${line.ticketId}_${line.id}`}
                    className={`pt-2 first:pt-0 flex items-start justify-between gap-2 ${
                      isLineCancelled ? "opacity-50 line-through" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="font-black text-[#292320] text-sm tabular-nums shrink-0">
                        {line.quantity}x
                      </span>
                      <div className="min-w-0">
                        <div
                          className={`font-semibold text-[#292320] leading-tight flex items-center flex-wrap gap-1 ${
                            isLineReady ? "line-through text-[#71675E]" : ""
                          }`}
                        >
                          <span>{line.itemName}</span>
                          {group.isConsolidated && group.tickets.length > 1 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F7F3EC] border border-[#D8CEC1] text-[#71675E]">
                              {line.stationName}
                            </span>
                          )}
                        </div>

                        {/* Modifiers tags */}
                        {line.modifiersSnapshot && line.modifiersSnapshot.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {line.modifiersSnapshot.map((mod: any, mIdx: number) => (
                              <span
                                key={mIdx}
                                className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                              >
                                {mod.optionName || mod.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {line.notes && (
                          <div className="text-[10px] text-[#B45309] font-medium mt-0.5">
                            Note: {line.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Line Toggle Button */}
                    {!isLineCancelled && !isServed && (
                      <button
                        type="button"
                        onClick={() =>
                          updateLineStatus(
                            line.ticketId,
                            line.id,
                            isLineReady ? "PREPARING" : "READY"
                          )
                        }
                        className={`h-6 w-6 rounded-md border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                          isLineReady
                            ? "bg-[#16A34A] border-[#16A34A] text-white"
                            : "border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E]"
                        }`}
                        title={isLineReady ? "Mark Unready" : "Mark Ready"}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="p-2.5 border-t border-[#D8CEC1] bg-[#F7F3EC] flex items-center justify-between gap-2 shrink-0">
              {/* Void Prompt */}
              {activeTab === "ACTIVE" && ticket.order?.id && (
                <button
                  type="button"
                  onClick={() =>
                    setCancellingOrder({
                      ticketId: ticket.id,
                      orderId: ticket.order.id!,
                      tableNumber: tableName || "Order",
                    })
                  }
                  className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[#DC2626] transition-colors cursor-pointer"
                  title="Void order from kitchen"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Workflow Status Advance Buttons */}
              {isQueued && (
                <button
                  type="button"
                  onClick={() => advanceGroupStatus("PREPARING")}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs text-center"
                >
                  Start Prep
                </button>
              )}

              {isPreparing && (
                <button
                  type="button"
                  onClick={() => advanceGroupStatus("READY")}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs text-center flex items-center justify-center gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Mark All Ready</span>
                </button>
              )}

              {isReady && (
                <button
                  type="button"
                  onClick={() => advanceGroupStatus("SERVED")}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-[#1E40AF] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs text-center flex items-center justify-center gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Serve / Clear</span>
                </button>
              )}

              {isServed && (
                <button
                  type="button"
                  onClick={() => advanceGroupStatus("READY")}
                  className="flex-1 py-1.5 px-3 rounded-lg border border-[#D8CEC1] bg-[#FFFCF7] hover:bg-[#EEE7DD] text-[#71675E] text-xs font-semibold transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
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

