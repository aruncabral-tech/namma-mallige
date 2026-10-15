import {z} from 'zod';
export function safeSponsorUrl(value:string):boolean {
 if(!value)return true;
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}
}
export const sponsorDefaults={enabled:true,title:'',description:'',url:''};
export const sponsorSchema=z.object({
 enabled:z.boolean(),
 title:z.string().trim().max(80),
 description:z.string().trim().max(240),
 url:z.string().trim().max(2048).refine(safeSponsorUrl,'Use a full https:// website address.'),
}).refine(s=>!s.url||!!s.title,{message:'Add an advertiser name before publishing a link.',path:['title']});
export type SponsorSettings=z.infer<typeof sponsorSchema>;
