"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Activity, User, Clock, Terminal, Search, RefreshCw, Layers, Calendar, Filter, FileSpreadsheet, FileText, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { exportToExcel, exportToPDF } from "@/lib/export-helper";

interface UserItem {
  id?: string;
  name: string;
  email: string;
  role: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  module: string;
  details: string | null;
  oldValue: any;
  newValue: any;
  role: string | null;
  branchId: string | null;
  warehouseId: string | null;
  deviceInfo: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: UserItem | null;
}

interface BranchItem {
  id: string;
  name: string;
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Filters State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedModule, setSelectedModule] = useState("");
  const [selectedAction, setSelectedAction] = useState("");

  // Loaded Options
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [branchesList, setBranchesList] = useState<BranchItem[]>([]);

  // Dialog / Details Modal State
  const [viewingLog, setViewingLog] = useState<AuditLogItem | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const modulesList = [
    "USER", "PRODUCT", "PURCHASE", "SALE", "RETURN", 
    "INVENTORY", "CUSTOMER", "SUPPLIER", "PAYMENT", 
    "EXPENSE", "DISCOUNT", "SETTINGS", "BARCODE", "BACKUP"
  ];

  const actionsList = [
    "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", 
    "PRINT", "EXPORT", "RESTORE", "ADJUST", "APPROVE", "RECEIVE"
  ];

  // Load select options (users, branches)
  useEffect(() => {
    async function loadOptions() {
      try {
        const usersRes = await fetch("/api/v1/users");
        if (usersRes.ok) {
          const uData = await usersRes.json();
          setUsersList(uData.users || []);
        }

        const branchesRes = await fetch("/api/v1/branches");
        if (branchesRes.ok) {
          const bData = await branchesRes.json();
          setBranchesList(bData || []);
        }
      } catch (err) {
        console.error("Failed to load options:", err);
      }
    }
    loadOptions();
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/v1/users/activity?search=${search}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (selectedUser) url += `&userId=${selectedUser}`;
      if (selectedBranch) url += `&branchId=${selectedBranch}`;
      if (selectedWarehouse) url += `&warehouseId=${selectedWarehouse}`;
      if (selectedModule) url += `&module=${selectedModule}`;
      if (selectedAction) url += `&action=${selectedAction}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setCurrentPage(1);
      } else {
        setErrorMsg("Failed to load activity logs");
      }
    } catch (err) {
      console.error("Fetch activity logs error:", err);
      setErrorMsg("Network error loading activity logs");
    } finally {
      setLoading(false);
    }
  }, [search, startDate, endDate, selectedUser, selectedBranch, selectedWarehouse, selectedModule, selectedAction]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchLogs();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [fetchLogs]);

  const getActionBadgeColor = (action: string) => {
    switch (action.toUpperCase()) {
      case "CREATE":
        return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "UPDATE":
        return "bg-primary/10 text-primary border-primary/20";
      case "DELETE":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "LOGIN":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "LOGOUT":
        return "bg-slate-500/10 text-slate-600 border-slate-500/20";
      case "APPROVE":
        return "bg-sky-500/10 text-sky-600 border-sky-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = logs.map((log) => ({
      ID: log.id,
      Timestamp: new Date(log.createdAt).toLocaleString(),
      User: log.user?.name || "System/Automated",
      Email: log.user?.email || "N/A",
      Role: log.role || log.user?.role || "N/A",
      Action: log.action,
      Module: log.module,
      Details: log.details || "",
      "IP Address": log.ipAddress || "",
      "Device Info": log.deviceInfo || "",
    }));
    exportToExcel(exportData, `activity_logs_${new Date().toISOString().slice(0, 10)}`);
  };

  // Export to PDF
  const handleExportPDF = () => {
    const headers = ["Timestamp", "User", "Action", "Module", "Details", "IP Address"];
    const rows = logs.map((log) => [
      new Date(log.createdAt).toLocaleString(),
      log.user?.name || "System",
      log.action,
      log.module,
      log.details || "",
      log.ipAddress || "Localhost",
    ]);
    exportToPDF(headers, rows, "System Activity Logs", `activity_logs_${new Date().toISOString().slice(0, 10)}`);
  };

  // Pagination Logic
  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const currentLogs = logs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const resetFilters = () => {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setSelectedUser("");
    setSelectedBranch("");
    setSelectedWarehouse("");
    setSelectedModule("");
    setSelectedAction("");
  };

  const parseJSON = (val: any) => {
    if (!val) return "null";
    if (typeof val === "object") return JSON.stringify(val, null, 2);
    try {
      return JSON.stringify(JSON.parse(val), null, 2);
    } catch {
      return String(val);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-6 rounded-3xl shadow-sm bg-gradient-to-br from-primary/5 via-transparent to-transparent">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2 text-foreground">
            <Activity className="h-6 w-6 text-primary" />
            Activity Log
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit trail of user actions, transactions, and settings updates across the enterprise.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card hover:bg-secondary border border-border rounded-xl text-xs font-semibold text-foreground transition-all cursor-pointer"
            title="Export to Excel"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-card hover:bg-secondary border border-border rounded-xl text-xs font-semibold text-foreground transition-all cursor-pointer"
            title="Export to PDF"
          >
            <FileText className="h-4 w-4 text-red-500" />
            PDF
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      <div className="bg-card border border-border p-6 rounded-3xl space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <Filter className="h-4 w-4 text-primary" />
            Filters
          </h2>
          <button
            onClick={resetFilters}
            className="text-xs text-primary hover:underline font-semibold cursor-pointer"
          >
            Reset All
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* User filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">User</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Users</option>
              {usersList.map((u) => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          {/* Branch Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Branch</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Branches</option>
              {branchesList.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Warehouse Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Warehouse</label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Warehouses</option>
              {branchesList.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Module Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Module</label>
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Modules</option>
              {modulesList.map((mod) => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Action Type</label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">All Action Types</option>
              {actionsList.map((act) => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="pl-8 w-full px-3 py-1.5 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
              />
            </div>
          </div>

          {/* End Date */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-8 w-full px-3 py-1.5 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
              />
            </div>
          </div>

          {/* Text Search */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground">Text Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search detail, user, IP..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-full px-3 py-1.5 border border-border rounded-lg bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-lg font-bold border border-destructive/20">
          {errorMsg}
        </div>
      )}

      {/* 2. Audit Trail Log list */}
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
            Loading audit records...
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <Layers className="h-10 w-10 mx-auto text-muted-foreground opacity-30 mb-2" />
            No activity records found. Try modifying filters.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Employee / Role</th>
                    <th className="py-3 px-3">Action</th>
                    <th className="py-3 px-3">Module</th>
                    <th className="py-3 px-3">Details</th>
                    <th className="py-3 px-3">IP Address</th>
                    <th className="py-3 px-3 text-right">View Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {currentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-secondary/20">
                      <td className="py-3 px-3 whitespace-nowrap text-muted-foreground font-medium">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        {log.user ? (
                          <div>
                            <div className="font-bold text-foreground flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              {log.user.name}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {log.role || log.user.role} &bull; {log.user.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic font-medium">System / Automated</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${getActionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold border bg-secondary text-foreground border-border uppercase tracking-wider">
                          {log.module}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold text-foreground max-w-xs truncate">
                        {log.details || "No details provided"}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-muted-foreground font-mono">
                        <div className="flex items-center gap-1">
                          <Terminal className="h-3 w-3" />
                          {log.ipAddress || "Localhost"}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setViewingLog(log)}
                          className="p-1 hover:bg-secondary text-primary rounded-lg transition-colors cursor-pointer"
                          title="View JSON Data"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border/50 pt-4 text-xs">
                <div className="text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, logs.length)} of {logs.length} logs
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    className="p-1.5 border border-border hover:bg-secondary rounded-lg disabled:opacity-50 disabled:hover:bg-transparent cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="font-semibold text-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    className="p-1.5 border border-border hover:bg-secondary rounded-lg disabled:opacity-50 disabled:hover:bg-transparent cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* JSON Details Viewer Modal */}
      {viewingLog && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-border/50 flex items-center justify-between">
              <div>
                <h3 className="font-black text-foreground text-sm flex items-center gap-2">
                  <Terminal className="h-4.5 w-4.5 text-primary" />
                  Audit Log Details
                </h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">ID: {viewingLog.id}</p>
              </div>
              <button
                onClick={() => setViewingLog(null)}
                className="px-2.5 py-1 text-xs border border-border hover:bg-secondary rounded-xl transition-all font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 border-b border-border/50 pb-4">
                <div>
                  <span className="text-muted-foreground block font-bold text-[9px] uppercase">Module / Action</span>
                  <span className="font-bold text-foreground">{viewingLog.module} &raquo; {viewingLog.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-bold text-[9px] uppercase">Timestamp</span>
                  <span className="font-semibold text-foreground">{new Date(viewingLog.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-bold text-[9px] uppercase">User Scope</span>
                  <span className="font-semibold text-foreground">
                    {viewingLog.user?.name || "System"} ({viewingLog.role || viewingLog.user?.role || "N/A"})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-bold text-[9px] uppercase">IP / Device</span>
                  <span className="font-semibold text-foreground max-w-xs block truncate" title={viewingLog.deviceInfo || "N/A"}>
                    {viewingLog.ipAddress || "Local"} ({viewingLog.deviceInfo || "N/A"})
                  </span>
                </div>
              </div>

              <div>
                <span className="text-muted-foreground block font-bold text-[9px] uppercase mb-1">Details Summary</span>
                <p className="p-3 bg-secondary/30 border border-border/50 rounded-xl text-foreground font-medium">
                  {viewingLog.details || "No details string logged."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Old Value */}
                <div className="space-y-1">
                  <span className="text-muted-foreground block font-bold text-[9px] uppercase">Old Value (JSON)</span>
                  <pre className="p-3 bg-secondary/50 border border-border/50 rounded-xl overflow-x-auto font-mono text-[10px] text-foreground max-h-48 whitespace-pre">
                    {parseJSON(viewingLog.oldValue)}
                  </pre>
                </div>

                {/* New Value */}
                <div className="space-y-1">
                  <span className="text-muted-foreground block font-bold text-[9px] uppercase">New Value (JSON)</span>
                  <pre className="p-3 bg-secondary/50 border border-border/50 rounded-xl overflow-x-auto font-mono text-[10px] text-foreground max-h-48 whitespace-pre">
                    {parseJSON(viewingLog.newValue)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
