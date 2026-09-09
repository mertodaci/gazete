try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // .env not present (e.g. a clean clone or a Docker build, where real env vars
  // are injected at runtime) — ignore rather than failing the build.
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@gazete/db"]
};

export default nextConfig;
