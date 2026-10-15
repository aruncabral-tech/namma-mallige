"use client";
import {useEffect, useState} from "react";
import {Button} from "@/components/ui/button";
import {createDailyBillPng} from "@/lib/daily-bill-image";

export function DailyBillImage({lines,disabled,recipient}: {lines:string[];disabled:boolean;recipient:string}) {
  const [file,setFile]=useState<File|null>(null);
  const [url,setUrl]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  useEffect(()=>{if(!file)return;const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next);},[file]);
  const generate=async()=>{
    if(disabled||busy)return;
    setBusy(true);setMessage("");
    try {const blob=await createDailyBillPng(lines);setFile(new File([blob],"namma-mallige-daily-bill.png",{type:"image/png"}));}
    catch {setMessage("Could not create the image. Try again or use the text message option.");}
    finally {setBusy(false);}
  };
  const share=async()=>{
    if(!file||disabled)return;
    try {
      if(!navigator.canShare?.({files:[file]})){setMessage("Download the image, open the customer’s chat in WhatsApp or WhatsApp Business, and attach it as a photo.");return;}
      await navigator.share({files:[file],title:"Daily flower bill"});
      setMessage("Image handed to the sharing app. Check the recipient and confirm sending in WhatsApp or WhatsApp Business.");
    } catch(error) {setMessage(error instanceof Error&&error.name==="AbortError"?"Sharing cancelled. Your bill image is still available.":"Image sharing is unavailable. Download it and attach it in WhatsApp or WhatsApp Business.");}
  };
  return <div className="daily-image-tools"><Button type="button" disabled={disabled||busy} onClick={()=>void generate()}>{busy?"Creating image…":file?"Recreate daily bill image":"Create daily bill image"}</Button>
    {file&&url&&<><img className="daily-bill-image-preview" src={url} alt="Daily bill image preview"/><div className="whatsapp-actions"><Button type="button" disabled={disabled} onClick={()=>void share()}>Share image · WhatsApp / Business</Button><a className="daily-image-download" href={disabled?undefined:url} download={file.name} aria-disabled={disabled} onClick={event=>{if(disabled)event.preventDefault();}}>Download bill image</a></div></>}
    <p className="whatsapp-help">Choose WhatsApp or WhatsApp Business from your device’s share menu, select {recipient||"the customer"}, and confirm Send. If your preferred app is missing, download the image and attach it in that app. Saturday’s full bill remains printable.</p>
    {message&&<p role="status" className="whatsapp-help">{message}</p>}
  </div>;
}
