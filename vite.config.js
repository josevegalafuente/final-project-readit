import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        search: resolve(__dirname, "search/index.html"),
        library: resolve(__dirname, "library/index.html"),
        readingPlan: resolve(__dirname, "reading-plan/index.html"),
        notes: resolve(__dirname, "notes/index.html"),
      },
    },
  },
});