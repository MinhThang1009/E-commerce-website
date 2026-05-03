import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
    exclude: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@components': path.resolve(__dirname, './src/components'),
      '@config': path.resolve(__dirname, './src/config'),
      '@constants': path.resolve(__dirname, './src/constants'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@features': path.resolve(__dirname, './src/features'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@styles': path.resolve(__dirname, './src/styles'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
    },
  },
  server: {
    port: 5175,
    strictPort: false, // Cho phép tìm cổng khác nếu 5175 đã được sử dụng
    proxy: {
      // Proxy API requests to avoid CORS issues
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8888',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'unsafe-none',
    },
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
    },
  },
});
