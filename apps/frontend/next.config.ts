import { withSentryConfig } from '@sentry/nextjs';
import withPWAInit from '@ducanh2912/next-pwa';
import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd(), '../..'),
  },
};

const withPWA = withPWAInit({
  dest: 'public',
  register: false, 
  customWorkerSrc: 'worker',
  customWorkerDest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: false,
  workboxOptions: {
    disableDevLogs: true,
  },
});

export default withPWA(
  withSentryConfig(nextConfig, {
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
  })
);