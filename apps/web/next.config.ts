import type { NextConfig } from "next";

const nextConfig: NextConfig = {
   transpilePackages: ["@tma-game/shared"],
   allowedDevOrigins: ["concrete-piglet-correctly.ngrok-free.app", 'game.nexuz.space', 'ws.game.nexuz.space'],
};

export default nextConfig;
