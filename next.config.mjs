/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 15: top-level key (was experimental.serverComponentsExternalPackages in v14)
  // This tells webpack NOT to bundle pdf-parse, letting Node.js require() it natively.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
