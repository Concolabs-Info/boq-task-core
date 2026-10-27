import path from "node:path";

import type { NextConfig } from "next";

// Settings live in the repo root .env, shared with the backend and the agent runtime.
try {
  process.loadEnvFile(path.join(process.cwd(), "..", ".env"));
} catch {
  // No .env yet: the defaults below are used.
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Do not write AGENTS.md or CLAUDE.md into this folder on dev start.
  agentRules: false,
  devIndicators: { position: "bottom-right" },
  turbopack: { root: process.cwd() },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000",
  },
};

export default nextConfig;
