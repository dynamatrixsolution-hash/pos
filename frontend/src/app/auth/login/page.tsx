"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { ShoppingBag, Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginInputs = z.infer<typeof loginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [isLoading, setIsLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInputs>({
    resolver: zodResolver(loginSchema),
  });

  React.useEffect(() => {
    if (errorParam === "CredentialsSignin") {
      setAuthError("Invalid email or password. Please try again.");
    }
  }, [errorParam]);

  const getDeviceId = () => {
    if (typeof window === "undefined") return "";
    let deviceId = localStorage.getItem("dyna_device_id");
    if (!deviceId) {
      deviceId = typeof crypto.randomUUID === "function" 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("dyna_device_id", deviceId);
    }
    return deviceId;
  };

  const getDeviceName = () => {
    if (typeof window === "undefined") return "Web POS Terminal";
    const ua = navigator.userAgent;
    let browser = "Browser";
    if (ua.indexOf("Firefox") > -1) browser = "Firefox";
    else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
    else if (ua.indexOf("Safari") > -1) browser = "Safari";
    else if (ua.indexOf("Edge") > -1) browser = "Edge";
    
    let os = "OS";
    if (ua.indexOf("Windows") > -1) os = "Windows";
    else if (ua.indexOf("Mac") > -1) os = "Mac";
    else if (ua.indexOf("Linux") > -1) os = "Linux";
    else if (ua.indexOf("Android") > -1) os = "Android";
    else if (ua.indexOf("iPhone") > -1) os = "iOS";
    
    return `${browser} on ${os}`;
  };

  const onSubmit = async (data: LoginInputs) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const deviceId = getDeviceId();
      const deviceName = getDeviceName();

      // 1. Check device lock authorization
      const checkRes = await fetch("/api/v1/auth/device-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          deviceId,
          deviceName,
        }),
      });

      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.success === false) {
          setAuthError(checkData.message || "Unauthorized device. This account is locked to a different terminal/device. Please contact your system administrator.");
          setIsLoading(false);
          return;
        }
      }

      // 2. Perform credentials verification
      const res = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (!res || res.error) {
        const errorMsg = res?.error === "Configuration"
          ? "Server Configuration Error: The authentication secret (AUTH_SECRET) is missing or invalid on the server."
          : (res?.error || "Login failed. Please verify your credentials.");
        setAuthError(errorMsg);
      } else {
        window.location.href = "/dashboard";
      }
    } catch (err) {
      setAuthError("A connection error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const onInvalid = (formErrors: typeof errors) => {
    const firstError = Object.values(formErrors)[0]?.message;
    if (firstError) {
      setAuthError(firstError);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6">
        {/* Branding header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center overflow-hidden">
            <img src="/logo.jpg" alt="Prayassh Logo" className="h-12 w-12 rounded-xl object-contain shrink-0" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Welcome to Prayassh</h1>
          <p className="text-xs text-muted-foreground">
            Enter your credentials below to log into your sales terminal.
          </p>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@company.com"
              {...register("email")}
              className={`w-full px-3.5 py-2 border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 ${
                errors.email ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"
              }`}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                {...register("password")}
                className={`w-full pl-3.5 pr-10 py-2 border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 ${
                  errors.password ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:text-slate-500 cursor-pointer select-none"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-xs font-black shadow-lg shadow-primary/25 disabled:opacity-50 transition-all uppercase tracking-wider"
          >
            {isLoading ? "Signing in..." : "Access POS"}
          </button>
        </form>

        {/* Registration redirect */}
        <div className="text-center text-xs text-muted-foreground border-t border-border/50 pt-4">
          Need a DynaPOS workspace?{" "}
          <Link href="/auth/register" className="text-primary hover:underline font-bold">
            Create Business
          </Link>
        </div>
      </div>

      {/* Modal/Popup for Auth Error */}
      {authError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in px-4">
          <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 text-center space-y-4 animate-scale-up">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-black text-foreground uppercase tracking-wider">Authentication Error</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {authError}
              </p>
            </div>

            <button
              onClick={() => setAuthError(null)}
              className="w-full py-2 bg-destructive hover:bg-destructive/95 text-destructive-foreground rounded-lg text-xs font-black shadow-lg shadow-destructive/25 transition-all uppercase tracking-wider cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleUp {
              from { transform: scale(0.95); opacity: 0; }
              to { transform: scale(1); opacity: 1; }
            }
            .animate-fade-in {
              animation: fadeIn 0.15s ease-out forwards;
            }
            .animate-scale-up {
              animation: scaleUp 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense 
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-background">
          <div className="flex flex-col items-center space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">Loading sales portal...</p>
          </div>
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
