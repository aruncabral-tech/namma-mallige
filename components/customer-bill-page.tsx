"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { LockKeyhole, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { CORRECTION_CATEGORIES, type CustomerBill } from "@/lib/customer-bill-types";
import { splitChenduAndBuds } from "@/lib/flower-quantity";

const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
const fullDateText = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const dateText = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
function quantity(buds: number) {
  const { chendus, extraBuds } = splitChenduAndBuds(buds, "buds");
  if (!chendus) return extraBuds.toLocaleString("en-IN");
  return Number.isInteger(extraBuds) ? `${chendus.toLocaleString("en-IN")}.${String(extraBuds).padStart(3, "0")} Chandu` : `${chendus} Chandu + ${extraBuds} buds`;
}

export function CustomerBillPage() {
  const [token, setToken] = useState<string | null>(null);
  const [bill, setBill] = useState<CustomerBill | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [day, setDay] = useState("all");
  const [category, setCategory] = useState<string>(CORRECTION_CATEGORIES[0]);
  const requestId = useRef<string | null>(null);
  useEffect(() => {
    const readToken = () => { setToken(window.location.hash.slice(1)); setBill(null); setError(""); setNotice(""); setMessage(""); requestId.current = null; };
    readToken(); window.addEventListener("hashchange", readToken);
    return () => window.removeEventListener("hashchange", readToken);
  }, []);
  const request = useCallback(async (body: object, signal?: AbortSignal) => {
    const response = await fetch("/api/customer-bill", { method: "POST", credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal, headers: { "Content-Type": "application/json", "X-ACS-Request": "1", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { if (response.status === 404) setBill(null); throw new Error(data.error || "Could not open this bill. Please retry."); }
    return data.bill as CustomerBill;
  }, [token]);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (token === null) return;
    if (!/^[a-f0-9]{64}$/.test(token)) { setError("Open the full bill link sent by the business owner."); return; }
    setLoading(true); setError("");
    try { const data = await request({ action: "view" }, signal); if (!signal?.aborted) setBill(data); }
    catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Could not open this bill. Please retry."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [token, request]);
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh]);
  async function send(event: React.FormEvent) {
    event.preventDefault(); if (!bill || sending || loading) return;
    setSending(true); setError(""); setNotice("");
    requestId.current ??= crypto.randomUUID();
    try {
      const data = await request({ action: "request", id: requestId.current, version: bill.version, dayIndex: day === "all" ? null : Number(day), category, message });
      setBill(data); setMessage(""); requestId.current = null;
      setNotice("Request received. The business owner will review it. Refresh this page later to see their reply.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not confirm your request. Refresh this page before retrying."); }
    finally { setSending(false); }
  }
  const editRequest = () => { requestId.current = null; setNotice(""); };
  return <main className="customer-bill-shell">
    <header className="customer-page-brand"><img src="/brand-logo.png" width="52" height="52" alt="Namma Mallige logo" /><div><strong>Namma Mallige</strong><p>Your weekly flower bill</p></div><LockKeyhole aria-label="Private link" /></header>
    {error && <div role="alert" className="customer-page-error"><p>{error}</p><Button variant="outline" disabled={loading || sending} onClick={() => refresh()}><RefreshCw /> Retry / refresh bill</Button></div>}
    {!bill ? <section className="panel customer-page-empty"><h1>{loading || token === null ? "Opening your bill…" : "A private bill link is needed"}</h1><p>{loading || token === null ? "Please wait while we load the saved entries." : "Ask your business owner to send an active customer bill link."}</p></section> : <>
      <section className="panel customer-bill-heading"><div><p className="customer-eyebrow">{bill.business.name}</p>{bill.business.location && <p>{bill.business.location}</p>}<h1>{bill.customer}</h1><p>Bill {bill.billNo} · {fullDateText(bill.weekStart)} – {fullDateText(bill.days[6].date)}</p></div><Button variant="outline" disabled={loading || sending} onClick={() => refresh()}><RefreshCw /> {loading ? "Refreshing…" : "Refresh"}</Button></section>
      <section className="customer-bill-total"><div><span>Weekly grand total</span><strong>{money(bill.balance.flowerTotal)}</strong><p>Flowers for these seven days</p></div></section>
      <section className="customer-days" aria-label="Daily flowers and amounts">{bill.days.map((entry, i) => <article className="panel customer-day" key={entry.date}><div className="customer-day-heading"><h2>{dateText(entry.date)}</h2><strong>{money(entry.total)}</strong></div><Table><TableHeader><TableRow><TableHead>Flower / quantity</TableHead><TableHead>Price / atte</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader><TableBody>{entry.flowers.map(flower => <TableRow key={flower.code}><TableCell><b>{flower.code}</b> · {quantity(flower.buds)}</TableCell><TableCell>{money(flower.rate)}</TableCell><TableCell>{money(flower.amount)}</TableCell></TableRow>)}</TableBody></Table><Button className="customer-day-query" variant="ghost" onClick={() => { setDay(String(i)); editRequest(); document.getElementById("correction-message")?.focus(); }}>Ask about this day</Button></article>)}</section>
      <section className="panel customer-balance"><h2>Payment balance</h2><dl><div><dt>Weekly flowers</dt><dd>{money(bill.balance.flowerTotal)}</dd></div><div><dt>Old pending</dt><dd>{money(bill.balance.openingBalance)}</dd></div><div><dt>Total payable</dt><dd>{money(bill.balance.totalPayable)}</dd></div><div><dt>Amount paid</dt><dd>{money(bill.balance.amountPaid)}</dd></div><div className="customer-pending"><dt>Pending amount</dt><dd>{money(bill.balance.pending)}</dd></div></dl>{bill.payments.length > 0 && <Collapsible><CollapsibleTrigger className="customer-payment-toggle">View recorded payments ({bill.payments.length})</CollapsibleTrigger><CollapsibleContent><ul className="customer-payment-list">{bill.payments.map((payment, i) => <li key={i}><span>{dateText(payment.date)} · {payment.method}</span><strong>{money(payment.amount)}</strong></li>)}</ul></CollapsibleContent></Collapsible>}<p className="customer-help">This is the balance for this weekly bill. Payments are shown as recorded by the business owner.</p></section>
      <section className="panel customer-correction-form" id="correction-form"><h2>Something needs checking?</h2><p>Tell the business owner what needs correcting. Your bill will change only after they review and save an edit.</p><form onSubmit={send}><div className="customer-request-fields"><label id="correction-day-label">Which day?<Select value={day} disabled={sending} onValueChange={value => { setDay(value); editRequest(); }}><SelectTrigger aria-labelledby="correction-day-label"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Whole bill</SelectItem>{bill.days.map((d, i) => <SelectItem key={d.date} value={String(i)}>{dateText(d.date)}</SelectItem>)}</SelectContent></Select></label><label id="correction-category-label">What needs checking?<Select value={category} disabled={sending} onValueChange={value => { setCategory(value); editRequest(); }}><SelectTrigger aria-labelledby="correction-category-label"><SelectValue /></SelectTrigger><SelectContent>{CORRECTION_CATEGORIES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></label></div><label htmlFor="correction-message">Your message<Textarea id="correction-message" value={message} onChange={event => { setMessage(event.target.value); editRequest(); }} minLength={5} maxLength={1000} required disabled={sending} placeholder="For example: Please check Tuesday’s M quantity. I supplied 1 Chandu and 200 buds." /></label><Button type="submit" disabled={sending || loading || message.trim().length < 5 || bill.requests.filter(item => item.status === "pending").length >= 5}>{sending ? "Sending…" : "Send correction request"}</Button>{bill.requests.filter(item => item.status === "pending").length >= 5 && <p className="customer-help">You have 5 requests waiting. Please wait for the owner’s review.</p>}</form>{notice && <p role="status" className="customer-success">{notice}</p>}</section>
      {bill.requests.length > 0 && <section className="panel customer-request-history"><h2>Your requests</h2><p className="customer-help">Refresh this page to see replies.</p>{bill.requests.map(item => <article className="correction-card" key={item.id}><div className="correction-heading"><strong>{item.category}</strong><span className={`correction-status ${item.status}`}>{item.status === "pending" ? "Waiting for review" : item.status === "resolved" ? "Resolved" : "Not changed"}</span></div><p className="customer-help">{item.dayIndex === null ? "Whole bill" : dateText(bill.days[item.dayIndex].date)} · {new Date(item.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p><p className="correction-message">{item.message}</p>{item.reply && <div className="correction-reply"><strong>Owner’s reply</strong><p>{item.reply}</p></div>}</article>)}</section>}
      <footer className="customer-page-footer"><p>Updated {new Date(bill.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p><p>This link expires {new Date(bill.expiresAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}. Keep it private.</p></footer>
    </>}
  </main>;
}
