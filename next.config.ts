import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typescript: {
    // Dangerously allow production builds to successfully complete 
    // even if your project has TypeScript errors.
    ignoreBuildErrors: true,
    
  },
  output: 'export',
};

export default nextConfig;
