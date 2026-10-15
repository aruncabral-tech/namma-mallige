"use client";
import {useEffect,useState} from 'react';
import {ArrowUpRight,Megaphone} from 'lucide-react';
import {sponsorSchema,sponsorForDisplay,type SponsorSettings} from '@/lib/sponsorship';
const enquiry='https://wa.me/918971891245?text='+encodeURIComponent('Hi Arun, I would like to advertise my business on Namma Mallige. Please share availability and pricing.');
export function SponsorCard({sponsor:rawSponsor,now=Date.now()}:{sponsor:SponsorSettings;now?:number}){
 const sponsor=sponsorForDisplay(rawSponsor,now);
 if(!sponsor.enabled)return null;
 const booked=!!sponsor.title;
 return <aside className="sponsor-space" aria-label="Advertisement"><div className="sponsor-visual">{booked&&sponsor.image?<img className="sponsor-image" src={sponsor.image} alt={`${sponsor.title} advertisement`} loading="lazy"/>:<div className="sponsor-emblem" aria-hidden="true"><Megaphone size={24}/></div>}</div><div className="sponsor-copy"><span className="sponsor-label">{booked?'Sponsored':'Advertisement · Space available'}</span><h2>{booked?sponsor.title:'Your business, in good company.'}</h2><p>{booked?sponsor.description:'Promote your business on Namma Mallige. Contact us for availability and pricing.'}</p></div><div className="sponsor-actions">{booked&&sponsor.url?<a className="sponsor-main-link" href={sponsor.url} target="_blank" rel="sponsored noopener noreferrer">Visit advertiser <ArrowUpRight size={16} aria-hidden="true"/></a>:<a className="sponsor-main-link" href={enquiry} target="_blank" rel="noopener noreferrer">Advertise here <ArrowUpRight size={16} aria-hidden="true"/></a>}{booked&&<a className="sponsor-enquiry" href={enquiry} target="_blank" rel="noopener noreferrer">Book this space</a>}</div></aside>;
}
export function SponsorSpace(){
 const [sponsor,setSponsor]=useState<SponsorSettings|null>(null);
 const [now,setNow]=useState(Date.now);
 useEffect(()=>{
  let stopped=false,offset=0,pending:AbortController|null=null;
  const tick=()=>setNow(Date.now()+offset);
  async function load(){
   if(pending||document.visibilityState!=='visible')return;
   const controller=new AbortController();pending=controller;
   const timeout=setTimeout(()=>controller.abort(),10000);
   try{
    const response=await fetch('/api/site-content',{cache:'no-store',signal:controller.signal});
    if(!response.ok)return;const data=await response.json();const parsed=sponsorSchema.safeParse(data.sponsor);
    if(!stopped&&parsed.success){if(typeof data.serverNow==='number')offset=data.serverNow-Date.now();setSponsor(parsed.data);tick();}
   }catch{/* Keep the billing screen available if content cannot load. */}
   finally{clearTimeout(timeout);pending=null;}
  }
  const onReturn=()=>{tick();void load();};
  void load();
  const clock=setInterval(tick,1000),poll=setInterval(()=>void load(),60000);
  document.addEventListener('visibilitychange',onReturn);window.addEventListener('online',onReturn);
  return()=>{stopped=true;pending?.abort();clearInterval(clock);clearInterval(poll);document.removeEventListener('visibilitychange',onReturn);window.removeEventListener('online',onReturn);};
 },[]);
 return sponsor?<SponsorCard sponsor={sponsor} now={now}/>:null;
}
