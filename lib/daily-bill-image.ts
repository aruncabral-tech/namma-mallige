// Render text directly, so no screenshot service or bill upload is required.
export function wrapBillText(context: Pick<CanvasRenderingContext2D,"measureText">,text:string,maxWidth:number) {
  const result:string[]=[];
  let current="";
  for(const character of Array.from(text)) {
    if(current&&context.measureText(current+character).width>maxWidth){result.push(current.trimEnd());current="";}
    current+=character;
  }
  result.push(current.trimEnd());
  return result;
}
export async function createDailyBillPng(lines:string[]):Promise<Blob> {
  const canvas=document.createElement("canvas");
  const context=canvas.getContext("2d");
  if(!context)throw new Error("Canvas unavailable");
  const width=1080,padding=64,lineHeight=54;
  context.font="600 34px Arial, sans-serif";
  const wrapped=lines.flatMap(line=>wrapBillText(context,line,width-padding*2));
  canvas.width=width;canvas.height=padding*2+wrapped.length*lineHeight+48;
  context.fillStyle="#fff";context.fillRect(0,0,canvas.width,canvas.height);
  context.fillStyle="#111";context.font="600 34px Arial, sans-serif";
  context.textBaseline="top";
  wrapped.forEach((line,index)=>context.fillText(line,padding,padding+index*lineHeight));
  context.fillStyle="#555";context.font="26px Arial, sans-serif";
  context.fillText("Namma Mallige · nammamallige.store",padding,canvas.height-padding);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error("Image creation failed")),"image/png"));
}
