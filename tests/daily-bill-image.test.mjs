import test from 'node:test';
import assert from 'node:assert/strict';
import {wrapBillText,createDailyBillPng} from '../lib/daily-bill-image.ts';
test('bill images wrap long names and unbroken identifiers without losing characters',()=>{
 const context={measureText:text=>({width:Array.from(text).length*10})};
 for(const text of ['Sunita','A very long Katte name in Shirva','NMM-12345678901234567890','ಅರುಣ್ ಕ್ಯಾಬ್ರಾಲ್']) {
  const lines=wrapBillText(context,text,80);
  assert.equal(lines.join('').replaceAll(' ',''),text.replaceAll(' ',''));
  assert.ok(lines.every(line=>context.measureText(line).width<=80));
 }
});
test('image output includes every amount and allocates space for wrapped lines',async()=>{
 const drawn=[];let canvas;
 const context={measureText:text=>({width:text.length*20}),fillRect(){},fillText:(...args)=>drawn.push(args)};
 const previous=globalThis.document;
 globalThis.document={createElement(){canvas={getContext:()=>context,toBlob:callback=>callback(new Blob(['png'],{type:'image/png'}))};return canvas;}};
 try {
  const blob=await createDailyBillPng(['Sunita','Daily total: ₹150.00','Pending: ₹200.00']);
  assert.equal(blob.type,'image/png');
  assert.ok(drawn.some(([text])=>text==='Pending: ₹200.00'));
  assert.ok(drawn.every(([, ,y])=>y<canvas.height));
 }finally{globalThis.document=previous;}
});
