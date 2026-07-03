"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";

const registerSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  slug: z.string().min(3, "Slug must be at least 3 characters").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  currency: z.string().min(1, "Currency is required"),
  ownerName: z.string().min(2, "Your name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type RegisterInputs = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterInputs>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      currency: "USD",
    },
  });

  const businessName = watch("businessName");

  // Auto-generate slug from business name
  React.useEffect(() => {
    if (businessName) {
      const suggestedSlug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, "") // remove invalid chars
        .replace(/\s+/g, "-") // collapse whitespace
        .replace(/-+/g, "-"); // collapse dashes
      setValue("slug", suggestedSlug);
    }
  }, [businessName, setValue]);

  const onSubmit = async (data: RegisterInputs) => {
    setIsLoading(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        setSubmitError(json.error || "Failed to register business workspace.");
      } else {
        setIsSuccess(true);
        setTimeout(() => {
          router.push("/auth/login?success=registered");
        }, 2000);
      }
    } catch (err) {
      setSubmitError("A connection error occurred. Please verify your network.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Create your DynaPOS Workspace</h1>
          <p className="text-xs text-muted-foreground">
            Set up your multi-tenant business registry and administrator account.
          </p>
        </div>

        {isSuccess ? (
          <div className="bg-primary/10 border border-primary/20 text-primary text-center p-6 rounded-xl space-y-2">
            <h3 className="font-bold text-sm">Registration Complete!</h3>
            <p className="text-xs">Your workspace was successfully created. Redirecting to terminal sign in...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Business Name
                </label>
                <input
                  type="text"
                  placeholder="Acme Stores Inc."
                  {...register("businessName")}
                  className={`w-full px-3.5 py-2 border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 ${
                    errors.businessName ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"
                  }`}
                />
                {errors.businessName && (
                  <span className="text-[10px] text-destructive font-semibold">{errors.businessName.message}</span>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Workspace URL Slug
                </label>
                <input
                  type="text"
                  placeholder="acme-stores"
                  {...register("slug")}
                  className={`w-full px-3.5 py-2 border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 ${
                    errors.slug ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"
                  }`}
                />
                {errors.slug && (
                  <span className="text-[10px] text-destructive font-semibold">{errors.slug.message}</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Base System Currency
              </label>
              <select
                {...register("currency")}
                className="w-full px-3 py-2 border border-border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="USD">USD ($) - United States Dollar</option>
                <option value="EUR">EUR (€) - Euro</option>
                <option value="GBP">GBP (£) - British Pound</option>
                <option value="INR">INR (₹) - Indian Rupee</option>
                <option value="AUD">AUD ($) - Australian Dollar</option>
              </select>
            </div>

            <div className="border-t border-border/50 pt-4 mt-2">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Owner Administrator Account
              </h3>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Alex Owner"
                    {...register("ownerName")}
                    className={`w-full px-3.5 py-2 border rounded-lg text-xs bg-background focus:outline-none focus:ring-1 ${
                      errors.ownerName ? "border-destructive focus:ring-destructive" : "border-border focus:ring-primary"
                    }`}
                  />
                  {errors.ownerName && (
                    <span className="text-[10px] text-destructive font-semibold">{errors.ownerName.message}</span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Email Address
                    </label>
                    <input
                      type="email"
                      placeholder="owner@company.com"
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
                </div>
              </div>
            </div>

            {submitError && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg font-semibold leading-tight">
                {submitError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-lg text-xs font-black shadow-lg shadow-primary/25 disabled:opacity-50 transition-all uppercase tracking-wider"
            >
              {isLoading ? "Provisioning..." : "Launch Workspace"}
            </button>
          </form>
        )}

        <div className="text-center text-xs text-muted-foreground border-t border-border/50 pt-4">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary hover:underline font-bold">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
