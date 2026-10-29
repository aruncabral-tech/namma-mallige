import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../components/daily-prices-panel.tsx',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('  const save = async'),source.indexOf('  return <section'));

test('daily price corrections save directly without an MPIN prompt',async()=>{
  let request;let accepted;let message;
  const context={
    saving:false,loading:false,mPrice:'780',jPrice:'580',date:'2026-10-14',
    setSaving(){},setError(){},setMessage(value){message=value;},
    onPrices:p=>accepted=p,
    dailyPricesRequest:async(...args)=>{
      request=args;
      return {ok:true,json:async()=>({price:{date:'2026-10-14',jasmineRate:780,pinkRate:580}})};
    },
  };
  await vm.runInNewContext(fn+';save();',context);
  assert.equal(request[2].method,'POST');
  assert.deepEqual(JSON.parse(request[2].body),{date:'2026-10-14',jasmineRate:780,pinkRate:580});
  assert.equal(accepted[0].jasmineRate,780);
  assert.match(message,/fixed|saved|correct/i);
  assert.doesNotMatch(fn,/mpin|unlock/i);
});
