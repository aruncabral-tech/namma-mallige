"use client";
import {useEffect,useState} from 'react';
import {ArrowUpRight,Megaphone} from 'lucide-react';
import {sponsorSchema,type SponsorSettings} from '@/lib/sponsorship';
const enquiry='https://wa.me/918971891245?text='+encodeURIComponent('Hi Arun, I would like to advertise my business on Namma Mallige. Please share availability and pricing.');
export function SponsorCard({sponsor}:{sponsor:SponsorSettings}){
 if(!sponsor.enabled)return null;
 const booked=!!sponsor.title;
 return <aside className="sponsor-space" aria-label="Advertisement"><div className="sponsor-emblem" aria-hidden="true"><Megaphone size={24}/></div><div className="sponsor-copy"><span className="sponsor-label">{booked?'Sponsored':'Advertisement · Space available'}</span><h2>{booked?sponsor.title:'Your business, in good company.'}</h2><p>{booked?sponsor.description:'Promote your business on Namma Mallige. Contact us for availability and pricing.'}</p></div><div className="sponsor-actions">{booked&&sponsor.url?<a className="sponsor-main-link" href={sponsor.url} target="_blank" rel="sponsored noopener noreferrer">Visit advertiser <ArrowUpRight size={16} aria-hidden="true"/></a>:<a className="sponsor-main-link" href={enquiry} target="_blank" rel="noopener noreferrer">Advertise here <ArrowUpRight size={16} aria-hidden="true"/></a>}{booked&&<a className="sponsor-enquiry" href={enquiry} target="_blank" rel="noopener noreferrer">Book this space</a>}</div></aside>;
}
export function SponsorSpace(){
 const [sponsor,setSponsor]=useState<SponsorSettings|null>(null);
 useEffect(()=>{
  const controller=new AbortController();
  void fetch('/api/site-content',{cache:'no-store',signal:controller.signal}).then(async r=>{
   if(!r.ok)return;const data=await r.json();const parsed=sponsorSchema.safeParse(data.sponsor);
   if(!controller.signal.aborted&&parsed.success)setSponsor(parsed.data);
  }).catch(()=>{/* Keep the billing screen available if content cannot load. */});
  return()=>controller.abort();
 },[]);
 return sponsor?<SponsorCard sponsor={sponsor}/>:null;
}
