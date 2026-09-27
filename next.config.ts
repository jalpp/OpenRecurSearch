import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Mastra and the search SDKs as native Node dependencies on the server.
  serverExternalPackages: ["@mastra/*", "@tavily/core", "exa-js"],
};

export default nextConfig;
