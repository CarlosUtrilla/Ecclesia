// electron.vite.config.ts
import { resolve } from "path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import Pages from "vite-plugin-pages";
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: "electron/main/index.ts"
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: "electron/preload/index.ts"
      }
    }
  },
  renderer: {
    root: resolve("app"),
    resolve: {
      alias: {
        "@": resolve("app"),
        "@api": resolve("./database/api.ts"),
        "@queries": resolve("./queries")
      }
    },
    plugins: [
      react(),
      tailwindcss(),
      Pages({
        dirs: resolve("app/routes"),
        extensions: ["tsx", "ts"]
      })
    ],
    build: {
      rollupOptions: {
        input: {
          index: resolve("app/index.html")
        }
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
