/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the call API, e.g. "https://bell-api.gatherloop.id" (no trailing slash). */
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
