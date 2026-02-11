"use client";

import Image from "next/image";
import { Suspense } from "react";
import { LoginForm } from "@/app/login/ui/login-form";
import { motion } from "framer-motion";
import { Database } from "lucide-react";

import LoginLogo from "@/app/hlogo.png";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 via-slate-100 to-slate-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-3xl"
      >
        {/* Centered Card Container */}
        <div className="grid lg:grid-cols-2 gap-0 rounded-lg shadow-md overflow-hidden border border-slate-200 bg-white">
          
          {/* Left Side - Branding Section */}
          <div className="relative bg-linear-to-br from-emerald-50 via-green-50 to-lime-50 p-6 lg:p-8 flex flex-col justify-center overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute inset-0 bg-grid-emerald-300/[0.03] bg-size-[16px_16px]" />
            </div>

            <div className="relative z-10 space-y-6">
              {/* Logo & Brand */}
              <div className="flex items-center gap-2 justify-center lg:justify-start">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-200">
                  <Database className="h-4 w-4 text-emerald-600" />
                </div>
                <span className="text-base font-semibold text-emerald-800">ServerAssetManager</span>
              </div>

              {/* Main Content - Centered */}
              <div className="space-y-4 text-center lg:text-left">
                <h1 className="text-2xl lg:text-3xl font-bold text-emerald-900 leading-snug">
                  Secure
                  <br />
                  Infrastructure
                  <br />
                  Management
                </h1>
                <p className="text-sm text-emerald-700 leading-relaxed max-w-sm mx-auto lg:mx-0">
                  Optimize, monitor, and scale your enterprise server fleet with high-fidelity control.
                </p>
              </div>

              {/* Status Indicators - Centered on mobile */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 w-fit">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-emerald-800 font-medium">Cluster: Stable</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 border border-emerald-200 w-fit">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-emerald-800 font-medium">Network: Optimal</span>
                </div>
              </div>
            </div>

            {/* Footer - Centered */}
            <div className="relative z-10 text-emerald-600 text-xs mt-8 text-center lg:text-left">
              © 2026 Hormuud Telecom.
            </div>
          </div>

          {/* Right Side - Login Form */}
          <div className="p-6 lg:p-8 flex items-center justify-center bg-white">
            <div className="w-full max-w-xs space-y-5">
              {/* Logo for mobile - Centered */}
              <div className="lg:hidden flex justify-center mb-3">
                <Image
                  src={LoginLogo}
                  alt="Logo"
                  width={70}
                  height={25}
                  priority
                  className="object-contain w-17.5 h-6.25"
                />
              </div>

              {/* Login Form */}
              <Suspense fallback={<div className="text-center text-slate-500 text-xs">Loading...</div>}>
                <LoginForm />
              </Suspense>

              {/* Footer Links - Centered */}
              <div className="flex items-center justify-center gap-3 text-xs text-slate-500 pt-3 border-t border-slate-100">
                <a href="#" className="hover:text-slate-700 transition-colors">DOCS</a>
                <a href="#" className="hover:text-slate-700 transition-colors">POLICY</a>
                <a href="#" className="hover:text-slate-700 transition-colors">CONTACT</a>
              </div>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}