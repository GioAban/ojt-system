import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Offline: nakatabi ang app (hindi ang datos ng API). VITE_PWA_DISABLED=true sa build = service worker
    // na nag-aalis sa sarili (pangalawang kill switch, bukod sa APP_SW_ENABLED sa server).
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      selfDestroying: process.env.VITE_PWA_DISABLED === "true",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "OJT System · Urdaneta City University",
        short_name: "OJT System",
        description: "OJT and practicum management for students and coordinators.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#ffffff",
        icons: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,webmanifest}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: "/index.html",
        // Hindi kailanman sinasagot ng service worker ang API (maliban sa logo ng college sa ibaba)
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/api\/public\/colleges\/\d+\/logo$/.test(url.pathname),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "college-logos", expiration: { maxEntries: 50 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
