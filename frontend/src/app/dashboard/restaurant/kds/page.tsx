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
  notes?: string | null;
  createdAt: string;
  lines: TicketLine[];
}

export default function KitchenDisplayPage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

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
    const pollInterval = setInterval(loadKdsData, 8000);
    return () => clearInterval(pollInterval);
  }, []);

  const handleAdvanceStatus = async (ticket: KitchenTicket) => {
    let nextStatus: KitchenTicket["status"] = "PREPARING";
    if (ticket.status === "QUEUED") nextStatus = "PREPARING";
    else if (ticket.status === "PREPARING") nextStatus = "READY";
    else if (ticket.status === "READY") nextStatus = "SERVED";

    try {
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
        await loadKdsData();
      }
    } catch (err) {
      console.error("Failed to advance ticket status:", err);
      await loadKdsData();
    }
  };

  const filteredTickets = useMemo(() => {
    if (selectedStationId === "ALL") return tickets;
    return tickets.filter((t) => t.stationId === selectedStationId);
  }, [tickets, selectedStationId]);

  const getElapsedInfo = (createdAtStr: string) => {
    const elapsedMinutes = Math.max(
      0,
      Math.floor((currentTime - new Date(createdAtStr).getTime()) / 60000)
    );
    if (elapsedMinutes < 10) {
      return {
        text: `${elapsedMinutes}m`,
        bg: "bg-[#EAF3EE] text-[#28634B] border-[#C3DED0]",
      };
    } else if (elapsedMinutes < 20) {
      return {
        text: `${elapsedMinutes}m`,
        bg: "bg-[#FDF5E7] text-[#946000] border-[#EDD7AD]",
      };
    } else {
      return {
        text: `URGENT ${elapsedMinutes}m`,
        bg: "bg-[#FAEAEC] text-[#B33432] border-[#E9B6B7]",
      };
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#1F1A18] text-[#FFFCF7] overflow-hidden select-none">
      {/* Top Bar */}
      <div className="bg-[#262320] border-b border-[#3D3733] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/restaurant/pos"
            className="px-2.5 py-1 rounded-md border border-[#3D3733] bg-[#1F1A18] text-xs font-semibold text-[#D8CEC1] hover:text-[#FFFCF7]"
          >
            POS Terminal
          </Link>
          <h1 className="text-sm font-bold tracking-wider uppercase text-[#FFFCF7]">
            Kitchen Display System
          </h1>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setSelectedStationId("ALL")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
              selectedStationId === "ALL"
                ? "bg-[#6B2837] text-[#FFFCF7] border-[#6B2837]"
                : "bg-[#1F1A18] text-[#D8CEC1] border-[#3D3733] hover:text-[#FFFCF7]"
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
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors border ${
                  selectedStationId === st.id
                    ? "bg-[#6B2837] text-[#FFFCF7] border-[#6B2837]"
                    : "bg-[#1F1A18] text-[#D8CEC1] border-[#3D3733] hover:text-[#FFFCF7]"
                }`}
              >
                {st.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Ticket Rail */}
      <div className="flex-1 overflow-x-auto p-4 flex gap-3.5 items-start">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 w-full">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-lg border border-[#3D3733] bg-[#262320] p-4 space-y-3"
              >
                <div className="h-5 w-1/2 rounded bg-[#3D3733] animate-pulse" />
                <div className="h-4 w-full rounded bg-[#3D3733] animate-pulse" />
                <div className="h-4 w-3/4 rounded bg-[#3D3733] animate-pulse" />
                <div className="h-9 w-full rounded bg-[#3D3733] animate-pulse mt-4" />
              </div>
            ))}
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-16 text-center w-full flex flex-col items-center justify-center">
            <p className="font-semibold text-sm text-[#FFFCF7]">No Active Kitchen Tickets</p>
            <p className="text-xs text-[#D8CEC1]/70 mt-1">
              New rounds sent from the Restaurant POS or Guest QR Portal will appear here.
            </p>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const elapsed = getElapsedInfo(ticket.createdAt);

            return (
              <div
                key={ticket.id}
                className="w-80 shrink-0 rounded-lg border border-[#3D3733] bg-[#262320] flex flex-col justify-between overflow-hidden"
              >
                {/* Ticket Header */}
                <div className="p-3 border-b border-[#3D3733] bg-[#2F2B27] flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-[#FFFCF7] tabular-nums">
                        {ticket.order.table ? `Table ${ticket.order.table.tableNumber}` : "Takeaway"}
                      </span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#6B2837] text-[#FFFCF7] font-semibold tabular-nums">
                        R#{ticket.round.roundNumber}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#D8CEC1]/80 mt-0.5 tabular-nums">
                      {ticket.ticketNumber} • {ticket.station.name}
                    </p>
                  </div>

                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border tabular-nums ${elapsed.bg}`}
                  >
                    {elapsed.text}
                  </span>
                </div>

                {/* Failover Banner if present in notes */}
                {ticket.notes && (
                  <div className="px-3 py-1.5 bg-[#FDF5E7] text-[#946000] border-b border-[#EDD7AD] text-[11px] font-semibold">
                    {ticket.notes}
                  </div>
                )}

                {/* Ticket Lines */}
                <div className="p-3.5 space-y-2.5 flex-1 overflow-y-auto max-h-[52vh]">
                  {ticket.lines.map((line) => (
                    <div
                      key={line.id}
                      className="border-b border-[#35302C] pb-2 last:border-none space-y-1"
                    >
                      <div className="flex items-start justify-between text-sm font-semibold text-[#FFFCF7]">
                        <span className="font-bold tabular-nums mr-2">{line.quantity}x</span>
                        <span className="flex-1">{line.itemName}</span>
                      </div>

                      {line.dietaryAlerts && line.dietaryAlerts.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {line.dietaryAlerts.map((alert, i) => (
                            <span
                              key={i}
                              className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-[#FAEAEC] text-[#B33432] border border-[#E9B6B7]"
                            >
                              ALLERGY: {alert.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}

                      {line.modifiersSnapshot && line.modifiersSnapshot.length > 0 && (
                        <div className="text-xs text-[#D8CEC1] pl-5">
                          {line.modifiersSnapshot.map((m: any, idx: number) => (
                            <p key={idx}>+ {m.optionName || m.name}</p>
                          ))}
                        </div>
                      )}

                      {line.notes && (
                        <p className="text-xs text-[#EDD7AD] pl-5">Note: {line.notes}</p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Action Footer */}
                <div className="p-3 border-t border-[#3D3733] bg-[#2F2B27]">
                  <button
                    type="button"
                    onClick={() => handleAdvanceStatus(ticket)}
                    className={`w-full py-2.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                      ticket.status === "QUEUED"
                        ? "bg-[#946000] hover:bg-[#946000]/90 text-[#FFFCF7]"
                        : ticket.status === "PREPARING"
                        ? "bg-[#28634B] hover:bg-[#28634B]/90 text-[#FFFCF7]"
                        : "bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7]"
                    }`}
                  >
                    {ticket.status === "QUEUED"
                      ? "Start Prep"
                      : ticket.status === "PREPARING"
                      ? "Mark Ready"
                      : "Mark Served"}
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
