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
    // Disabled: on Vercel, Astro compares against the function's internal URL
    // and rejects same-site forms. CSRF is enforced in src/middleware.ts instead,
    // using the Host the browser actually requested.
    checkOrigin: false,
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      host: true,
      strictPort: true,
    },
  },
});
