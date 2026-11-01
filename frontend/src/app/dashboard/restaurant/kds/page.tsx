"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";

interface TicketLine {
  id: string;
  itemName: string;
  quantity: number;
  modifiersSnapshot?: any[];
  dietaryAlerts?: string[];
  notes?: string | null;
  status: "QUEUED" | "PREPARING" | "READY" | "CANCELLED";
}

interface KitchenTicket {
  id: string;
  ticketNumber: string;
  stationId: string;
  station: { name: string; code: string };
  order: { orderNumber: string; table?: { tableNumber: string } | null; orderType: string };
  round: { roundNumber: number };
  status: "QUEUED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
  createdAt: string;
  lines: TicketLine[];
}

export default function KitchenDisplayPage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Clock tick every 5 seconds for live elapsed timers
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  // Fetch KDS live tickets and stations
  const loadKdsData = async () => {
    try {
      const [ticRes, staRes] = await Promise.all([
        fetch("/api/v1/restaurant/kitchen-tickets"),
        fetch("/api/v1/restaurant/kitchen-stations"),
      ]);

      if (ticRes.ok) {
        const data = await ticRes.json();
        if (data.tickets) {
          setTickets(data.tickets);
        }
      }

      if (staRes.ok) {
        const sData = await staRes.json();
        if (sData.stations) {
          setStations(sData.stations);
        }
      }
    } catch (err) {
      console.error("Error loading KDS tickets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKdsData();
    const pollInterval = setInterval(loadKdsData, 10000); // Poll every 10s
    return () => clearInterval(pollInterval);
  }, []);

  // Advance ticket status action
  const handleAdvanceStatus = async (ticket: KitchenTicket) => {
    let nextStatus: KitchenTicket["status"] = "PREPARING";
    if (ticket.status === "QUEUED") nextStatus = "PREPARING";
    else if (ticket.status === "PREPARING") nextStatus = "READY";
    else if (ticket.status === "READY") nextStatus = "SERVED";

    try {
      // Optimistic local update
      setTickets((prev) =>
        prev
          .map((t) => (t.id === ticket.id ? { ...t, status: nextStatus } : t))
          .filter((t) => (nextStatus === "SERVED" ? false : true))
      );

      const res = await fetch(`/api/v1/restaurant/kitchen-tickets/${ticket.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        await loadKdsData(); // Revert on error
      }
    } catch (err) {
      console.error("Failed to advance ticket status:", err);
      await loadKdsData();
    }
  };

  // Filter tickets by station
  const filteredTickets = useMemo(() => {
    if (selectedStationId === "ALL") return tickets;
    return tickets.filter((t) => t.stationId === selectedStationId);
  }, [tickets, selectedStationId]);

  // Timer helper
  const getElapsedInfo = (createdAtStr: string) => {
    const elapsedMinutes = Math.floor((currentTime - new Date(createdAtStr).getTime()) / 60000);
    if (elapsedMinutes < 10) {
      return {
        text: `${elapsedMinutes}m ago`,
        bg: "bg-forest/10 text-forest border-forest/30",
        badge: "NORMAL",
      };
    } else if (elapsedMinutes < 20) {
      return {
        text: `${elapsedMinutes}m ago`,
        bg: "bg-ochre-bg text-ochre border-ochre-border",
        badge: "WARNING",
      };
    } else {
      return {
        text: `⚠️ ${elapsedMinutes}m ago`,
        bg: "bg-red/10 text-red border-red/30",
        badge: "URGENT",
      };
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#1A1817] text-porcelain overflow-hidden select-none">
      {/* Top Bar for High-Legibility KDS */}
      <div className="bg-[#262320] border-b border-[#3D3733] px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/restaurant/tables"
            className="text-xs font-semibold text-warmgray hover:text-porcelain"
          >
            ← Dining Room
          </Link>
          <div className="h-5 w-[1px] bg-[#3D3733]" />
          <h1 className="text-base font-bold tracking-wider uppercase text-porcelain">
            Kitchen Display System (KDS)
          </h1>
        </div>

        {/* Station Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedStationId("ALL")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              selectedStationId === "ALL"
                ? "bg-burgundy text-porcelain border-burgundy shadow-sm"
                : "bg-[#332E2A] text-warmgray border-[#4D4540] hover:text-porcelain"
            }`}
          >
            All Stations ({tickets.length})
          </button>
          {stations.map((st) => {
            const count = tickets.filter((t) => t.stationId === st.id).length;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStationId(st.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  selectedStationId === st.id
                    ? "bg-burgundy text-porcelain border-burgundy shadow-sm"
                    : "bg-[#332E2A] text-warmgray border-[#4D4540] hover:text-porcelain"
                }`}
              >
                {st.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main KDS Grid: High legibility at 3 meters */}
      <div className="flex-1 overflow-x-auto p-4 flex gap-4 items-start">
        {loading ? (
          <div className="p-12 text-sm text-warmgray italic">Connecting to live kitchen feed...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-16 text-center text-sm text-warmgray/80 w-full flex flex-col items-center justify-center">
            <span className="text-3xl mb-2">👨‍🍳</span>
            <p className="font-semibold text-base text-porcelain">All caught up!</p>
            <p className="text-xs text-warmgray">No active orders queued for this station.</p>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const elapsed = getElapsedInfo(ticket.createdAt);

            return (
              <div
                key={ticket.id}
                className="w-80 shrink-0 rounded-2xl border-2 border-[#3D3733] bg-[#262320] flex flex-col justify-between overflow-hidden shadow-md"
              >
                {/* Ticket Header */}
                <div className="p-3.5 border-b border-[#3D3733] bg-[#2F2B27] flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black tracking-tight text-porcelain">
                        {ticket.order.table ? `Table ${ticket.order.table.tableNumber}` : "Takeaway"}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-burgundy/30 text-burgundy font-bold border border-burgundy/50">
                        R#{ticket.round.roundNumber}
                      </span>
                    </div>
                    <p className="text-xs text-warmgray mt-0.5">
                      #{ticket.ticketNumber} • {ticket.station.name}
                    </p>
                  </div>

                  {/* Elapsed Timer Badge */}
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg border tabular-nums ${elapsed.bg}`}
                  >
                    {elapsed.text}
                  </span>
                </div>

                {/* Ticket Body: Order Lines */}
                <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[50vh]">
                  {ticket.lines.map((line) => (
                    <div
                      key={line.id}
                      className="border-b border-[#35302C] pb-2.5 last:border-none space-y-1"
                    >
                      <div className="flex items-start justify-between text-sm font-bold text-porcelain">
                        <span className="text-base text-porcelain font-black mr-2">
                          {line.quantity}x
                        </span>
                        <span className="flex-1 text-base">{line.itemName}</span>
                      </div>

                      {/* Dietary / Allergen Badges */}
                      {line.dietaryAlerts && line.dietaryAlerts.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {line.dietaryAlerts.map((alert, i) => (
                            <span
                              key={i}
                              className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-red/20 text-red border border-red/40"
                            >
                              ⚠️ {alert.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Modifiers List */}
                      {line.modifiersSnapshot && line.modifiersSnapshot.length > 0 && (
                        <div className="text-xs text-warmgray pl-5">
                          {line.modifiersSnapshot.map((m: any, idx: number) => (
                            <p key={idx}>+ {m.optionName || m.name}</p>
                          ))}
                        </div>
                      )}

                      {/* Kitchen Notes */}
                      {line.notes && (
                        <p className="text-xs italic text-ochre pl-5 font-medium">
                          Note: "{line.notes}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Ticket Footer Action Button */}
                <div className="p-3 border-t border-[#3D3733] bg-[#2F2B27]">
                  <button
                    type="button"
                    onClick={() => handleAdvanceStatus(ticket)}
                    className={`w-full py-3 rounded-xl text-sm font-black tracking-wide uppercase transition-all shadow-sm ${
                      ticket.status === "QUEUED"
                        ? "bg-ochre hover:bg-ochre/90 text-porcelain"
                        : ticket.status === "PREPARING"
                        ? "bg-forest hover:bg-forest/90 text-porcelain"
                        : "bg-[#4D4540] hover:bg-[#59504A] text-porcelain"
                    }`}
                  >
                    {ticket.status === "QUEUED"
                      ? "Start Cooking (Prep)"
                      : ticket.status === "PREPARING"
                      ? "Mark Ready & Deduct Stock"
                      : "Serve & Clear Ticket"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

