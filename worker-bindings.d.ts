// The Vite app uses DOM Request/Response; keep the asset binding compatible with those types.
type D1Database = import("./worker-runtime").D1Database;
interface Fetcher { fetch(request: Request): Promise<Response>; }
declare module "cloudflare:workers" {
  export const env: { DB: import("./worker-runtime").D1Database; [key:string]:unknown };
}
