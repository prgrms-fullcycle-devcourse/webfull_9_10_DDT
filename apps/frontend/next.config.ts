import { withSentryConfig } from '@sentry/nextjs';
import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd(), '../..'),
  },
};

export default withSentryConfig(nextConfig, {
  org: 'hyspark',
  project: 'ddt-nextjs',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  webpack: {
    automaticVercelMonitors: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});