"use client";
import {useEffect,useState} from "react";
import {Bell} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from "@/components/ui/dialog";
import {useLanguage} from "@/components/language";
const RELEASE="2026-09-30-professional-layout";
export function AppUpdates({ownerId,personal,ready}:{ownerId:string;personal:boolean;ready:boolean}){
 const [open,setOpen]=useState(false);const [unread,setUnread]=useState(false);const {language}=useLanguage();const kn=language==="kn";
 const key=`namma-updates:${ownerId}`;
 useEffect(()=>{if(!ready)return;let seen=false;try{seen=localStorage.getItem(key)===RELEASE;}catch{}setUnread(!seen);setOpen(!seen);},[key,ready]);
 function dismiss(){setOpen(false);setUnread(false);try{localStorage.setItem(key,RELEASE);}catch{}}
 return <><Button variant="outline" className="updates-bell" onClick={()=>setOpen(true)} aria-label={unread?"App updates — new update":"App updates"}><Bell/><span>{kn?"ನವೀಕರಣಗಳು":"Updates"}</span>{unread&&<span className="updates-dot" aria-hidden="true"/>}</Button>
 <Dialog open={open} onOpenChange={v=>v?setOpen(true):dismiss()}><DialogContent className="updates-dialog"><DialogHeader><DialogTitle>{kn?"ಹೊಸದೇನಿದೆ?":"A fresh look for your flower book"}</DialogTitle><DialogDescription>30 September 2026 · {kn?"ನಿಮ್ಮ ಹೂವಿನ ಲೆಕ್ಕ ಸುಲಭವಾಗಿದೆ":"Your familiar tools, easier to find"}</DialogDescription></DialogHeader>
 <ul className="updates-list"><li><strong>Clearer navigation</strong><p>Move between Daily entry, Daily prices, {personal ? "My diary" : "Account book"} and Reports. Use the side menu on a computer or the four sections on your phone.</p></li><li><strong>Easier daily entries</strong><p>{personal ? "Buyer" : "Customer"} details, flower quantities and weekly totals now have their own clear sections, with larger touch controls.</p></li>{!personal && <li><strong>Your billing tools are here</strong><p>Find Customer requests beside the navigation. The 6 cm receipt preview and customer bill links remain on your saved bills.</p></li>}</ul><p className="updates-assurance">Your flower calculation has not changed.</p><DialogFooter><Button onClick={dismiss}>{kn?"ಅರ್ಥವಾಯಿತು":"Got it"}</Button></DialogFooter></DialogContent></Dialog></>;
}
