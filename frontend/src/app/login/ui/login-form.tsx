"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { User, Lock, Shield } from "lucide-react";

import { api } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  secureSession: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const [formError, setFormError] = React.useState<string | null>(null);
  const searchParams = useSearchParams();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "", secureSession: false },
  });

  const onSubmit = React.useCallback(async (values: FormValues) => {
    try {
      setFormError(null);
      const res = await api.post("/auth/login", values);
      const data = res.data?.data;
      if (!data?.username || !data?.userId) throw new Error("Login failed");

      toast.success("Signed in");

      const rawNext = searchParams?.get("next");
      const safeNext = rawNext && rawNext.startsWith("/") ? rawNext : null;
      window.location.href = safeNext ?? "/dashboard";
    } catch (err: any) {
      const message =
        (err?.response?.data?.error?.message as string | undefined) ||
        (err?.message as string | undefined) ||
        "Login failed";
      setFormError(message);
      toast.error(message);
    }
  }, [searchParams]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">Administrator Login</h1>
        <p className="text-sm text-slate-600">Access the secure asset management dashboard.</p>
      </div>

      {/* Form */}
      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        {/* Username Field */}
        <div className="space-y-2">
          <Label htmlFor="username" className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Username
          </Label>
          <div className="relative">
            <Input
              id="username"
              autoComplete="username"
              placeholder="Admin username"
              className="h-12 pl-4 pr-10 text-base border-slate-200 focus:border-slate-400 focus:ring-slate-400"
              {...register("username")}
            />
            <User className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          </div>
          {errors.username ? <div className="text-xs text-red-600">{errors.username.message}</div> : null}
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
            Password
          </Label>
          <div className="relative">
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter password"
              className="h-12 pl-4 pr-10 text-base border-slate-200 focus:border-slate-400 focus:ring-slate-400"
              {...register("password")}
            />
            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          </div>
          {errors.password ? <div className="text-xs text-red-600">{errors.password.message}</div> : null}
        </div>

        {/* Secure Session & Reset Password */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="secureSession"
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
              {...register("secureSession")}
            />
            <label htmlFor="secureSession" className="text-sm text-slate-700 cursor-pointer">
              Secure session
            </label>
          </div>
          <button type="button" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            Reset Password
          </button>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-base shadow-lg shadow-emerald-500/30 transition-all"
        >
          {isSubmitting ? "Signing in..." : "Sign In to Infrastructure"}
        </Button>

        {/* Error Message */}
        {formError ? (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {formError}
          </div>
        ) : null}

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-2 pt-4">
          <Shield className="h-4 w-4 text-slate-400" />
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Tier 4 Encrypted Connection
          </span>
        </div>
      </form>
    </div>
  );
}
