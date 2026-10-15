import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
// Content-based and identical across the client and server build environments.
export function releaseId(root) {
 const hash=createHash('sha256');
 function visit(path){
  if(!existsSync(path))return;
  for(const entry of readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   const file=join(path,entry.name);
   if(entry.isDirectory())visit(file);
   else if(entry.isFile())hash.update(relative(root,file)).update('\0').update(readFileSync(file)).update('\0');
  }
 }
 for(const directory of ['app','components','lib','worker','build','public'])visit(join(root,directory));
 for(const file of ['vite.config.ts','next.config.ts','package.json','package-lock.json']){
  const path=join(root,file);if(existsSync(path))hash.update(file).update(readFileSync(path));
 }
 return hash.digest('hex').slice(0,20);
}
