import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../components/daily-prices-panel.tsx',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('  const save = async'),source.indexOf('  return <section'));
for(const unlocked of [false,true]) test(`existing daily price correction ${unlocked?'saves with MPIN':'stays locked'}`,async()=>{
 let request;let accepted;
 const context={fixed:{jasmineRate:800,pinkRate:600},unlocked,saving:false,loading:false,mPrice:'780',jPrice:'580',unlockMpin:'1234',date:'2026-10-14',setSaving(){},setError(){},setMessage(){},setUnlocked(){},setUnlockMpin(){},onPrices:p=>accepted=p,dailyPricesRequest:async(...args)=>{request=args;return {ok:true,json:async()=>({price:{date:'2026-10-14',jasmineRate:780,pinkRate:580}})}}};
 await vm.runInNewContext(fn+';save();',context);
 if(!unlocked){assert.equal(request,undefined);return;}
 assert.equal(request[2].method,'POST');
 assert.deepEqual(JSON.parse(request[2].body),{date:'2026-10-14',jasmineRate:780,pinkRate:580,mpin:'1234'});
 assert.equal(accepted[0].jasmineRate,780);
});
