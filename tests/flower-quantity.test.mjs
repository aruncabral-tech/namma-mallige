import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { flowerAmount } from '../lib/flower-calculation.ts';

const compiled = await build({entryPoints:[new URL('../lib/flower-quantity.ts',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm'});
const {chenduAndBuds,splitChenduAndBuds} = await import('data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64'));

test('separate chendu and extra-bud counts produce the confirmed totals', () => {
  assert.equal(chenduAndBuds(1,0),800);
  assert.equal(chenduAndBuds(1,200),1000);
  assert.equal(chenduAndBuds(2,400),2000);
  assert.equal(chenduAndBuds(4,0),3200);
  assert.equal(chenduAndBuds(0,600),600);
  assert.equal(chenduAndBuds(1,1200),2000);
  assert.throws(() => chenduAndBuds(1.2,0));
  assert.throws(() => chenduAndBuds(1,-200));
  assert.throws(() => chenduAndBuds(Infinity,0));
});

test('existing decimal quantities retain their original number of buds', () => {
  for(const [qty,unit,buds] of [[1.2,'chendu',960],[1.25,'chendu',1000],[.25,'chendu',200],[1,'atte',3200],[1050,'buds',1050]]) {
    const split = splitChenduAndBuds(qty,unit);
    assert.equal(split.totalBuds,buds);
    assert.equal(chenduAndBuds(split.chendus,split.extraBuds),buds);
    assert.equal(flowerAmount(qty,unit,540),flowerAmount(buds,'buds',540));
  }
});

test('new quantity entry uses the unchanged amount and five-paise rounding', () => {
  assert.equal(flowerAmount(chenduAndBuds(1,200),'buds',800),250);
  assert.equal(flowerAmount(chenduAndBuds(2,400),'buds',800),500);
  assert.equal(flowerAmount(chenduAndBuds(0,600),'buds',800),150);
  assert.equal(flowerAmount(chenduAndBuds(0,300),'buds',1000),93.75);
  assert.equal(flowerAmount(chenduAndBuds(0,100),'buds',60),1.85);
});
