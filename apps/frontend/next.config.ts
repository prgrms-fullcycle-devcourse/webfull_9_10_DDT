import { withSentryConfig } from '@sentry/nextjs';
import withPWAInit from '@ducanh2912/next-pwa';
import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['ddt-test.ddns.net', 'ddt-test.ddns.net:3000'],
  turbopack: {
    root: path.resolve(process.cwd(), '../..'),
  },
};

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    disableDevLogs: true,
  },
});

export default withSentryConfig(withPWA(nextConfig), {
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
