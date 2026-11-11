import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Marketing pages stay prerendered (static). Academy pages and API routes opt
// into on-demand rendering with `export const prerender = false`.
export default defineConfig({
  output: 'static',
  adapter: vercel(),
  integrations: [react()],
  security: {
    // Reject cross-site form POSTs to on-demand routes (CSRF protection).
    checkOrigin: true,
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      host: true,
      strictPort: true,
    },
  },
});
