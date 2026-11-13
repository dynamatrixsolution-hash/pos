"use client";

import React, { useState, useEffect, useCallback } from "react";
import { usersRepository } from "../repositories/users.repository";
import { UserDeviceRecord } from "../models/users.types";
import {
  Smartphone,
  Laptop,
  RefreshCw,
  Trash2,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { Notify } from "@/lib/notify";

export function DevicesContainer() {
  const [devices, setDevices] = useState<UserDeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadDevices = useCallback(async () => {
    try {
      setLoading(true);
      const data = await usersRepository.fetchDevices();
      setDevices(data);
    } catch (err) {
      console.error("Failed to load active devices:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke and disconnect "${name}"?`)) return;
    try {
      setActionLoadingId(id);
      await usersRepository.revokeDevice(id);
      Notify.success("Device session revoked successfully");
      await loadDevices();
    } catch (err: any) {
      Notify.error(err.message || "Failed to revoke device session");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EEE7DD] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-[#6B2837]" />
            <h1 className="text-xl font-bold text-[#292320] tracking-tight">Active Devices & POS Stations</h1>
          </div>
          <p className="text-xs text-[#71675E] mt-0.5">
            Manage authenticated mobile terminals, cashier stations, kitchen tablets & active sessions
          </p>
        </div>

        <button
          onClick={() => loadDevices()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#292320] bg-[#FFFCF7] border border-[#EEE7DD] rounded-md hover:bg-[#F7F3EC] transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-[#71675E] bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#6B2837]" />
          Scanning authenticated device sessions...
        </div>
      ) : devices.length === 0 ? (
        <div className="p-10 text-center bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg">
          <Smartphone className="h-8 w-8 text-[#71675E] mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-semibold text-[#292320]">No active remote devices</h3>
          <p className="text-xs text-[#71675E] mt-1">Authenticated mobile devices and POS clients will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((dev) => (
            <div
              key={dev.id}
              className="bg-[#FFFCF7] border border-[#EEE7DD] rounded-lg p-4 space-y-3 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-[#F7F3EC] rounded border border-[#EEE7DD]">
                    {dev.deviceType === "MOBILE" ? (
                      <Smartphone className="h-4 w-4 text-[#6B2837]" />
                    ) : (
                      <Laptop className="h-4 w-4 text-[#6B2837]" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-[#292320]">{dev.deviceName}</h4>
                    <div className="text-[10px] text-[#71675E]">
                      {dev.user?.name} • {dev.user?.role}
                    </div>
                  </div>
                </div>

                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#EBF4F0] text-[#28634B] border border-[#C3DED0]">
                  ACTIVE
                </span>
              </div>

              <div className="space-y-1 text-[11px] text-[#71675E]">
                {dev.ipAddress && <div>IP: {dev.ipAddress}</div>}
                <div>Last Seen: {new Date(dev.lastActive).toLocaleString()}</div>
              </div>

              <div className="pt-2 border-t border-[#EEE7DD] flex justify-end">
                <button
                  onClick={() => handleRevoke(dev.id, dev.deviceName)}
                  disabled={actionLoadingId === dev.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#B33432] bg-[#FCEEEE] hover:bg-[#F9DDDD] border border-[#E9B6B7] rounded transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Revoke Session
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

