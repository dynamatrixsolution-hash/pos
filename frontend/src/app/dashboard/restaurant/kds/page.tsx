"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Maximize2, Minimize2, Volume2, VolumeX, Check } from "lucide-react";
import { toast } from "@/components/toast";

interface TicketLine {
  id: string;
  itemName: string;
  quantity: number;
  modifiersSnapshot?: any[] | null;
  dietaryAlerts?: string[] | null;
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

type Stage = "QUEUED" | "PREPARING" | "READY" | "RECALL";

const STAGES: { id: Stage; label: string }[] = [
  { id: "QUEUED", label: "Queued" },
  { id: "PREPARING", label: "Cooking" },
  { id: "READY", label: "Ready" },
  { id: "RECALL", label: "Recall" },
];

const DIETARY_LABELS: Record<string, string> = {
  GLUTEN_FREE: "Gluten free",
  NO_NUTS: "No nuts",
  VEGAN: "Vegan",
  VEGETARIAN: "Veg",
  SPICY: "Spicy",
};

function ticketTitle(t: KitchenTicket) {
  if (t.order.table?.tableNumber) return `Table ${t.order.table.tableNumber}`;
  if (t.order.orderType === "TAKEAWAY") return "Takeaway";
  if (t.order.orderType === "BAR_WALK_IN") return "Bar";
  return "Counter";
}

function shortTicket(num: string) {
  const digits = num.replace(/\D/g, "");
  return `#${digits.slice(-4) || num.slice(-4)}`;
}

function lineNote(line: TicketLine) {
  const parts: string[] = [];
  let mods: any[] = [];
  if (Array.isArray(line.modifiersSnapshot)) {
    mods = line.modifiersSnapshot;
  } else if (typeof line.modifiersSnapshot === "string") {
    try {
      const parsed = JSON.parse(line.modifiersSnapshot);
      if (Array.isArray(parsed)) mods = parsed;
    } catch {}
  }
  mods.forEach((m: any) => m?.optionName && parts.push(m.optionName));
  if (line.notes) parts.push(line.notes);
  return parts.join(", ");
}

function parseDietaryAlerts(raw: any): string[] {
  if (!raw) return [];
  let list: any[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
      else if (parsed && typeof parsed === "object") list = Object.values(parsed);
      else list = [raw];
    } catch {
      list = raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  } else if (typeof raw === "object") {
    list = Object.values(raw);
  }
  return list
    .filter((a) => typeof a === "string" && a.trim().length > 0)
    .map((a) => (typeof a === "string" ? DIETARY_LABELS[a] || a : String(a)));
}

export default function KitchenDisplayPage() {
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [recalled, setRecalled] = useState<KitchenTicket[]>([]);
  const [stations, setStations] = useState<{ id: string; name: string }[]>([]);
  const [stationId, setStationId] = useState<string>("ALL");
  const [stages, setStages] = useState<Stage[]>(["QUEUED", "PREPARING"]);
  const [struck, setStruck] = useState<Record<string, boolean>>({});
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState<number>(Date.now());
  const [loading, setLoading] = useState(true);
  const [sound, setSound] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const knownIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const chime = useCallback(() => {
    if (!sound || typeof window === "undefined") return;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  }, [sound]);

  const load = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        fetch("/api/v1/restaurant/kitchen-tickets"),
        fetch("/api/v1/restaurant/kitchen-stations"),
      ]);
      if (tRes.ok) {
        const data = await tRes.json();
        const incoming: KitchenTicket[] = data.tickets || [];
        const incomingServed: KitchenTicket[] = data.served || [];
        const known = knownIdsRef.current;
        if (known && incoming.some((t) => !known.has(t.id))) chime();
        knownIdsRef.current = new Set(incoming.map((t) => t.id));
        setTickets(incoming);
        setRecalled(incomingServed);
      }
      if (sRes.ok) {
        const data = await sRes.json();
        setStations(data.stations || []);
      }
    } catch (err) {
      console.error("KDS load failed:", err);
    } finally {
      setLoading(false);
    }
  }, [chime]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 5000);
    return () => clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) rootRef.current?.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  const patchStatus = async (ticketId: string, status: KitchenTicket["status"]) => {
    const res = await fetch(`/api/v1/restaurant/kitchen-tickets/${ticketId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Status update failed");
    }
  };

  const advance = async (ticket: KitchenTicket) => {
    const next: KitchenTicket["status"] =
      ticket.status === "QUEUED" ? "PREPARING" : ticket.status === "PREPARING" ? "READY" : "SERVED";

    setBusyIds((p) => ({ ...p, [ticket.id]: true }));
    if (next === "SERVED") {
      setTickets((p) => p.filter((t) => t.id !== ticket.id));
      setRecalled((p) => [{ ...ticket, status: "SERVED" as const }, ...p.filter((t) => t.id !== ticket.id)].slice(0, 30));
    } else {
      setTickets((p) => p.map((t) => (t.id === ticket.id ? { ...t, status: next } : t)));
    }
    try {
      await patchStatus(ticket.id, next);
      toast.success(`${ticketTitle(ticket)} marked as ${next.toLowerCase()}`);
    } catch (err: any) {
      toast.error(err.message || `Could not update ${ticketTitle(ticket)}`);
      await load();
    } finally {
      setBusyIds((p) => ({ ...p, [ticket.id]: false }));
    }
  };

  const recall = async (ticket: KitchenTicket) => {
    setRecalled((p) => p.filter((t) => t.id !== ticket.id));
    setTickets((p) => [{ ...ticket, status: "READY" as const }, ...p.filter((t) => t.id !== ticket.id)]);
    try {
      await patchStatus(ticket.id, "READY");
      toast.success(`${ticketTitle(ticket)} recalled to ready`);
    } catch (err: any) {
      toast.error(err.message || `Could not recall ${ticketTitle(ticket)}`);
      await load();
    }
  };

  const toggleStage = (s: Stage) => {
    setStages((prev) => {
      if (s === "RECALL") return prev.includes("RECALL") ? ["QUEUED", "PREPARING"] : ["RECALL"];
      const base = prev.filter((x) => x !== "RECALL");
      const next = base.includes(s) ? base.filter((x) => x !== s) : [...base, s];
      return next.length ? next : [s];
    });
  };

  const stationCount = (id: string) => {
    const showRecall = stages.includes("RECALL");
    const pool = showRecall ? recalled : tickets.filter((t) => stages.includes(t.status as Stage));
    return pool.filter((t) => id === "ALL" || t.stationId === id).length;
  };

  const stageCount = (s: Stage) => {
    const pool = s === "RECALL" ? recalled : tickets;
    return pool.filter(
      (t) => (stationId === "ALL" || t.stationId === stationId) && (s === "RECALL" || t.status === s)
    ).length;
  };

  const visible = useMemo(() => {
    const showRecall = stages.includes("RECALL");
    const pool = showRecall ? recalled : tickets.filter((t) => stages.includes(t.status as Stage));
    return pool
      .filter((t) => stationId === "ALL" || t.stationId === stationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [tickets, recalled, stages, stationId]);

  const timer = (createdAt: string) => {
    const secs = Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 1000));
    const m = Math.floor(secs / 60);
    const label = `${String(m).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
    const level = m >= 10 ? "late" : m >= 4 ? "warn" : "ok";
    return { label, level };
  };

  const pill = (active: boolean) =>
    `h-9 px-3 rounded-md text-[13px] font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2837] focus-visible:ring-offset-1 ${
      active ? "bg-[#6B2837] text-[#FFFCF7]" : "text-[#292320] hover:bg-[#EEE7DD]"
    }`;
  const countCls = (active: boolean) =>
    `tabular-nums ${active ? "text-[#FFFCF7]/80" : "text-[#71675E]"}`;

  return (
    <div
      ref={rootRef}
      className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-[#F7F3EC] text-[#292320] select-none"
    >
      {/* Filter bar */}
      <div className="px-2 py-1 border-b border-[#D8CEC1] bg-[#FFFCF7] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-0.5 overflow-x-auto">
          <button type="button" onClick={() => setStationId("ALL")} className={pill(stationId === "ALL")}>
            All stations <span className={countCls(stationId === "ALL")}>{stationCount("ALL")}</span>
          </button>
          {stations.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStationId(s.id)}
              className={pill(stationId === s.id)}
            >
              {s.name} <span className={countCls(stationId === s.id)}>{stationCount(s.id)}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {STAGES.map((s) => {
            const active = stages.includes(s.id);
            return (
              <button key={s.id} type="button" onClick={() => toggleStage(s.id)} className={pill(active)}>
                {s.label} <span className={countCls(active)}>{stageCount(s.id)}</span>
              </button>
            );
          })}
          <span className="mx-1 h-4 w-px bg-[#D8CEC1]" />
          <button
            type="button"
            onClick={() => setSound((v) => !v)}
            title={sound ? "Mute new-ticket chime" : "Unmute new-ticket chime"}
            aria-label={sound ? "Mute new-ticket chime" : "Unmute new-ticket chime"}
            aria-pressed={!sound}
            className="h-9 w-9 rounded-md flex items-center justify-center text-[#71675E] hover:bg-[#EEE7DD] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2837] focus-visible:ring-offset-1"
          >
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="h-9 w-9 rounded-md flex items-center justify-center text-[#71675E] hover:bg-[#EEE7DD] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2837] focus-visible:ring-offset-1"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Ticket board */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {loading ? (
          <div className="columns-1 sm:columns-2 lg:columns-4 xl:columns-5 gap-1.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="mb-1.5 break-inside-avoid rounded-md border border-[#D8CEC1] bg-[#FFFCF7] p-2 space-y-2 animate-pulse"
              >
                <div className="h-4 w-1/2 rounded bg-[#EEE7DD]" />
                <div className="h-3 w-3/4 rounded bg-[#EEE7DD]" />
                <div className="h-8 w-full rounded bg-[#EEE7DD]" />
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-[#71675E]">
              {stages.includes("RECALL") ? "No served tickets to recall." : "No tickets in this view."}
            </p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-4 xl:columns-5 gap-1.5">
            {visible.map((t) => {
              const tm = timer(t.createdAt);
              const isRecall = stages.includes("RECALL");
              const late = !isRecall && tm.level === "late";
              return (
                <div
                  key={t.id}
                  className={`mb-1.5 break-inside-avoid rounded-md border bg-[#FFFCF7] ${
                    late ? "border-[#B33432]" : "border-[#D8CEC1]"
                  }`}
                >
                  {/* Header */}
                  <div className="px-2 pt-1.5 pb-1 border-b border-[#EEE7DD]">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-1.5 min-w-0">
                        <span className="text-[17px] font-bold leading-tight truncate">{ticketTitle(t)}</span>
                        {t.round?.roundNumber > 1 && (
                          <span className="text-xs text-[#71675E] tabular-nums shrink-0">
                            Round {t.round.roundNumber}
                          </span>
                        )}
                        {late && (
                          <span className="px-1.5 rounded border border-[#B33432] text-[11px] font-bold uppercase tracking-wide text-[#B33432] shrink-0">
                            Late
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[17px] font-bold leading-tight tabular-nums ${
                          isRecall
                            ? "text-[#71675E]"
                            : tm.level === "late"
                            ? "text-[#B33432]"
                            : tm.level === "warn"
                            ? "text-[#946000]"
                            : "text-[#292320]"
                        }`}
                      >
                        {tm.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-[#71675E] mt-0.5">
                      <span className="truncate">{t.station?.name}</span>
                      <span className="tabular-nums shrink-0">{shortTicket(t.ticketNumber)}</span>
                    </div>
                  </div>

                  {/* Lines */}
                  <div className="px-2">
                    {t.lines.map((line, idx) => {
                      const done = struck[line.id];
                      const note = lineNote(line);
                      const alerts = parseDietaryAlerts(line.dietaryAlerts);
                      return (
                        <button
                          key={line.id}
                          type="button"
                          onClick={() => setStruck((p) => ({ ...p, [line.id]: !p[line.id] }))}
                          className={`w-full text-left flex gap-1.5 py-1.5 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2837] focus-visible:ring-offset-1 transition-opacity ${
                            idx > 0 ? "border-t border-[#EEE7DD]" : ""
                          } ${done ? "opacity-65" : ""}`}
                        >
                          <span className="text-[15px] font-bold text-[#71675E] tabular-nums w-7 shrink-0 leading-snug">
                            {line.quantity}×
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`text-[15px] font-semibold leading-snug ${
                                  done ? "line-through text-[#71675E]" : "text-[#292320]"
                                }`}
                              >
                                {line.itemName}
                              </span>
                              {done && (
                                <span className="inline-flex items-center px-1 py-0.5 rounded bg-[#EAF5EE] text-[#237A4B] text-[10px] font-bold shrink-0">
                                  <Check className="h-3 w-3 mr-0.5 stroke-[2.5]" />
                                  Done
                                </span>
                              )}
                            </span>
                            {note && (
                              <span className="block text-[13px] text-[#946000] leading-snug">{note}</span>
                            )}
                            {alerts.length > 0 && (
                              <span className="mt-0.5 flex flex-wrap gap-1">
                                {alerts.map((a) => (
                                  <span
                                    key={a}
                                    className="px-1.5 rounded border border-[#B33432] text-xs font-bold text-[#B33432]"
                                  >
                                    {a}
                                  </span>
                                ))}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                    {t.notes && (
                      <p className="pb-1.5 text-[13px] text-[#946000] leading-snug">Note: {t.notes}</p>
                    )}
                  </div>

                  {/* Action */}
                  <div className="px-1.5 pb-1.5">
                    {isRecall ? (
                      <button
                        type="button"
                        onClick={() => recall(t)}
                        className="w-full h-11 rounded-md text-sm font-semibold border border-[#D8CEC1] bg-[#F7F3EC] hover:bg-[#EEE7DD] text-[#292320] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2837] focus-visible:ring-offset-1"
                      >
                        Recall to ready
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busyIds[t.id]}
                        onClick={() => advance(t)}
                        className={`w-full h-11 rounded-md text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B2837] focus-visible:ring-offset-1 ${
                          t.status === "QUEUED"
                            ? "bg-[#DDA032] hover:bg-[#CC9028] text-[#292320]"
                            : t.status === "PREPARING"
                            ? "bg-[#237A4B] hover:bg-[#1C653D] text-[#FFFCF7]"
                            : "bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7]"
                        }`}
                      >
                        {t.status === "QUEUED"
                          ? "Start cooking"
                          : t.status === "PREPARING"
                          ? "Mark ready"
                          : "Mark served"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
