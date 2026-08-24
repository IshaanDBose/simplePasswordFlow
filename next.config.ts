import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so a lockfile further up the tree is not picked up.
  turbopack: { root: path.resolve(".") },
  // The floating dev badge sits on top of the state panel's readout.
  devIndicators: false,
  agentRules: false,
};

export default nextConfig;
