"use client";
import { useState } from "react";
import { AccountForm } from "@/components/account-gate";
import { accountRequest, setBillingOwner } from "@/lib/bills-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
export function OwnerReset({phone,challenge}:{phone:string;challenge:string|null}) {
  const [deleted,setDeleted]=useState(!challenge);
  const [confirmation,setConfirmation]=useState("");
  const [enteredPhone,setEnteredPhone]=useState("");
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function erase() {
    setBusy(true);setError("");
    try {
      const response=await accountRequest("/api/account/owner-reset",{method:"POST",body:JSON.stringify({phone:enteredPhone,confirmation,challenge})});
      const data=await response.json();if(!response.ok)throw new Error(data.error);
      setBillingOwner("");setDeleted(true);setOpen(false);
    } catch(e) {setError(e instanceof Error?e.message:"Could not reset your account.");}
    finally {setBusy(false);}
  }
  if(deleted) return <><p role="status" className="reset-success">Owner verified. Create your new account below and save the new recovery code.</p><AccountForm existingPhone={phone}/></>;
  return <main className="owner-reset-shell"><p className="eyebrow">Original owner verified</p><h1>Erase your old book</h1><p>Account: <strong>{phone}</strong></p><p>This permanently removes this owner’s saved bills, customer details inside those bills, daily rates, balances, profile and login sessions. Downloaded files and messages already sent are not removed. Other owners’ books stay intact.</p><p>You can then create a fresh account with this number. Your old bills cannot be restored through the app.</p><label>Confirm WhatsApp number<Input type="tel" value={enteredPhone} onChange={e=>setEnteredPhone(e.target.value)}/></label><label>Type DELETE MY BOOK<Input autoComplete="off" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label><Button variant="destructive" disabled={confirmation!=="DELETE MY BOOK" || !enteredPhone.trim()} onClick={()=>setOpen(true)}>Erase old account and start again</Button><a href="/">Cancel and return to login</a><AlertDialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Permanently erase this book?</AlertDialogTitle><AlertDialogDescription>All saved bills, rates and account records for {phone} will be deleted. This cannot be undone through the app.</AlertDialogDescription></AlertDialogHeader>{error&&<p role="alert">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Keep my account</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={e=>{e.preventDefault();void erase();}}>{busy?"Erasing…":"Yes, permanently erase"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></main>;
}
