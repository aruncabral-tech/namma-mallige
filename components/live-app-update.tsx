"use client";
import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {APP_BUILD_ID} from '@/lib/app-release';
import {Button} from '@/components/ui/button';

export function UpdateNotice({blocked,onUpdate}:{blocked:boolean;onUpdate:()=>void}) {
 return <aside className="live-update-notice" role="status"><div><strong>A new Namma Mallige update is ready</strong><p>{blocked?'Save your entries and close any open window before updating.':'Save any work in open forms, then update. No reinstall needed.'}</p></div><Button type="button" disabled={blocked} onClick={onUpdate}><RefreshCw/>Update now</Button></aside>;
}
export function LiveAppUpdate({blocked}:{blocked:boolean}) {
 const [available,setAvailable]=useState(false);
 useEffect(()=>{
  let stopped=false;
  let pending:AbortController|null=null;
  async function check(){
   if(document.visibilityState!=='visible'||pending)return;
   const controller=new AbortController();pending=controller;
   const timeout=setTimeout(()=>controller.abort(),10000);
   try{
    const response=await fetch(`/api/app-version?t=${Date.now()}`,{cache:'no-store',signal:controller.signal});
    if(!response.ok)return;
    const data=await response.json();
    if(!stopped&&typeof data.version==='string'&&/^[a-f0-9]{20}$/.test(data.version))setAvailable(data.version!==APP_BUILD_ID);
   }catch{/* Offline users keep working; check again on return. */}
   finally{clearTimeout(timeout);pending=null;}
  }
  void check();
  const interval=setInterval(()=>void check(),60000);
  const onReturn=()=>void check();
  window.addEventListener('focus',onReturn);
  window.addEventListener('online',onReturn);
  document.addEventListener('visibilitychange',onReturn);
  return()=>{stopped=true;clearInterval(interval);pending?.abort();window.removeEventListener('focus',onReturn);window.removeEventListener('online',onReturn);document.removeEventListener('visibilitychange',onReturn);};
 },[]);
 if(!available)return null;
 return <UpdateNotice blocked={blocked} onUpdate={()=>{if(!blocked)window.location.reload();}}/>;
}
