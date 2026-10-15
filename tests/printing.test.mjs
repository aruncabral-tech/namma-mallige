import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
test('ten presets plus custom size have preview dimensions and remain selectable',()=>{
 const formats=source.slice(source.indexOf('const PRINT_FORMATS ='),source.indexOf('type PrintFormat'));
 const dimensions=source.slice(source.indexOf('const PAPER_DIMENSIONS:'),source.indexOf('const PRINT_PREFERENCE'));
 const keys=[...formats.matchAll(/^  (\w+): \{/gm)].map(match=>match[1]);
 assert.equal(keys.length,11);
 for(const key of keys) assert.match(dimensions,new RegExp(key+':\\s*\\{width:[0-9.]+,height:(?:[0-9.]+|null)\\}'));
 assert.match(source,/Object.entries\(PRINT_FORMATS\)\.map/);
 assert.match(source,/bill-preview-paper paper-preview-\$\{printFormat\}/);
 assert.match(source,/useState<PrintFormat>\("receipt60"\)/);
});
const fn=source.slice(source.indexOf('  const openPrintWindow ='),source.indexOf('  const sendWhatsApp'));
for(const blocking of [true,false]) test(`native print keeps bill mounted (${blocking?'blocking':'nonblocking'})`,()=>{
 const events=new Map();let calls=0;let modal=true;
 const context={printBatch:[{customer:'Any customer'}],printCleanupRef:{current:null},printSize:'100',document:{body:{style:{setProperty(){},removeProperty(){}}}},window:{addEventListener(n,f){events.set(n,f)},removeEventListener(n){events.delete(n)},print(){calls++;assert.equal(modal,false);if(blocking)events.get('afterprint')?.()}},flushSync:f=>f(),setPrintDialogOpen:v=>{modal=v},setPrintError(){}};
 vm.runInNewContext(fn+';openPrintWindow();',context);
 assert.equal(calls,1);assert.equal(modal,false);assert.equal(context.printBatch.length,1);
 events.get('afterprint')?.();assert.equal(context.printBatch.length,1);
});
test('custom print modal has no context-dependent Dialog primitives',()=>{
 const modal=source.slice(source.indexOf('{printDialogVisible &&'),source.indexOf('<AlertDialog open={pendingOpen'));
 assert.doesNotMatch(modal,/<Dialog(?:Title|Description)\b/);
 assert.match(modal,/<h2 id="print-dialog-title">/);
});
test('paper and scale controls use native selects above the modal stacking layer',()=>{
 const modal=source.slice(source.indexOf('{printDialogVisible &&'),source.indexOf('<AlertDialog open={pendingOpen'));
 assert.match(modal,/<select aria-label="Bill printing size"/);
 assert.match(modal,/<select aria-label="Trouble printing size"/);
 assert.doesNotMatch(modal,/<Select(?:Content|Trigger)\b/);
 assert.ok(modal.indexOf('aria-label="10 preset sizes and custom size"') < modal.indexOf('className="print-bill-summary"'));
});

test('reopening print setup clears a stale native print lock',()=>{
 const open=source.slice(source.indexOf('  const print = (batch:'),source.indexOf('  const closePrintDialog'))
  .replace('(batch: Bill[] | null)','(batch)');
 let cleaned=0,shown=false,selected;
 const context={personal:false,dirty:false,printCleanupRef:{current:()=>{cleaned++}},setPrintBatch:v=>{selected=v},setPrintError(){},setPrintDialogOpen:v=>{shown=v}};
 vm.runInNewContext(open+';print([{id:"saved"}]);',context);
 assert.equal(cleaned,1);assert.equal(shown,true);assert.equal(selected[0].id,'saved');
});

test('printed balances use the saved bill amounts and payment fields',()=>{
 assert.match(source,/<PrintedPaymentTotals balance=\{billBalance\(b\)\} \/>/);
 assert.doesNotMatch(source,/paymentSummary\(b\)/);
});
