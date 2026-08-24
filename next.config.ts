import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so a lockfile further up the tree is not picked up.
  turbopack: { root: path.resolve(".") },
  // Two `next dev` instances cannot share one build directory, so allow a
  // second one to be pointed elsewhere via the environment.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The floating dev badge sits on top of the state panel's readout.
  devIndicators: false,
  agentRules: false,
};

export default nextConfig;
