import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    proxy: {
      "/api": {
        target: "http://54.206.224.166",
        changeOrigin: true,
      },
    },
  },
});