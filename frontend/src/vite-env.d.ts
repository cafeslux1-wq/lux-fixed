/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL:      string;
  readonly VITE_BRANCH_ID:    string;
  readonly VITE_TENANT_ID:    string;
  readonly VITE_TENANT_SLUG:  string;
  readonly VITE_FRONTEND_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
