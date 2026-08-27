import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits a self-contained server with only the modules it actually uses,
  // which is what the Docker image ships. The song library is deliberately
  // left out of the bundle — it comes from a mounted volume at runtime.
  output: "standalone",
};

export default nextConfig;
