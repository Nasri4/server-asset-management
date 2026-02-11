import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // React Compiler can noticeably slow dev compiles on some machines.
  // Keep it opt-in via env var.
  reactCompiler: process.env.NEXT_REACT_COMPILER === "1",

  async rewrites() {
    const target =
      process.env.API_PROXY_TARGET?.trim() ||
      process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
      "http://localhost:5000";

    return [
      {
        source: "/api/:path*",
        destination: `${target}/api/:path*`,
      },
    ];
  },

  // Keep typechecking as an explicit script (`npm run typecheck`), not part of `next build`.
  // This makes builds faster and avoids “stuck compiling” on large TS passes.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
