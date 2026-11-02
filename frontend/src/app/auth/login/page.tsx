"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { clearCaches } from "@/lib/cache-utils";
import { Notify } from "@/lib/notify";

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
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInputs>({
    resolver: zodResolver(loginSchema),
  });

  React.useEffect(() => {
    clearCaches();
  }, []);

  React.useEffect(() => {
    if (errorParam === "CredentialsSignin") {
      Notify.failure("Invalid email or password. Please verify your credentials.");
    }
  }, [errorParam]);

  const getDeviceId = () => {
    if (typeof window === "undefined") return "";
    let deviceId = localStorage.getItem("dyna_device_id");
    if (!deviceId) {
      deviceId =
        typeof crypto.randomUUID === "function"
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

    try {
      const deviceId = getDeviceId();
      const deviceName = getDeviceName();

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
          Notify.failure(
            checkData.message ||
              "Unauthorized device. This account is locked to another terminal. Please contact your administrator."
          );
          setIsLoading(false);
          return;
        }
      }

      const res = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (!res || res.error) {
        const errorMsg =
          res?.error === "Configuration"
            ? "Server Configuration Error: The authentication secret is invalid."
            : res?.error || "Login failed. Please verify your credentials.";
        Notify.failure(errorMsg);
        setIsLoading(false);
      } else {
        Notify.success("Login successful. Opening sales terminal...");
        window.location.href = "/dashboard";
      }
    } catch {
      Notify.failure("A connection error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const onInvalid = (formErrors: typeof errors) => {
    const firstError = Object.values(formErrors)[0]?.message;
    if (firstError) {
      Notify.warning(firstError);
    }
  };

  const handleQuickFill = (email: string) => {
    setValue("email", email);
    setValue("password", "Password123!");
    Notify.info(`Autofilled demo credentials for ${email}`);
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex items-center justify-center bg-[#F2EDE4] p-1.5 sm:p-2.5 md:p-3.5 select-none">
      {/* Outer Enclosed Layout Card with increased height and clear border decoration */}
      <div className="w-full max-w-[1440px] h-[calc(100vh-14px)] sm:h-[calc(100vh-20px)] md:h-[calc(100vh-28px)] max-h-[1020px] bg-[#FAF8F5] rounded-xl sm:rounded-2xl border border-[#D5CEC2] shadow-sm flex flex-col md:flex-row overflow-hidden">
        
        {/* ======================================================== */}
        {/* LEFT CONTAINER: ZERO-CLIPPING HERO POSTER                */}
        {/* Aspect ratio container ensures zero top/bottom logo crop */}
        {/* ======================================================== */}
        <div className="hidden md:flex h-full aspect-[611/640] max-w-[56%] shrink-0 relative bg-[#1B1512] border-r border-[#D5CEC2] overflow-hidden items-center justify-center">
          <img
            src="/assets/desktop-hero.png"
            alt="RestroInn - Good service starts here. Your restaurant. Your hotel. One place."
            className="w-full h-full object-cover block"
          />
        </div>

        {/* Mobile top image banner */}
        <div className="block md:hidden w-full h-44 sm:h-52 relative bg-[#1B1512] shrink-0 border-b border-[#D5CEC2]">
          <img
            src="/assets/desktop-hero.png"
            alt="RestroInn - Good service starts here"
            className="w-full h-full object-cover object-top block"
          />
        </div>

        {/* ======================================================== */}
        {/* RIGHT CONTAINER: BOLD, HIGH-LEGIBILITY AUTHENTICATION    */}
        {/* ======================================================== */}
        <div className="flex-1 h-full flex flex-col justify-between bg-[#FAF8F5] px-6 sm:px-10 lg:px-14 xl:px-16 py-5 sm:py-7 lg:py-8 overflow-y-auto">
          {/* Top Right Header Link */}
          <div className="flex justify-end items-center gap-2 text-sm sm:text-base font-medium">
            <span className="text-[#6D635C]">New to RestroInn?</span>
            <Link
              href="/auth/register"
              className="text-[#6A2635] font-bold hover:underline inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Create workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Center Main Login Section */}
          <div className="w-full max-w-[440px] mx-auto my-auto py-2 sm:py-4 space-y-5 sm:space-y-6">
            <div className="space-y-1.5 sm:space-y-2">
              <span className="text-xs sm:text-[13px] font-bold tracking-[0.2em] uppercase text-[#6A2635] block">
                WELCOME BACK
              </span>
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-[#140F0C] leading-[1.08]">
                Sign in to RestroInn
              </h1>
              <p className="text-base sm:text-lg text-[#61574F] font-normal pt-0.5">
                A little less admin. More hospitality.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4 pt-1">
              {/* Email Address with clean inline validation */}
              <div className="space-y-1.5">
                <label className="text-sm sm:text-[15px] font-bold text-[#1F1915] block">
                  Email address
                </label>
                <input
                  type="email"
                  placeholder="you@yourbusiness.com"
                  {...register("email")}
                  className={`w-full px-4 py-3 sm:py-3.5 bg-white border rounded-lg text-base sm:text-[17px] font-medium text-[#1F1915] placeholder:text-[#9E938B] focus:outline-none focus:border-[#6A2635] focus:ring-2 focus:ring-[#6A2635]/25 transition-all ${
                    errors.email ? "border-[#B33432]" : "border-[#CDC4B7]"
                  }`}
                />
                {errors.email && (
                  <span className="text-xs sm:text-sm text-[#B33432] font-bold block">
                    {errors.email.message}
                  </span>
                )}
              </div>

              {/* Password with clean inline validation */}
              <div className="space-y-1.5">
                <label className="text-sm sm:text-[15px] font-bold text-[#1F1915] block">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    {...register("password")}
                    className={`w-full pl-4 pr-12 py-3 sm:py-3.5 bg-white border rounded-lg text-base sm:text-[17px] font-medium text-[#1F1915] placeholder:text-[#9E938B] focus:outline-none focus:border-[#6A2635] focus:ring-2 focus:ring-[#6A2635]/25 transition-all ${
                      errors.password ? "border-[#B33432]" : "border-[#CDC4B7]"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7A6E66] hover:text-[#1F1915] cursor-pointer select-none transition-colors p-1"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && (
                  <span className="text-xs sm:text-sm text-[#B33432] font-bold block">
                    {errors.password.message}
                  </span>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 sm:h-13 px-5 rounded-lg bg-[#6A2635] hover:bg-[#521C28] text-white text-base sm:text-[17px] font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm disabled:opacity-50 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>

            {/* Subtext & Quick Demo Login */}
            <div className="pt-1 text-center text-sm sm:text-[15px] text-[#61574F] space-y-2">
              <p>
                Need access?{" "}
                <a href="mailto:support@restroinn.com" className="text-[#6A2635] hover:underline font-bold">
                  Contact your administrator.
                </a>
              </p>

              <div className="pt-1 flex items-center justify-center gap-2.5 text-sm text-[#8C8074]">
                <span>Demo login:</span>
                <button
                  type="button"
                  onClick={() => handleQuickFill("superadmin@restroinn.com")}
                  className="text-[#6A2635] hover:underline font-bold cursor-pointer"
                >
                  Super Admin
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => handleQuickFill("owner@restroinn.com")}
                  className="text-[#6A2635] hover:underline font-bold cursor-pointer"
                >
                  Owner
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => handleQuickFill("cashier@restroinn.com")}
                  className="text-[#6A2635] hover:underline font-bold cursor-pointer"
                >
                  Cashier
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Footer Note */}
          <div className="text-center text-xs sm:text-sm text-[#8C8074] pt-2">
            RestroInn • Hotel & restaurant software
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#FAF8F5] p-6 text-[#1F1915]">
          <div className="w-72 space-y-3">
            <div className="h-10 bg-[#EEE7DD] rounded-md animate-pulse" />
            <div className="h-44 bg-[#FFFCF7] border border-[#DDD4C7] rounded-md animate-pulse" />
          </div>
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
