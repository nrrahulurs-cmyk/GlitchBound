import { defineConfig } from 'vite';

export default defineConfig({
  // Serve native modules in development; avoids a costly extra optimization
  // pass and works inside restricted local filesystem environments.
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'], physics: ['cannon-es'] } } } },
});
