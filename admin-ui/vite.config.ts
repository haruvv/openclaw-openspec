import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: new URL(".", import.meta.url).pathname,
  base: "/admin/",
  plugins: [react()],
  build: {
    outDir: "../dist/admin-ui",
    emptyOutDir: true,
  },
});
