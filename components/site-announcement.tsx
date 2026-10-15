"use client";
import {useEffect,useState} from 'react';
export function SiteAnnouncement(){const [text,setText]=useState('');useEffect(()=>{const load=()=>fetch('/api/site-content').then(r=>r.ok?r.json():null).then(d=>{if(d)setText(d.announcement);}).catch(()=>{});void load();const t=setInterval(load,60000);return()=>clearInterval(t);},[]);return text?<aside className="site-announcement">{text}</aside>:null;}
