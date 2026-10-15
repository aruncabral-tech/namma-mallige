import test from 'node:test';
import assert from 'node:assert/strict';
import { flowerAmount, sumAmounts } from '../lib/flower-calculation.ts';

test('handwritten seven-day bill totals without the unexplained extra charge', () => {
  const rows = [[540,1050,177.15],[600,1700,318.75],[800,600,150],[1000,300,93.75],[1000,800,250],[1600,1000,500],[1000,850,265.60]];
  for (const [rate,buds,expected] of rows) assert.equal(flowerAmount(buds,'buds',rate),expected);
  assert.equal(sumAmounts(rows.map(([rate,buds]) => flowerAmount(buds,'buds',rate))),1755.25);
});

test('consistent formula for Excel examples, including inconsistent table cells', () => {
  assert.equal(flowerAmount(100,'buds',50),1.55);
  assert.equal(flowerAmount(50,'buds',40),0.60);
  assert.equal(flowerAmount(500,'buds',200),31.25);
  assert.equal(flowerAmount(700,'buds',360),78.75);
  assert.equal(flowerAmount(800,'buds',50),12.50);
});

test('unit conversions and rates outside the Excel table', () => {
  for (const rate of [0,40,360,540,1000,1600,3200,5678.95]) {
    assert.equal(flowerAmount(800,'buds',rate),flowerAmount(1,'chendu',rate));
    assert.equal(flowerAmount(3200,'buds',rate),flowerAmount(1,'atte',rate));
    assert.equal(flowerAmount(200,'buds',rate),flowerAmount(0.25,'chendu',rate));
  }
  assert.equal(flowerAmount(0,'buds',540),0);
  assert.equal(flowerAmount(1,'atte',10.049),10);
  assert.equal(flowerAmount(1,'atte',10.05),10.05);
  assert.equal(flowerAmount(1,'atte',10.051),10.05);
  assert.equal(sumAmounts([0.1,0.2]),0.3);
  assert.throws(() => flowerAmount(-1,'buds',100));
});
