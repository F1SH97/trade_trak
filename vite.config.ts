import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the built app can be served from any sub-path
  // (S3 folder, GitHub Pages project site, internal portal, etc.).
  base: './',
})
