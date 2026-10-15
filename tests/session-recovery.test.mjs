import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const output=await build({entryPoints:['lib/bills-client.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const client=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
test('expired sessions signal sign-in recovery without confusing wrong login credentials',async()=>{
 const oldFetch=globalThis.fetch,oldWindow=globalThis.window;
 const events=[];globalThis.window={dispatchEvent:e=>events.push(e.type)};
 globalThis.fetch=async()=>new Response('{}',{status:401});
 try {await client.accountRequest('/api/subscription');assert.deepEqual(events,['account-session-expired']);events.length=0;await client.accountRequest('/api/account/auth');assert.deepEqual(events,[]);globalThis.fetch=async()=>new Response('{}',{status:402});await client.accountRequest('/api/bills');assert.deepEqual(events,['subscription-expired']);}
 finally{globalThis.fetch=oldFetch;globalThis.window=oldWindow;}
});
