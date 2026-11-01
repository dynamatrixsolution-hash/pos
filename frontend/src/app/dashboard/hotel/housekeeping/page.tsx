"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  Wrench,
  Plus,
  CheckCircle2,
  Play,
  ShieldCheck,
  RefreshCw,
  X,
} from "lucide-react";

interface Room {
  id: string;
  roomNumber: string;
  status: string;
  roomType?: {
    id: string;
    name: string;
    code: string;
  };
}

interface HousekeepingTask {
  id: string;
  roomId: string;
  taskType: string;
  status: "DIRTY" | "IN_PROGRESS" | "CLEAN" | "INSPECTED";
  priority: string;
  scheduledDate: string;
  completedAt?: string | null;
  notes?: string | null;
  room?: Room;
}

interface MaintenanceTicket {
  id: string;
  roomId: string;
  title: string;
  description?: string | null;
  priority: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  startDate: string;
  endDate?: string | null;
  resolvedAt?: string | null;
  room?: Room;
}

const HK_STATUS_FILTERS = ["ALL", "DIRTY", "IN_PROGRESS", "CLEAN", "INSPECTED"] as const;

export default function HotelHousekeepingMaintenancePage() {
  const [activeTab, setActiveTab] = useState<"HOUSEKEEPING" | "MAINTENANCE">("HOUSEKEEPING");
  const [hkFilter, setHkFilter] = useState<string>("ALL");

  const [rooms, setRooms] = useState<Room[]>([]);
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // + Dispatch Housekeeping Task Modal
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTaskRoomId, setNewTaskRoomId] = useState("");
  const [newTaskType, setNewTaskType] = useState("TURNOVER");
  const [newTaskPriority, setNewTaskPriority] = useState("NORMAL");
  const [newTaskNotes, setNewTaskNotes] = useState("");

  // + Block Room for Maintenance Modal
  const [showNewMaintModal, setShowNewMaintModal] = useState(false);
  const [maintRoomId, setMaintRoomId] = useState("");
  const [maintTitle, setMaintTitle] = useState("");
  const [maintPriority, setMaintPriority] = useState("HIGH");
  const [maintStartDate, setMaintStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [maintEndDate, setMaintEndDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [maintDescription, setMaintDescription] = useState("");

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const hkQuery =
        hkFilter !== "ALL" ? `?status=${encodeURIComponent(hkFilter)}` : "";

      const [hkRes, mtRes, rmRes] = await Promise.all([
        fetch(`/api/v1/hotel/housekeeping${hkQuery}`),
        fetch("/api/v1/hotel/maintenance"),
        fetch("/api/v1/hotel/rooms"),
      ]);

      if (rmRes.ok) {
        const rmData = await rmRes.json();
        const loadedRooms: Room[] = rmData.rooms || [];
        setRooms(loadedRooms);
        if (loadedRooms.length > 0) {
          if (!newTaskRoomId) setNewTaskRoomId(loadedRooms[0].id);
          if (!maintRoomId) setMaintRoomId(loadedRooms[0].id);
        }
      }

      if (hkRes.ok) {
        const hkData = await hkRes.json();
        setTasks(hkData.tasks || []);
      }

      if (mtRes.ok) {
        const mtData = await mtRes.json();
        setTickets(mtData.tickets || []);
      }
    } catch (err: any) {
      setError(err.message || "Error loading housekeeping and maintenance data");
    } finally {
      setLoading(false);
    }
  }, [hkFilter, newTaskRoomId, maintRoomId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleProgressTask = async (
    task: HousekeepingTask,
    nextStatus: "IN_PROGRESS" | "CLEAN" | "INSPECTED"
  ) => {
    try {
      setActionLoadingId(task.id);
      const res = await fetch(`/api/v1/hotel/housekeeping/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update task status");
      await loadAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskRoomId) return;
    try {
      setActionLoadingId("new-task");
      const res = await fetch("/api/v1/hotel/housekeeping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: newTaskRoomId,
          taskType: newTaskType,
          priority: newTaskPriority,
          status: "DIRTY",
          notes: newTaskNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create housekeeping task");

      setShowNewTaskModal(false);
      setNewTaskNotes("");
      await loadAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintRoomId || !maintTitle.trim()) return;
    try {
      setActionLoadingId("new-maint");
      const res = await fetch("/api/v1/hotel/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: maintRoomId,
          title: maintTitle,
          priority: maintPriority,
          startDate: new Date(`${maintStartDate}T00:00:00.000Z`).toISOString(),
          endDate: maintEndDate
            ? new Date(`${maintEndDate}T23:59:59.000Z`).toISOString()
            : undefined,
          description: maintDescription || undefined,
          isBlocking: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create maintenance block");

      setShowNewMaintModal(false);
      setMaintTitle("");
      setMaintDescription("");
      await loadAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResolveTicket = async (ticket: MaintenanceTicket) => {
    try {
      setActionLoadingId(ticket.id);
      const res = await fetch(`/api/v1/hotel/maintenance/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "RESOLVED",
          resolutionNotes: "Resolved by maintenance staff",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resolve maintenance ticket");
      await loadAll();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const getHkStatusBadge = (status: HousekeepingTask["status"]) => {
    switch (status) {
      case "DIRTY":
        return "bg-[#FDF6E9] text-[#946000] border-[#EDD7AD]";
      case "IN_PROGRESS":
        return "bg-[#F9EFF1] text-[#6B2837] border-[#E3C6CC]";
      case "CLEAN":
      case "INSPECTED":
      default:
        return "bg-[#EBF4F0] text-[#28634B] border-[#C3DED0]";
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-sandstone pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-espresso tracking-tight">
              Housekeeping & Maintenance
            </h1>
          </div>
          <p className="text-xs text-warmgray mt-0.5">
            Room turnover queue, cleanliness verification, and out-of-service maintenance blocks
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            className="p-2 rounded-lg border border-sandstone bg-porcelain hover:bg-stone text-espresso cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowNewTaskModal(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-sandstone bg-porcelain hover:bg-stone text-espresso flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Cleaning Task</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNewMaintModal(true)}
            className="px-4 py-2 text-xs font-bold rounded-lg bg-[#B33432] hover:opacity-95 text-[#FFFCF7] shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>+ Block Room for Maintenance</span>
          </button>
        </div>
      </div>

      {/* Main View Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex rounded-xl border border-sandstone bg-porcelain p-1">
          <button
            type="button"
            onClick={() => setActiveTab("HOUSEKEEPING")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "HOUSEKEEPING"
                ? "bg-[#6B2837] text-[#FFFCF7] shadow-xs"
                : "text-espresso hover:bg-stone"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Housekeeping Tasks ({tasks.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("MAINTENANCE")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "MAINTENANCE"
                ? "bg-[#6B2837] text-[#FFFCF7] shadow-xs"
                : "text-espresso hover:bg-stone"
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            <span>Maintenance Blocks ({tickets.length})</span>
          </button>
        </div>

        {activeTab === "HOUSEKEEPING" && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {HK_STATUS_FILTERS.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setHkFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  hkFilter === st
                    ? "bg-[#946000] text-[#FFFCF7] border-[#946000]"
                    : "bg-porcelain text-espresso border-sandstone hover:bg-stone"
                }`}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-[#E9B6B7] bg-[#FCEEEE] p-3 text-xs font-medium text-[#B33432]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-sandstone bg-porcelain p-12 text-center text-xs text-warmgray">
          Loading tasks and maintenance blocks...
        </div>
      ) : activeTab === "HOUSEKEEPING" ? (
        /* Housekeeping Tasks Queue */
        tasks.length === 0 ? (
          <div className="rounded-xl border border-sandstone bg-porcelain p-12 text-center space-y-2">
            <div className="text-sm font-bold text-espresso">No Housekeeping Tasks</div>
            <p className="text-xs text-warmgray">
              All rooms are clean and inspected, or no tasks match the current filter.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-xl border border-sandstone bg-porcelain p-4 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-espresso">
                      Room {task.room?.roomNumber || "N/A"}
                    </h3>
                    <div className="text-xs text-warmgray font-medium">
                      {task.taskType} • Priority: {task.priority}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getHkStatusBadge(
                      task.status
                    )}`}
                  >
                    {task.status}
                  </span>
                </div>

                {task.notes && (
                  <div className="rounded-lg bg-ivory/70 border border-sandstone/70 p-2.5 text-xs text-espresso">
                    {task.notes}
                  </div>
                )}

                {/* One-Click Progression Actions */}
                <div className="pt-2 border-t border-sandstone flex items-center gap-2">
                  {task.status === "DIRTY" && (
                    <button
                      type="button"
                      disabled={actionLoadingId === task.id}
                      onClick={() => handleProgressTask(task, "IN_PROGRESS")}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-[#946000] hover:opacity-95 text-[#FFFCF7] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>Start Cleaning</span>
                    </button>
                  )}

                  {task.status === "IN_PROGRESS" && (
                    <button
                      type="button"
                      disabled={actionLoadingId === task.id}
                      onClick={() => handleProgressTask(task, "CLEAN")}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-[#28634B] hover:opacity-95 text-[#FFFCF7] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Mark Clean</span>
                    </button>
                  )}

                  {task.status === "CLEAN" && (
                    <button
                      type="button"
                      disabled={actionLoadingId === task.id}
                      onClick={() => handleProgressTask(task, "INSPECTED")}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Verify Inspected</span>
                    </button>
                  )}

                  {task.status === "INSPECTED" && (
                    <div className="w-full py-1.5 text-center text-xs font-bold text-[#28634B] bg-[#EBF4F0] rounded-lg border border-[#C3DED0]">
                      ✓ Room Vacant Clean & Inspected
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : /* Maintenance Blocks List */
      tickets.length === 0 ? (
        <div className="rounded-xl border border-sandstone bg-porcelain p-12 text-center space-y-2">
          <div className="text-sm font-bold text-espresso">No Maintenance Tickets</div>
          <p className="text-xs text-warmgray">
            No rooms are currently blocked for maintenance or repairs.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tickets.map((ticket) => {
            const isResolved = ticket.status === "RESOLVED" || ticket.status === "CLOSED";
            return (
              <div
                key={ticket.id}
                className="rounded-xl border border-sandstone bg-porcelain p-4 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-espresso">
                        Room {ticket.room?.roomNumber || "N/A"}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone text-espresso">
                        {ticket.priority}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-[#B33432] mt-1">{ticket.title}</div>
                    {ticket.description && (
                      <p className="text-xs text-warmgray mt-0.5">{ticket.description}</p>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      isResolved
                        ? "bg-[#EBF4F0] text-[#28634B] border-[#C3DED0]"
                        : "bg-[#FCEEEE] text-[#B33432] border-[#E9B6B7]"
                    }`}
                  >
                    {ticket.status}
                  </span>
                </div>

                <div className="rounded-lg bg-ivory/70 border border-sandstone/70 p-2.5 text-xs flex items-center justify-between text-warmgray">
                  <span>
                    Block: {new Date(ticket.startDate).toLocaleDateString()} →{" "}
                    {ticket.endDate ? new Date(ticket.endDate).toLocaleDateString() : "Open-ended"}
                  </span>
                  {ticket.resolvedAt && (
                    <span className="text-[#28634B] font-semibold">
                      Resolved {new Date(ticket.resolvedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {!isResolved && (
                  <div className="pt-2 border-t border-sandstone flex justify-end">
                    <button
                      type="button"
                      disabled={actionLoadingId === ticket.id}
                      onClick={() => handleResolveTicket(ticket)}
                      className="px-4 py-1.5 rounded-lg bg-[#28634B] hover:opacity-95 text-[#FFFCF7] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>
                        {actionLoadingId === ticket.id
                          ? "Resolving..."
                          : "Resolve & Release Block"}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* + Dispatch Cleaning Task Modal */}
      {showNewTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-sandstone bg-porcelain p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-sandstone pb-3">
              <h3 className="text-sm font-bold text-espresso">Dispatch Housekeeping Task</h3>
              <button
                type="button"
                onClick={() => setShowNewTaskModal(false)}
                className="text-warmgray hover:text-espresso cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">Room *</label>
                <select
                  required
                  value={newTaskRoomId}
                  onChange={(e) => setNewTaskRoomId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                >
                  <option value="">-- Select Room --</option>
                  {rooms.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      Room {rm.roomNumber} ({rm.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Task Type
                  </label>
                  <select
                    value={newTaskType}
                    onChange={(e) => setNewTaskType(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  >
                    <option value="TURNOVER">TURNOVER</option>
                    <option value="DAILY_CLEAN">DAILY_CLEAN</option>
                    <option value="DEEP_CLEAN">DEEP_CLEAN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Priority
                  </label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  >
                    <option value="LOW">LOW</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Fresh linens, VIP arrival..."
                  value={newTaskNotes}
                  onChange={(e) => setNewTaskNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-sandstone">
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-warmgray hover:text-espresso cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === "new-task"}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#6B2837] hover:bg-[#541E2A] text-[#FFFCF7] cursor-pointer"
                >
                  {actionLoadingId === "new-task" ? "Creating..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* + Block Room for Maintenance Modal */}
      {showNewMaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-sandstone bg-porcelain p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-sandstone pb-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-[#B33432]" />
                <h3 className="text-sm font-bold text-espresso">Block Room for Maintenance</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewMaintModal(false)}
                className="text-warmgray hover:text-espresso cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMaintenance} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">Room *</label>
                  <select
                    required
                    value={maintRoomId}
                    onChange={(e) => setMaintRoomId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  >
                    <option value="">-- Select Room --</option>
                    {rooms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        Room {rm.roomNumber} ({rm.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Priority
                  </label>
                  <select
                    value={maintPriority}
                    onChange={(e) => setMaintPriority(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  Issue Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="HVAC compressor repair / plumbing leak"
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={maintStartDate}
                    onChange={(e) => setMaintStartDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-espresso mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={maintEndDate}
                    onChange={(e) => setMaintEndDate(e.target.value)}
                    className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-espresso mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Detailed maintenance notes..."
                  value={maintDescription}
                  onChange={(e) => setMaintDescription(e.target.value)}
                  className="w-full text-xs rounded-lg border border-sandstone bg-ivory/50 px-3 py-2 text-espresso focus:outline-none focus:border-[#6B2837]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-sandstone">
                <button
                  type="button"
                  onClick={() => setShowNewMaintModal(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-warmgray hover:text-espresso cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === "new-maint"}
                  className="px-4 py-1.5 text-xs font-bold rounded-lg bg-[#B33432] hover:opacity-95 text-[#FFFCF7] cursor-pointer"
                >
                  {actionLoadingId === "new-maint" ? "Blocking..." : "Block Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
