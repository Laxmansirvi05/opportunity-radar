import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@reactive-resume/config",
    "@reactive-resume/utils",
    "@reactive-resume/schema",
    "@reactive-resume/resume",
    "@reactive-resume/fonts",
    "@reactive-resume/pdf",
    "@reactive-resume/ui"
  ]
};

export default nextConfig;
