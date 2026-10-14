import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Flat project: every file sits in the repo root (no folders), so it can be uploaded to GitHub file-by-file.
export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [react()],
})
