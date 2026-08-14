import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ensure Turbopack/Next resolves and transpiles our workspace SDK
  // (workspace package imports aren't always resolved by the bundler otherwise)
  // `transpilePackages` may not exist on older Next types, but it's supported at runtime.
  // Cast on export to keep typing compatible.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  transpilePackages: ["@receiptor/sdk"],
};

export default nextConfig;
