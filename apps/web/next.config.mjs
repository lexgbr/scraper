const nextConfig = {
  reactStrictMode: true,
  experimental: { externalDir: true },
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',
};
export default nextConfig;
