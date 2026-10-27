import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base 用相对路径，GitHub Pages 项目站（/仓库名/）与本地预览都能正常工作
export default defineConfig({
  base: "./",
  plugins: [react()],
});
