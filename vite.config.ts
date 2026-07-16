import { defineConfig } from "vite";

// Deployed as a GitHub Pages project site: https://gatherloop.github.io/game-master-bell-receiver/
const pagesBase = "/game-master-bell-receiver/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? pagesBase : "/",
}));
