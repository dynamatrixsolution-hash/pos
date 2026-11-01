"use client";

import { useEffect, useState } from "react";

interface BackupMetadata {
  filename: string; sizeBytes: number; timestamp: string; tables: Record<string, number>; checksum: string;
}
async function fetchSnapshots(): Promise<BackupMetadata[]> {
  const response = await fetch("/api/v1/settings/backup");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to list snapshots");
  return data;
}
export default function BackupRestorePage() {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetchSnapshots().then(data => { if (active) setBackups(data); }).catch(error => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, []);
  async function create() {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/settings/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "backup" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Snapshot failed");
      setMessage(data.message);
      setBackups(await fetchSnapshots());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Snapshot failed"); }
    finally { setBusy(false); }
  }
  return <div className="p-6 space-y-6">
    <h1 className="text-2xl font-bold">Tenant backup and recovery</h1>
    <p>Owners can create encrypted tenant snapshots on configured server storage. Archives include financial history and stock records. Keep a separate copy and encryption key under your recovery procedure.</p>
    <p>Live overwrite restore is disabled. Operator recovery requires an isolated database and an absent tenant. Legacy JSON exports are incomplete and cannot be restored here.</p>
    <p>Archive authentication confirms integrity. It does not confirm a recovery rehearsal, offsite protection or an agreed recovery time.</p>
    <button className="rounded border px-4 py-2" disabled={busy} onClick={create}>{busy ? "Creating..." : "Create encrypted snapshot"}</button>
    <p role="status">{message}</p>
    <table className="w-full text-sm text-left"><thead><tr><th>Archive</th><th>Created</th><th>Records</th><th>Recovery</th></tr></thead>
      <tbody>{backups.map(item => <tr key={item.filename}>
        <td title={item.checksum}>{item.filename}<br />{item.sizeBytes} bytes</td>
        <td>{new Date(item.timestamp).toLocaleString()}</td>
        <td>Sales: {item.tables.Sale || 0}; payments: {item.tables.Payment || 0}; stock: {item.tables.ProductStock || 0}</td>
        <td>Integrity authenticated; rehearsal not recorded</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
