/**
 * Example: Branch Management Component (Owner Only)
 * This component shows how to build owner-specific features
 * 
 * Location: src/app/dashboard/branches/page.tsx or similar
 * Access: OWNER role only
 */

"use client";

import React, { useState } from "react";
import { useUser } from "@/lib/client-auth";
import { OwnerOnly } from "@/components/protected";
import { AlertTriangle, Plus, Edit2, Power } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isMain: boolean;
  isEnabled?: boolean; // Custom field to track enabled/disabled status
  employeeCount: number;
  createdAt: string;
}

export default function BranchManagementPage() {
  const user = useUser();

  return (
    <OwnerOnly
      fallback={
        <div className="p-8 bg-red-50 rounded-lg border border-red-200">
          <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
          <p className="text-red-600">Only business owners can manage branches</p>
        </div>
      }
    >
      <BranchManagementContent />
    </OwnerOnly>
  );
}

/**
 * Main branch management component
 */
function BranchManagementContent() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch branches on mount
  React.useEffect(() => {
    fetchBranches();
  }, []);

  async function fetchBranches() {
    try {
      setLoading(true);
      const response = await fetch("/api/branches");
      const data = await response.json();
      setBranches(data);
    } catch (error) {
      console.error("Failed to fetch branches:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Branch Management</h1>
          <p className="text-gray-600">Create, edit, and manage your business branches</p>
        </div>
        <button
          onClick={() => {
            setSelectedBranch(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Add Branch
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <BranchForm
          branch={selectedBranch}
          onClose={() => setShowForm(false)}
          onSave={async () => {
            setShowForm(false);
            await fetchBranches();
          }}
        />
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-2">Loading branches...</p>
        </div>
      )}

      {/* Branches Grid */}
      {!loading && branches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              onEdit={() => {
                setSelectedBranch(branch);
                setShowForm(true);
              }}
              onToggle={async () => {
                await toggleBranchStatus(branch.id, !branch.isEnabled);
                await fetchBranches();
              }}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && branches.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <AlertTriangle size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600">No branches yet</h3>
          <p className="text-gray-500 mb-4">Create your first branch to get started</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Create Branch
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Branch Card Component
 */
interface BranchCardProps {
  branch: Branch;
  onEdit: () => void;
  onToggle: () => void;
}

function BranchCard({ branch, onEdit, onToggle }: BranchCardProps) {
  const isEnabled = branch.isEnabled !== false; // Default to enabled

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-6">
      {/* Header with Main Badge */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{branch.name}</h3>
          {branch.isMain && (
            <span className="inline-block mt-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
              Main Branch
            </span>
          )}
        </div>
        {/* Status Badge */}
        <div className={`px-2 py-1 rounded text-xs font-semibold ${
          isEnabled
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-800"
        }`}>
          {isEnabled ? "Active" : "Disabled"}
        </div>
      </div>

      {/* Branch Details */}
      <div className="space-y-2 text-sm text-gray-600 mb-6">
        {branch.address && (
          <p>
            <span className="font-medium">Address:</span> {branch.address}
          </p>
        )}
        {branch.phone && (
          <p>
            <span className="font-medium">Phone:</span> {branch.phone}
          </p>
        )}
        <p>
          <span className="font-medium">Employees:</span> {branch.employeeCount}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-2 rounded transition-colors"
        >
          <Edit2 size={16} />
          Edit
        </button>
        <button
          onClick={onToggle}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded transition-colors ${
            isEnabled
              ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
              : "bg-green-50 text-green-600 hover:bg-green-100"
          }`}
        >
          <Power size={16} />
          {isEnabled ? "Disable" : "Enable"}
        </button>
      </div>
    </div>
  );
}

/**
 * Branch Form Component (Create/Edit)
 */
interface BranchFormProps {
  branch: Branch | null;
  onClose: () => void;
  onSave: () => void;
}

function BranchForm({ branch, onClose, onSave }: BranchFormProps) {
  const [formData, setFormData] = useState({
    name: branch?.name || "",
    address: branch?.address || "",
    phone: branch?.phone || "",
    isMain: branch?.isMain || false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const method = branch ? "PATCH" : "POST";
      const url = branch ? `/api/branches/${branch.id}` : "/api/branches";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error("Failed to save branch");
      }

      await onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {branch ? "Edit Branch" : "Create New Branch"}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Branch Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Main Branch Checkbox */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isMain}
                  onChange={(e) =>
                    setFormData({ ...formData, isMain: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Set as main branch</span>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Branch"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/**
 * API Handler for branch toggle
 * Location: app/api/branches/[id]/toggle/route.ts
 */
export async function toggleBranchStatus(branchId: string, enable: boolean) {
  try {
    const response = await fetch(`/api/branches/${branchId}/toggle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: enable }),
    });

    if (!response.ok) {
      throw new Error("Failed to toggle branch status");
    }

    return await response.json();
  } catch (error) {
    console.error("Error toggling branch:", error);
    throw error;
  }
}

/**
 * Example API Route (app/api/branches/[id]/toggle/route.ts)
 * 
 * import { NextRequest, NextResponse } from "next/server";
 * import { withAuth } from "@/lib/api-auth";
 * import { db } from "@/lib/db";
 * 
 * export const PATCH = withAuth(async (req, authContext) => {
 *   // Only owner can toggle branch status
 *   if (authContext.role !== "OWNER") {
 *     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 *   }
 * 
 *   const { id } = await req.json();
 *   const body = await req.json();
 * 
 *   // Update branch
 *   const branch = await db.branch.update({
 *     where: { id, businessId: authContext.businessId },
 *     data: { isEnabled: body.isEnabled },
 *   });
 * 
 *   return NextResponse.json(branch);
 * });
 */
