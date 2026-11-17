import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // garden-ui ships raw TypeScript (no build step), so Next compiles it for us.
  transpilePackages: ["@birthday-garden/garden-ui"],
  // The dev-only "N" indicator sits bottom-left, exactly where our zoom/sound
  // controls live. Build errors still show as an overlay when they happen.
  devIndicators: false,
};

export default nextConfig;
