"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSession } from "next-auth/react";
import { User, Phone, Mail, Lock, Shield, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const profileFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional().nullable().or(z.literal("")),
  password: z.string().optional().or(z.literal("")),
  confirmPassword: z.string().optional().or(z.literal("")),
}).refine((data) => {
  if (data.password && data.password.length > 0) {
    return data.password.length >= 6;
  }
  return true;
}, {
  message: "Password must be at least 6 characters",
  path: ["password"],
}).refine((data) => {
  if (data.password && data.password.length > 0) {
    return data.password === data.confirmPassword;
  }
  return true;
}, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ProfileInputs = z.infer<typeof profileFormSchema>;

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [userRole, setUserRole] = React.useState<string>("CASHIER");
  const [userEmail, setUserEmail] = React.useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<ProfileInputs>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
  });

  const loadProfile = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/users/profile");
      if (res.ok) {
        const data = await res.json();
        setValue("name", data.name);
        setValue("phone", data.phone || "");
        setUserEmail(data.email);
        setUserRole(data.role);
      } else {
        setErrorMsg("Failed to load user profile details.");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Error connecting to server.");
    } finally {
      setLoading(false);
    }
  }, [setValue]);

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onSubmit = async (data: ProfileInputs) => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/v1/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone || null,
          password: data.password || null,
        }),
      });

      if (res.ok) {
        const updatedUser = await res.json();
        setSuccessMsg("Profile settings updated successfully!");
        
        // Clear password fields
        setValue("password", "");
        setValue("confirmPassword", "");
        
        // Sync name change to active session state instantly
        await update({
          name: updatedUser.name,
        });
      } else {
        const errJson = await res.json();
        setErrorMsg(errJson.error || "Failed to update profile settings.");
      }
    } catch (err) {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground select-none">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-xs font-bold uppercase tracking-wider">Loading Profile Settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Page Header */}
      <div className="bg-card border border-border p-5 rounded-2xl flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-extrabold text-lg shadow-sm">
          {session?.user?.name ? session.user.name.slice(0, 2).toUpperCase() : "ME"}
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">My Profile Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your personal profile information, account credentials, and passwords.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Status Feedback */}
          {successMsg && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/40 p-3.5 rounded-xl font-semibold leading-tight animate-in fade-in duration-200">
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
              {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 p-3.5 rounded-xl font-semibold leading-tight animate-in fade-in duration-200">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Form Content */}
          <div className="space-y-4">
            {/* Row 1: Full Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                  <input
                    type="text"
                    {...register("name")}
                    className={`w-full h-10 pl-10 pr-3.5 border rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all ${
                      errors.name ? "border-destructive focus:ring-destructive" : "border-border/80 focus:border-primary"
                    }`}
                  />
                </div>
                {errors.name && (
                  <span className="text-[10px] text-destructive font-semibold">{errors.name.message}</span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                  Email Address (Read-only)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/40" />
                  <input
                    type="email"
                    value={userEmail}
                    disabled
                    className="w-full h-10 pl-10 pr-3.5 border border-border/40 rounded-xl text-xs bg-muted/30 text-muted-foreground cursor-not-allowed focus:outline-none select-none"
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Phone & Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                  <input
                    type="text"
                    placeholder="e.g. +1-555-0199"
                    {...register("phone")}
                    className="w-full h-10 pl-10 pr-3.5 border border-border/80 rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                  Account Role (Read-only)
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/40" />
                  <input
                    type="text"
                    value={userRole}
                    disabled
                    className="w-full h-10 pl-10 pr-3.5 border border-border/40 rounded-xl text-xs bg-muted/30 text-muted-foreground font-bold cursor-not-allowed focus:outline-none select-none"
                  />
                </div>
              </div>
            </div>

            <hr className="border-border/60 my-6" />

            {/* Password Section */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-[#2563EB] uppercase tracking-wider">Change Password</h3>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Leave these fields blank if you do not wish to update your password credentials.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      {...register("password")}
                      className={`w-full h-10 pl-10 pr-3.5 border rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all ${
                        errors.password ? "border-destructive focus:ring-destructive" : "border-border/80 focus:border-primary"
                      }`}
                    />
                  </div>
                  {errors.password && (
                    <span className="text-[10px] text-destructive font-semibold">{errors.password.message}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/60" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      {...register("confirmPassword")}
                      className={`w-full h-10 pl-10 pr-3.5 border rounded-xl text-xs bg-background focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all ${
                        errors.confirmPassword ? "border-destructive focus:ring-destructive" : "border-border/80 focus:border-primary"
                      }`}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <span className="text-[10px] text-destructive font-semibold">{errors.confirmPassword.message}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
            <button
              type="button"
              onClick={() => {
                loadProfile();
                setValue("password", "");
                setValue("confirmPassword", "");
                setSuccessMsg(null);
                setErrorMsg(null);
              }}
              className="h-10 px-5 border border-border text-xs font-semibold rounded-xl hover:bg-secondary transition-colors cursor-pointer"
            >
              Reset Fields
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-6 bg-primary text-primary-foreground text-xs font-black rounded-xl hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
