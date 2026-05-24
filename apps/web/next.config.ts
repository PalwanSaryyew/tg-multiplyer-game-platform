import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   transpilePackages: ["@tma-game/shared"],
   allowedDevOrigins: ["concrete-piglet-correctly.ngrok-free.app"],
};

export default nextConfig;
