"use client";

import React, { useEffect, useState } from "react";

interface BackupMetadata {
  filename: string;
  sizeBytes: number;
  timestamp: string;
  tables: Record<string, number>;
  checksum: string;
  verified: boolean;
  status: "SUCCESS" | "FAILED";
  errorMessage?: string;
}

export default function BackupRestorePage() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/settings/backup");
      const data = await res.json();
      if (Array.isArray(data)) {
        setBackups(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "backup" }),
      });
      const data = await res.json();
      if (data.error) {
        alert("Backup failed: " + data.error);
      } else {
        alert("Backup completed successfully!");
        fetchBackups();
      }
    } catch (e) {
      console.error(e);
      alert("Error executing backup");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async (filename: string) => {
    const confirmRestore = window.confirm(
      `WARNING: You are about to restore the database to backup "${filename}". This will completely overwrite all current sales, products, and configurations. Are you sure you want to proceed?`
    );

    if (!confirmRestore) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", filename }),
      });
      const data = await res.json();
      if (data.error) {
        alert("Restore failed: " + data.error);
      } else {
        alert("Database successfully restored!");
        fetchBackups();
      }
    } catch (e) {
      console.error(e);
      alert("Error executing restore");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-100 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Block */}
        <div className="relative p-6 rounded-2xl bg-gradient-to-r from-red-800 via-rose-700 to-indigo-800 shadow-xl overflow-hidden">
          <div className="relative z-10 space-y-2">
            <span className="px-3 py-1 bg-red-900/50 backdrop-blur border border-red-400/30 text-red-300 rounded-full text-xs font-semibold uppercase tracking-wider">
              System Recovery
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight">Database Backup & Recovery</h1>
            <p className="text-red-200 text-sm max-w-2xl">
              Create complete technical snapshots of your database schemas, sales transactional records, ledger assets, and recover instantly in case of outages.
            </p>
          </div>
        </div>

        {/* Action Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold border-b border-slate-800 pb-3">Quick Actions</h3>
            <div className="space-y-4">
              <button
                onClick={handleBackup}
                disabled={submitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 font-bold text-white rounded-lg shadow-lg transition-all duration-300 disabled:bg-slate-800"
              >
                {submitting ? "Processing..." : "Create Backup Snapshot Now"}
              </button>
              <div className="p-4 bg-slate-900 rounded-xl space-y-2 text-xs text-slate-400">
                <h4 className="font-semibold text-slate-200">Backup Information:</h4>
                <p>• Location: `/scratch/backups/`</p>
                <p>• Format: JSON Database Serialization</p>
                <p>• Security: Tenant-isolated workspace partition</p>
              </div>
            </div>
          </div>

          {/* Diagnostics Panel */}
          <div className="lg:col-span-2 bg-slate-950 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-lg font-bold border-b border-slate-800 pb-3">Backup Engine Diagnostics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-3 p-3 bg-slate-900 rounded-xl">
                <span className="p-1 bg-green-500/20 text-green-400 rounded-lg">✔</span>
                <div>
                  <h4 className="font-semibold text-slate-200">Encryption status</h4>
                  <p className="text-xs text-slate-400">Checksum verification active.</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-slate-900 rounded-xl">
                <span className="p-1 bg-green-500/20 text-green-400 rounded-lg">✔</span>
                <div>
                  <h4 className="font-semibold text-slate-200">Failure monitoring</h4>
                  <p className="text-xs text-slate-400">Audit logs track error counts.</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-slate-900 rounded-xl">
                <span className="p-1 bg-green-500/20 text-green-400 rounded-lg">✔</span>
                <div>
                  <h4 className="font-semibold text-slate-200">Referential isolation</h4>
                  <p className="text-xs text-slate-400">Restores enforce foreign keys.</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-slate-900 rounded-xl">
                <span className="p-1 bg-green-500/20 text-green-400 rounded-lg">✔</span>
                <div>
                  <h4 className="font-semibold text-slate-200">Tenant Boundary Guard</h4>
                  <p className="text-xs text-slate-400">Validates businessId parameters.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Backups List Table */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
            <h3 className="text-lg font-bold">Completed Backups Registry</h3>
            <button
              onClick={fetchBackups}
              className="px-4 py-1.5 bg-slate-850 hover:bg-slate-800 text-xs font-semibold rounded-lg transition-all duration-300"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading backup snapshots registry...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold uppercase text-xs">
                    <th className="p-4">Backup Filename</th>
                    <th className="p-4">Size</th>
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Records Summary</th>
                    <th className="p-4">Checksum (SHA-256)</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-center">Recovery Action</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">No backup records created yet.</td>
                    </tr>
                  ) : (
                    backups.map((item) => (
                      <tr key={item.filename} className="border-b border-slate-900 hover:bg-slate-900/30">
                        <td className="p-4 font-semibold text-slate-200 text-xs truncate max-w-xs">{item.filename}</td>
                        <td className="p-4 font-mono text-xs text-slate-300">{(item.sizeBytes / 1024).toFixed(2)} KB</td>
                        <td className="p-4 text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</td>
                        <td className="p-4 text-xs text-slate-350">
                          {`sales: ${item.tables.sales || 0}, items: ${item.tables.saleItems || 0}, credit: ${item.tables.creditNotes || 0}`}
                        </td>
                        <td className="p-4 font-mono text-[10px] text-slate-500 truncate max-w-[120px]" title={item.checksum}>
                          {item.checksum}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === "SUCCESS" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {item.status === "SUCCESS" && (
                            <button
                              disabled={submitting}
                              onClick={() => handleRestore(item.filename)}
                              className="px-3 py-1 bg-red-650 hover:bg-red-600 text-xs font-bold text-white rounded shadow transition-all duration-300 disabled:bg-slate-800"
                            >
                              Restore Data
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
