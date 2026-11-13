"use client";

import React, { useState, useEffect } from "react";
import { useHotelHousekeepingStore } from "../state/hotel-housekeeping.store";
import { Sparkles, Wrench, Plus, RefreshCw, X, Loader2, CheckCircle2, Clock } from "lucide-react";

const HK_FILTERS = ["ALL", "DIRTY", "IN_PROGRESS", "CLEAN", "INSPECTED"] as const;

export function HousekeepingContainer() {
  const {
    activeTab,
    hkFilter,
    rooms,
    tasks,
    tickets,
    loading,
    actionLoadingId,
    setActiveTab,
    setHkFilter,
    loadAll,
    createHousekeepingTask,
    updateTaskStatus,
    createMaintenanceTicket,
    updateMaintenanceStatus,
  } = useHotelHousekeepingStore();

  // New Housekeeping Task Modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskRoomId, setTaskRoomId] = useState("");
  const [taskType, setTaskType] = useState("TURNOVER");
  const [taskPriority, setTaskPriority] = useState("NORMAL");
  const [taskNotes, setTaskNotes] = useState("");

  // New Maintenance Ticket Modal
  const [showMaintModal, setShowMaintModal] = useState(false);
  const [maintRoomId, setMaintRoomId] = useState("");
  const [maintTitle, setMaintTitle] = useState("");
  const [maintPriority, setMaintPriority] = useState("HIGH");
  const [maintStartDate, setMaintStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [maintEndDate, setMaintEndDate] = useState(() => {
    const d = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });
  const [maintDescription, setMaintDescription] = useState("");

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskRoomId) return;
    const success = await createHousekeepingTask({
      roomId: taskRoomId,
      taskType,
      priority: taskPriority,
      notes: taskNotes || undefined,
    });
    if (success) {
      setShowTaskModal(false);
      setTaskRoomId("");
      setTaskNotes("");
    }
  };

  const handleCreateMaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintRoomId || !maintTitle) return;
    const success = await createMaintenanceTicket({
      roomId: maintRoomId,
      title: maintTitle,
      priority: maintPriority,
      startDate: new Date(maintStartDate).toISOString(),
      endDate: new Date(maintEndDate).toISOString(),
      description: maintDescription || undefined,
    });
    if (success) {
      setShowMaintModal(false);
      setMaintRoomId("");
      setMaintTitle("");
      setMaintDescription("");
    }
  };

  const getHkBadge = (status: string) => {
    switch (status) {
      case "DIRTY":
        return "bg-[#FCEEEE] text-[#B33432] border-[#E9B6B7]";
      case "IN_PROGRESS":
        return "bg-[#FDF6E9] text-[#946000] border-[#EDD7AD]";
      case "CLEAN":
        return "bg-[#EBF4F0] text-[#28634B] border-[#C3DED0]";
      case "INSPECTED":
        return "bg-[#F9EFF1] text-[#6B2837] border-[#E3C6CC]";
      default:
        return "bg-[#F7F3EC] text-[#71675E] border-[#EEE7DD]";
    }
  };

  const getMaintBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return "bg-[#FCEEEE] text-[#B33432] border-[#E9B6B7]";
      case "IN_PROGRESS":
        return "bg-[#FDF6E9] text-[#946000] border-[#EDD7AD]";
      case "RESOLVED":
      case "CLOSED":
        return "bg-[#EBF4F0] text-[#28634B] border-[#C3DED0]";
      default:
        return "bg-[#F7F3EC] text-[#71675E] border-[#EEE7DD]";
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Housekeeping & Maintenance</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Room turn-downs, inspection logs, clean status tracking & maintenance work orders
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {activeTab === "HOUSEKEEPING" ? (
            <button
              onClick={() => setShowTaskModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Dispatch Task
            </button>
          ) : (
            <button
              onClick={() => setShowMaintModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Log Maintenance
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("HOUSEKEEPING")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === "HOUSEKEEPING"
                ? "bg-[#6B2837] text-white"
                : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Housekeeping Tasks ({tasks.length})
          </button>
          <button
            onClick={() => setActiveTab("MAINTENANCE")}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              activeTab === "MAINTENANCE"
                ? "bg-[#6B2837] text-white"
                : "text-[#71675E] hover:text-[#292320] hover:bg-[#F7F3EC]"
            }`}
          >
            <Wrench className="h-3.5 w-3.5" />
            Maintenance Tickets ({tickets.length})
          </button>
        </div>

        {activeTab === "HOUSEKEEPING" && (
          <div className="flex items-center gap-1 overflow-x-auto">
            {HK_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setHkFilter(f)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                  hkFilter === f
                    ? "bg-[#292320] text-white"
                    : "text-[#71675E] hover:bg-[#F7F3EC]"
                }`}
              >
                {f.replace("_", " ")}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-8 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Loading housekeeping & maintenance logs...
        </div>
      ) : activeTab === "HOUSEKEEPING" ? (
        tasks.length === 0 ? (
          <div className="p-10 text-center bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
            <Sparkles className="h-8 w-8 text-[#71675E] mx-auto mb-2 opacity-50" />
            <h3 className="text-sm font-semibold text-[#292320]">No housekeeping tasks</h3>
            <p className="text-xs text-[#71675E] mt-1">All rooms are currently in order.</p>
          </div>
        ) : (
          <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#EEE7DD] bg-[#F7F3EC] text-[#71675E]">
                  <th className="py-2.5 px-3 font-semibold">Room</th>
                  <th className="py-2.5 px-3 font-semibold">Task Type</th>
                  <th className="py-2.5 px-3 font-semibold">Priority</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Scheduled / Updated</th>
                  <th className="py-2.5 px-3 font-semibold">Notes</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEE7DD]">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-[#292320]">
                      Room {task.room?.roomNumber || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-[#292320] font-medium">{task.taskType}</td>
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] font-semibold text-[#71675E]">{task.priority}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${getHkBadge(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 tabular-nums text-[#71675E]">
                      {new Date(task.scheduledDate).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-[#71675E] max-w-xs truncate">{task.notes || "—"}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {task.status === "DIRTY" && (
                          <button
                            onClick={() => updateTaskStatus(task.id, "IN_PROGRESS")}
                            disabled={actionLoadingId === task.id}
                            className="px-2 py-1 text-[11px] font-semibold text-[#946000] bg-[#FDF6E9] hover:bg-[#FCEBD0] border border-[#EDD7AD] rounded transition-colors"
                          >
                            Start Cleaning
                          </button>
                        )}
                        {task.status === "IN_PROGRESS" && (
                          <button
                            onClick={() => updateTaskStatus(task.id, "CLEAN")}
                            disabled={actionLoadingId === task.id}
                            className="px-2 py-1 text-[11px] font-semibold text-[#28634B] bg-[#EBF4F0] hover:bg-[#DAEFE4] border border-[#C3DED0] rounded transition-colors"
                          >
                            Mark Clean
                          </button>
                        )}
                        {task.status === "CLEAN" && (
                          <button
                            onClick={() => updateTaskStatus(task.id, "INSPECTED")}
                            disabled={actionLoadingId === task.id}
                            className="px-2 py-1 text-[11px] font-semibold text-[#6B2837] bg-[#F9EFF1] hover:bg-[#F2DFE4] border border-[#E3C6CC] rounded transition-colors"
                          >
                            Pass Inspection
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        tickets.length === 0 ? (
          <div className="p-10 text-center bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
            <Wrench className="h-8 w-8 text-[#71675E] mx-auto mb-2 opacity-50" />
            <h3 className="text-sm font-semibold text-[#292320]">No maintenance tickets</h3>
            <p className="text-xs text-[#71675E] mt-1">No rooms are currently marked out of order.</p>
          </div>
        ) : (
          <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#EEE7DD] bg-[#F7F3EC] text-[#71675E]">
                  <th className="py-2.5 px-3 font-semibold">Room</th>
                  <th className="py-2.5 px-3 font-semibold">Issue Title</th>
                  <th className="py-2.5 px-3 font-semibold">Priority</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Reported Date</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEE7DD]">
                {tickets.map((tkt) => (
                  <tr key={tkt.id} className="hover:bg-[#F7F3EC]/50 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-[#292320]">
                      Room {tkt.room?.roomNumber || "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-[#292320]">{tkt.title}</div>
                      {tkt.description && <div className="text-[11px] text-[#71675E]">{tkt.description}</div>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[11px] font-semibold text-[#B33432]">{tkt.priority}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${getMaintBadge(tkt.status)}`}>
                        {tkt.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 tabular-nums text-[#71675E]">
                      {new Date(tkt.startDate).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {tkt.status === "OPEN" && (
                          <button
                            onClick={() => updateMaintenanceStatus(tkt.id, "IN_PROGRESS")}
                            disabled={actionLoadingId === tkt.id}
                            className="px-2 py-1 text-[11px] font-semibold text-[#946000] bg-[#FDF6E9] hover:bg-[#FCEBD0] border border-[#EDD7AD] rounded transition-colors"
                          >
                            In Progress
                          </button>
                        )}
                        {tkt.status === "IN_PROGRESS" && (
                          <button
                            onClick={() => updateMaintenanceStatus(tkt.id, "RESOLVED")}
                            disabled={actionLoadingId === tkt.id}
                            className="px-2 py-1 text-[11px] font-semibold text-[#28634B] bg-[#EBF4F0] hover:bg-[#DAEFE4] border border-[#C3DED0] rounded transition-colors"
                          >
                            Resolve & Release
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Dispatch Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-3">
              <h3 className="text-base font-bold text-[#292320]">Dispatch Housekeeping Task</h3>
              <button onClick={() => setShowTaskModal(false)} className="p-1 rounded text-[#71675E] hover:bg-[#F7F3EC]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#292320] mb-1">Room *</label>
                <select
                  required
                  value={taskRoomId}
                  onChange={(e) => setTaskRoomId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                >
                  <option value="">Select Room</option>
                  {rooms.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      Room {rm.roomNumber} ({rm.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Task Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  >
                    <option value="TURNOVER">Turnover Clean</option>
                    <option value="DAILY_SERVICE">Daily Service</option>
                    <option value="DEEP_CLEAN">Deep Clean</option>
                    <option value="LINEN_CHANGE">Linen Change</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">Instructions / Notes</label>
                <textarea
                  rows={2}
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder="e.g. Sanitize bathroom, refill mini bar"
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EEE7DD]">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-3.5 py-2 font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === "new-task"}
                  className="px-4 py-2 font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors"
                >
                  {actionLoadingId === "new-task" ? "Dispatching..." : "Dispatch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Maintenance Modal */}
      {showMaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-xl max-w-md w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EEE7DD] pb-3">
              <h3 className="text-base font-bold text-[#292320]">Block Room for Maintenance</h3>
              <button onClick={() => setShowMaintModal(false)} className="p-1 rounded text-[#71675E] hover:bg-[#F7F3EC]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMaint} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#292320] mb-1">Room to Block *</label>
                <select
                  required
                  value={maintRoomId}
                  onChange={(e) => setMaintRoomId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                >
                  <option value="">Select Room</option>
                  {rooms.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      Room {rm.roomNumber} ({rm.roomType?.name || "Room"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">Issue / Ticket Title *</label>
                <input
                  type="text"
                  required
                  value={maintTitle}
                  onChange={(e) => setMaintTitle(e.target.value)}
                  placeholder="e.g. AC leaking, Geyser repair"
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Start Date</label>
                  <input
                    type="date"
                    value={maintStartDate}
                    onChange={(e) => setMaintStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#292320] mb-1">Expected Completion</label>
                  <input
                    type="date"
                    value={maintEndDate}
                    onChange={(e) => setMaintEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#292320] mb-1">Description / Technicians Needed</label>
                <textarea
                  rows={2}
                  value={maintDescription}
                  onChange={(e) => setMaintDescription(e.target.value)}
                  placeholder="Details of the fault"
                  className="w-full px-3 py-2 bg-[#F7F3EC] border border-[#EEE7DD] rounded-md focus:border-[#6B2837] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#EEE7DD]">
                <button
                  type="button"
                  onClick={() => setShowMaintModal(false)}
                  className="px-3.5 py-2 font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === "new-maint"}
                  className="px-4 py-2 font-semibold text-white bg-[#6B2837] rounded-md hover:bg-[#521E2A] transition-colors"
                >
                  {actionLoadingId === "new-maint" ? "Blocking..." : "Log & Block Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

