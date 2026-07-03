"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useSettings } from "@/components/settings-provider";
import { 
  Laptop, 
  Search, 
  ShieldAlert, 
  CheckCircle, 
  Unlock, 
  AlertCircle,
  HelpCircle
} from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  allowedDeviceId: string | null;
  deviceName: string | null;
  branch?: { name: string } | null;
}

export default function DeviceControlPage() {
  const { data: session } = useSession();
  const { currencySymbol } = useSettings();
  
  const [users, setUsers] = React.useState<UserItem[]>([]);
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState<string | null>(null);

  const loadUsers = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/v1/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleReleaseDevice = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to release the device lock for ${userName}? This will allow them to register a new hardware device/browser on their next login.`)) {
      return;
    }

    setIsMutating(userId);
    try {
      const res = await fetch(`/api/v1/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowedDeviceId: null,
          deviceName: null,
        }),
      });

      if (res.ok) {
        alert(`Successfully released device lock for ${userName}.`);
        loadUsers();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to release device lock.");
      }
    } catch (err) {
      console.error("Error releasing device:", err);
      alert("Failed to connect to the server.");
    } finally {
      setIsMutating(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.deviceName && u.deviceName.toLowerCase().includes(q))
    );
  });

  const isOwnerOrAdmin = session?.user && ["SUPER_ADMIN", "OWNER", "MANAGER"].includes((session.user as any).role);

  return (
    <div className="space-y-6">
      {/* 1. Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#E5E7EB] p-6 rounded-3xl shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-[#0F172A] flex items-center gap-2">
            <Laptop className="h-6 w-6 text-[#2563EB]" /> Device Control
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            Audit authorized POS browser devices, bind cashiers to specific hardware terminals, and release device authorization locks.
          </p>
        </div>
      </div>

      {/* 2. Explanatory Banner */}
      <div className="flex items-start gap-3 bg-[#38BDF8]/10 border border-[#38BDF8]/20 p-4 rounded-2xl text-xs text-[#0F172A] leading-relaxed">
        <HelpCircle className="h-5 w-5 text-[#2563EB] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-[#2563EB]">DynaOne Hardware Locking:</span> To prevent employees from accessing their cashier registers from unauthorized remote devices, DynaOne automatically locks each cashier account to the browser device of their first login. To transfer an employee to a different physical register, release their lock below.
        </div>
      </div>

      {/* 3. Filter and Table container */}
      <div className="bg-white border border-[#E5E7EB] rounded-3xl p-5 space-y-4 shadow-xs">
        {/* Search */}
        <div className="relative max-w-md flex items-center bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3.5 h-11 shadow-xs">
          <Search className="h-4.5 w-4.5 text-[#64748B]" />
          <input
            type="text"
            placeholder="Search by user name, email, or device details..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent border-none text-xs outline-none pl-2.5 text-[#0F172A] placeholder-[#94A3B8] font-semibold"
          />
        </div>

        {isLoading ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
            <p className="text-xs text-[#64748B]">Loading device catalog...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#64748B]">
            No authorized users match the query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F8FAFC] border-b border-[#E5E7EB] text-[#64748B] font-bold uppercase text-[9px] tracking-wider">
                  <th className="py-3 px-3">User / Employee</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Warehouse / Branch</th>
                  <th className="py-3 px-3">Lock Status</th>
                  <th className="py-3 px-3">Registered Device Name</th>
                  <th className="py-3 px-3">Registered Device Token</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredUsers.map((u) => {
                  const isLocked = !!u.allowedDeviceId;
                  return (
                    <tr key={u.id} className="hover:bg-[#F8FAFC]/50 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-[#0F172A]">{u.name}</div>
                        <div className="text-[10px] text-[#64748B] mt-0.5">{u.email}</div>
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#F8FAFC] border border-[#E5E7EB] rounded-md text-[#64748B]">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-[#64748B] font-semibold">
                        {u.branch?.name || <span className="text-[#94A3B8] font-normal">All Branches</span>}
                      </td>
                      <td className="py-3.5 px-3">
                        {isLocked ? (
                          <span className="flex items-center gap-1 text-[10px] font-extrabold text-[#EF4444]">
                            <ShieldAlert className="h-3.5 w-3.5" /> Locked
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-extrabold text-[#10B981]">
                            <Unlock className="h-3.5 w-3.5" /> Unlocked / Not Bound
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-semibold text-[#0F172A]">
                        {u.deviceName || <span className="text-[#94A3B8] font-normal">—</span>}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[10px] text-[#64748B]">
                        {u.allowedDeviceId ? (
                          <span title={u.allowedDeviceId}>
                            DEV-{u.allowedDeviceId.slice(0, 8).toUpperCase()}...
                          </span>
                        ) : (
                          <span className="text-[#94A3B8]">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {isLocked ? (
                          <button
                            disabled={!isOwnerOrAdmin || isMutating === u.id}
                            onClick={() => handleReleaseDevice(u.id, u.name)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-[10px] font-bold cursor-pointer disabled:opacity-50 transition-all shadow-xs"
                          >
                            <Unlock className="h-3 w-3" />
                            <span>Release Lock</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#94A3B8] font-medium italic">Pending login bind</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
