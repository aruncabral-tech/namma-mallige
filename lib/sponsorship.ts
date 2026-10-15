import {z} from 'zod';
export function safeSponsorUrl(value:string):boolean {
 if(!value)return true;
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}
}
export function safeSponsorImage(value:string):boolean {
 return !value || (value.length<=180000 && /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value));
}
function validDate(value:string){
 if(!value)return true;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T12:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
export const sponsorDefaults={enabled:true,title:'',description:'',url:'',image:'',startDate:'',endDate:''};
export const sponsorSchema=z.object({
 enabled:z.boolean(),title:z.string().trim().max(80),description:z.string().trim().max(240),
 url:z.string().trim().max(2048).refine(safeSponsorUrl,'Use a full https:// website address.'),
 image:z.string().max(180000).refine(safeSponsorImage,'Choose a valid sponsor image.').default(''),
 startDate:z.string().refine(validDate,'Choose a valid start date.').default(''),
 endDate:z.string().refine(validDate,'Choose a valid expiry date.').default(''),
}).refine(s=>!s.url||!!s.title,{message:'Add an advertiser name before publishing a link.',path:['title']})
.refine(s=>!s.image||!!s.title,{message:'Add an advertiser name before uploading an image.',path:['title']})
.refine(s=>!s.startDate||!s.endDate||s.startDate<=s.endDate,{message:'Expiry must be on or after the start date.',path:['endDate']});
export type SponsorSettings=z.infer<typeof sponsorSchema>;
export function sponsorStatus(s:SponsorSettings,now=Date.now()):'hidden'|'available'|'scheduled'|'active'|'expired'{
 if(!s.enabled)return 'hidden';if(!s.title)return 'available';
 if(s.startDate&&now<Date.parse(s.startDate+'T00:00:00+05:30'))return 'scheduled';
 if(s.endDate&&now>Date.parse(s.endDate+'T23:59:59.999+05:30'))return 'expired';
 return 'active';
}
export function sponsorForDisplay(s:SponsorSettings,now=Date.now()):SponsorSettings {
 return sponsorStatus(s,now)==='active'?s:{...sponsorDefaults,enabled:s.enabled};
}
