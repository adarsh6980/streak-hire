/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produces a minimal, self-contained server bundle at .next/standalone
  // (its own tiny server.js + only the node_modules files actually traced
  // as used) — the standard Next.js pattern for deploying to a plain Node
  // host like Azure App Service without shipping the full node_modules
  // tree. public/ and .next/static are NOT included automatically; the
  // deploy packaging step copies them in alongside the standalone output.
  output: "standalone",
};

export default nextConfig;
