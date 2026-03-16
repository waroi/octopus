import { config } from "dotenv";
import path from "path";
import type { NextConfig } from "next";

config({ path: path.resolve(__dirname, "../../.env") });

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@octopus/db"],
  env: {
    NEXT_PUBLIC_BUILD_ID: Date.now().toString(),
  },
};

export default nextConfig;
