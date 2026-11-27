import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({command}) => {
  const autoPlatformDomain = (
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    ''
  )
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  const configuredSiteOrigin = autoPlatformDomain
    ? `https://${autoPlatformDomain}`
    : 'https://shansusdzar.vercel.app';

  const commitPrefix = (process.env.VERCEL_GIT_COMMIT_SHA || '').trim().slice(0, 8);
  const appBuildId =
    command === 'build'
      ? `${commitPrefix || 'b'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      : 'dev';

  return {
    define: {
      __APP_BUILD_ID__: JSON.stringify(appBuildId),
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'inject-canonical-site-origin-and-build-id',
        transformIndexHtml(html: string) {
          return html
            .replaceAll('https://shansusdzar.vercel.app', configuredSiteOrigin)
            .replace(
              '</head>',
              `    <meta name="app-build-version" content="${appBuildId}" />\n  </head>`
            );
        },
      },
      // Copies src/assets into dist/ and writes per-deploy version.json + stamped sw.js
      {
        name: 'stamp-deploy-version-and-copy-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          if (!fs.existsSync(distDir)) {
            return;
          }

          const srcAssets = path.resolve(import.meta.dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }

          fs.writeFileSync(
            path.resolve(distDir, 'version.json'),
            JSON.stringify({buildId: appBuildId, builtAt: new Date().toISOString()}),
            'utf8'
          );

          const distSwPath = path.resolve(distDir, 'sw.js');
          if (fs.existsSync(distSwPath)) {
            const rawSw = fs.readFileSync(distSwPath, 'utf8');
            const stampedSw = rawSw.replaceAll('__SHANSUSDZAR_BUILD_ID__', appBuildId);
            fs.writeFileSync(distSwPath, stampedSw, 'utf8');
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': import.meta.dirname,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/three')) {
              return 'vendor-three';
            }
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router')
            ) {
              return 'vendor-react';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
