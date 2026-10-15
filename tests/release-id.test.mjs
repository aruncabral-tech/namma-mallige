import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {releaseId} from '../build/release-id.mjs';
test('release id is stable and changes when website source changes',()=>{
 const root=mkdtempSync(join(tmpdir(),'mallige-release-'));
 try{
  mkdirSync(join(root,'app'));const file=join(root,'app','page.tsx');writeFileSync(file,'one');
  const first=releaseId(root);assert.match(first,/^[a-f0-9]{20}$/);assert.equal(releaseId(root),first);
  writeFileSync(file,'two');assert.notEqual(releaseId(root),first);
  rmSync(file);assert.notEqual(releaseId(root),first);
 }finally{rmSync(root,{recursive:true,force:true});}
});
