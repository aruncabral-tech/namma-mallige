import {z} from 'zod';
import {siteSettings} from '@/lib/site-settings';
import {requireBookOwner,accountJson,accountError} from '@/lib/account-auth';
const price=z.number().finite().nonnegative().max(1000000);
const schema=z.object({jasminePrice:price,pinkJasminePrice:price,updatedAt:z.string().datetime({offset:true}),last7Days:z.array(z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),jasminePrice:price,pinkJasminePrice:price})).max(31)});
let cached: {data:z.infer<typeof schema>;checkedAt:number}|null=null;
let inflight:Promise<void>|null=null;
export async function readMarketPrices(){try{
 const settings=await siteSettings();if(settings.marketMode==='manual'){return accountJson({jasminePrice:settings.jasminePrice,pinkJasminePrice:settings.pinkJasminePrice,updatedAt:settings.priceDate+'T00:00:00+05:30',checkedAt:Date.now(),unavailable:false,source:'',sourceLabel:'Website owner',last7Days:[{date:settings.priceDate,jasminePrice:settings.jasminePrice,pinkJasminePrice:settings.pinkJasminePrice}]});}

 let unavailable=false;
 if(!cached||Date.now()-cached.checkedAt>60000){try{if(!inflight)inflight=(async()=>{const r=await fetch('https://api.nammamallige.in/api/landing-page',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Source unavailable');const data=schema.parse(await r.json());if(Date.parse(data.updatedAt)>Date.now()+300000)throw Error('Invalid source time');cached={data,checkedAt:Date.now()};})().finally(()=>{inflight=null;});await inflight;}catch{unavailable=true;}}
 if(!cached)return accountJson({error:'The price source is temporarily unavailable. Please try again shortly.'},503);
 return accountJson({...cached.data,checkedAt:cached.checkedAt,unavailable,source:'https://www.nammamallige.in/dashboard'});
}catch(e){return accountError(e);}}

export async function GET(request:Request){try{await requireBookOwner(request);return readMarketPrices();}catch(e){return accountError(e);}}
