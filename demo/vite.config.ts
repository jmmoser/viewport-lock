import { defineConfig } from "vite";

export default defineConfig({
  root: __dirname,
  base: "/viewport-lock/",
  build: {
    outDir: "../dist-demo",
    emptyOutDir: true,
  },
});
