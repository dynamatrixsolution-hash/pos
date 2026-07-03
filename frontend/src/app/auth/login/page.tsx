"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";

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
        setAuthError(res?.error || "Login failed. Please verify your credentials.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setAuthError("A connection error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6">
        {/* Branding header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Welcome to DynaPOS</h1>
          <p className="text-xs text-muted-foreground">
            Enter your credentials below to log into your sales terminal.
          </p>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            {errors.email && (
              <span className="text-[10px] text-destructive font-semibold">{errors.email.message}</span>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...register("password")}
              className={`w-full px-3.5 py-2 border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 ${
                errors.password ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"
              }`}
            />
            {errors.password && (
              <span className="text-[10px] text-destructive font-semibold">{errors.password.message}</span>
            )}
          </div>

          {authError && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg font-semibold leading-tight">
              {authError}
            </div>
          )}

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
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-xs">Loading sales portal...</div>}>
      <LoginForm />
    </React.Suspense>
  );
}
