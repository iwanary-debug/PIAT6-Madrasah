import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    // Hostname preview dikonfigurasi melalui variabel lingkungan, bukan ditulis pada berkas proyek.
    allowedHosts: (process.env.VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean),
    proxy: {
      // changeOrigin harus false: Worker memverifikasi bahwa header Origin sama dengan Host permintaan
      // (proteksi CSRF). Bila Host ditulis ulang menjadi 127.0.0.1:8787, seluruh permintaan tulis
      // (POST/PUT/DELETE) akan ditolak 403 saat aplikasi diakses melalui hostname preview.
      '/api': { target: 'http://127.0.0.1:8787', changeOrigin: false }
    }
  },
  build: { outDir: 'dist', emptyOutDir: true }
})
