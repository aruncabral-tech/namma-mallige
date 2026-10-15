"use client";
import { useCallback,useEffect,useState,type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { accountRequest } from "@/lib/bills-client";
import type { OwnerAccount } from "@/lib/account-types";
import type { SubscriptionStatus } from "@/lib/subscription-plans";
import { CalendarDays,Check,LockKeyhole,LoaderCircle,Wallet } from "lucide-react";

const dateLabel=(time:number)=>new Date(time).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
export function SubscriptionAccess({owner,onSignOut,children}:{owner:OwnerAccount;onSignOut:()=>void;children:ReactNode}) {
  const [status,setStatus]=useState<SubscriptionStatus|null>(null),[show,setShow]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[plan,setPlan]=useState<"monthly"|"yearly">("monthly"),[reference,setReference]=useState(""),[requests,setRequests]=useState<{id:string;amount:number;reference:string;review_status:string}[]>([]),[pay,setPay]=useState(false);
  const refresh=useCallback(async()=>{
    try {const response=await accountRequest("/api/subscription");const data=await response.json();if(!response.ok)throw new Error(data.error);setStatus(data.subscription);setRequests(data.requests||[]);setError("");}
    catch(e){setStatus(null);setError(e instanceof Error?e.message:"Could not check your subscription.");}
  },[]);
  useEffect(()=>{void refresh();if(new URLSearchParams(window.location.search).has("subscription"))setShow(true);const timer=setInterval(()=>void refresh(),60000);const focus=()=>void refresh();window.addEventListener("focus",focus);window.addEventListener("subscription-expired",focus);return()=>{clearInterval(timer);window.removeEventListener("focus",focus);window.removeEventListener("subscription-expired",focus);};},[refresh]);
  useEffect(()=>{if(!status?.enabled||!status.active||!status.expiresAt)return;const delay=status.expiresAt-Date.now();const timer=setTimeout(()=>{setStatus(s=>s?{...s,active:false}:s);void refresh();},Math.min(Math.max(delay,0)+50,2147483647));return()=>clearTimeout(timer);},[status,refresh]);
  async function submitPayment() {
    setBusy(true);setError("");
    try {const response=await accountRequest("/api/subscription",{method:"POST",body:JSON.stringify({plan,reference})});const data=await response.json();if(!response.ok)throw new Error(data.error);await refresh();setNotice("Payment reference submitted. Your subscription activates after the owner verifies receipt.");setReference("");setPay(false);}
    catch(e){setError(e instanceof Error?e.message:"Could not submit payment.");}finally{setBusy(false);}
  }
  async function signout(){setBusy(true);try{const response=await accountRequest("/api/account/auth",{method:"POST",body:JSON.stringify({action:"logout"})});if(!response.ok)throw new Error("Could not sign out. Please retry.");onSignOut();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  if(!status)return <main className="subscription-shell"><h1>Namma Mallige</h1><p role="status">{error||"Checking your access…"}</p><Button onClick={()=>void refresh()}>Retry</Button><Button variant="ghost" onClick={()=>void signout()}>Sign out</Button></main>;
  const locked=status.enabled&&!status.active;
  if(show||locked)return <main className="subscription-shell">
    <header className="subscription-top"><a href="/">Namma Mallige</a><Button variant="ghost" disabled={busy} onClick={()=>void signout()}>Sign out</Button></header>
    <section className="subscription-intro"><span className="subscription-icon">{locked?<LockKeyhole/>:<Wallet/>}</span><p className="eyebrow">{owner.accountType==="business"?"BUSINESS OWNER":"PERSONAL ACCOUNT"}</p><h1>{status.suspended?"Your account is suspended.":locked?"Keep your flower book growing.":"A plan for every bloom."}</h1><p>{status.suspended?"Contact the website owner to restore access. Paying does not remove a suspension.":locked?"Your access has expired. Renew to open your book again. All your saved bills and entries are kept safely.":"Choose monthly flexibility or a full year of access."}</p>
    {status.enabled&&status.expiresAt&&<p className="subscription-state">{status.trial?"5-day trial":"Subscription"} {locked?"ended":"ends"} {dateLabel(status.expiresAt)} IST</p>}
    {!status.enabled&&<p className="subscription-state">Subscriptions are being prepared. Your current access continues.</p>}
    </section>
    {notice&&<p className="status-bar" role="status">{notice}</p>}{error&&<p className="status-bar error" role="alert">{error}</p>}
    <div className="subscription-plans">{(["monthly","yearly"] as const).map(plan=><section className={`subscription-plan ${plan==="yearly"?"annual":""}`} key={plan}><CalendarDays/><h2>{plan==="monthly"?"Monthly":"Yearly"}</h2><p className="subscription-price">₹{status.prices[plan].toLocaleString("en-IN")}<span> / {plan==="monthly"?"month":"year"}</span></p><p>{plan==="monthly"?"One calendar month of access.":"Twelve calendar months of access."}</p><ul><li><Check/>Daily flower entries and rates</li><li><Check/>Payments and balance tracking</li><li><Check/>{owner.accountType==="business"?"Customer books and weekly bills":"Personal flower diary and earnings"}</li></ul><Button disabled={busy||!!status.suspended||!status.enabled||!status.ready} onClick={()=>{setPlan(plan);setPay(true);setNotice("");}}>{busy?<LoaderCircle className="spin"/>:<Wallet/>}Pay ₹{status.prices[plan].toLocaleString("en-IN")} with UPI</Button></section>)}</div>
    <p className="subscription-note">5-day free trial. Access activates after payment is verified. Renewals are paid manually; there is no automatic debit. Early renewal adds time after your current access ends.</p>
    {pay&&<section className="upi-payment"><h2>Pay ₹{status.prices[plan]} · {plan=== "monthly"?"Monthly":"Yearly"}</h2><img src="/upi-payment.png" alt="UPI payment QR for Arun Cabral, arun.cabral54@myhdfc" width="929" height="1600"/><p><strong>Arun Cabral</strong><br/>arun.cabral54@myhdfc</p><a className="upi-link" href={`upi://pay?pa=arun.cabral54%40myhdfc&pn=Arun%20Cabral&am=${status.prices[plan]}&cu=INR&tn=Namma%20Mallige%20${plan}`}>Open UPI app · ₹{status.prices[plan]}</a><p>Scan using another phone, or open your UPI app. Check the recipient and amount before paying.</p><form onSubmit={e=>{e.preventDefault();void submitPayment();}}><label htmlFor="utr">After payment, enter the 12-digit UPI reference (UTR)</label><input id="utr" inputMode="numeric" pattern="[0-9]{12}" maxLength={12} required value={reference} onChange={e=>setReference(e.target.value)} placeholder="12-digit transaction reference"/><Button type="submit" disabled={busy}>Submit for approval</Button></form><p>Submitting a reference does not confirm payment. Please do not pay again while approval is pending.</p></section>}
    {requests.length>0&&<section className="upi-history"><h2>Your payments</h2>{requests.map(r=><p key={r.id}>₹{r.amount} · {r.reference} · <strong>{r.review_status=== "pending"?"Awaiting verification":r.review_status=== "approved"?"Approved":"Rejected — contact the owner"}</strong></p>)}</section>}
    <div className="subscription-actions">{!locked&&<Button variant="outline" onClick={()=>{setShow(false);window.history.replaceState(null,"",window.location.pathname);}}>Continue to my book</Button>}<Button variant="ghost" disabled={busy} onClick={()=>void refresh()}>Refresh access</Button></div><p className="subscription-note"><a href="/owner">Owner dashboard</a></p>
  </main>;
  return <>{status.enabled&&<div className="subscription-banner"><span>{status.trial?"Free trial":"Subscription"} · until {status.expiresAt?dateLabel(status.expiresAt):"—"} IST</span><a href="/dashboard">Market prices</a><a href="/owner">Owner dashboard</a><Button variant="ghost" onClick={()=>setShow(true)}>View plans / renew</Button></div>}{children}</>;
}
