import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
// Type generation only: deployment configuration remains in Vite / Sites.
mkdirSync('.sites-runtime',{recursive:true});
writeFileSync('.sites-runtime/types-config.json',JSON.stringify({name:'namma-mallige-types',compatibility_date:'2026-04-01',compatibility_flags:['nodejs_compat']}));
execFileSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','types','worker-runtime.d.ts','--config','.sites-runtime/types-config.json','--include-env','false'],{stdio:'inherit'});
const runtime=readFileSync('worker-runtime.d.ts','utf8').replace("declare module 'cloudflare:workers' {\n    export = CloudflareWorkersModule;\n}","// The application-facing Worker module is declared in worker-bindings.d.ts.");
// Keep Worker web globals module-scoped: client components use DOM types.
writeFileSync('worker-runtime.d.ts','export {};\n'+runtime+'\nexport type { D1Database };\n');
