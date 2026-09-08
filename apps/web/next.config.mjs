process.loadEnvFile(new URL("../../.env", import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@gazete/db"]
};

export default nextConfig;
