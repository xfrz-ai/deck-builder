import type { NextConfig } from "next";
import path from "node:path";

const emptyNodeModule = path.resolve(
  process.cwd(),
  "lib/export/empty-node-module.ts",
);

const nextConfig: NextConfig = {
  // Fully client-side app: emit static HTML/JS to `out/` and serve it via
  // Cloudflare Workers Static Assets (see wrangler.jsonc).
  output: "export",
  turbopack: {
    resolveAlias: {
      "node:fs": {
        browser: "./lib/export/empty-node-module.ts",
      },
      "node:https": {
        browser: "./lib/export/empty-node-module.ts",
      },
    },
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "node:fs": emptyNodeModule,
        "node:https": emptyNodeModule,
      };
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:(fs|https)$/,
          emptyNodeModule,
        ),
      );
    }

    return config;
  },
};

export default nextConfig;
