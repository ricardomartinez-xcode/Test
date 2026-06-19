import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  experimental: {},
  outputFileTracingRoot: projectRoot,
};

export default nextConfig;
