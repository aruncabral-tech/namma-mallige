"use client";
import { useCallback, useEffect, useState } from "react";
import { Copy, Link2, MessageSquare, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accountRequest } from "@/lib/bills-client";
import { flowerDate } from "@/lib/daily-prices";
import type { AccessState, OwnerCorrection } from "@/lib/customer-bill-types";

const dateText = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const errorText = (error: unknown) => error instanceof Error ? error.message : "Could not complete this request. Please retry.";
type BillInfo = { id: string; version: number; customer: string; billNo: string; weekStart: string };

export function CustomerAccessDialog({ bill, onClose }: { bill: BillInfo; onClose: () => void }) {
  const [access, setAccess] = useState<AccessState | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState<"create" | "revoke" | null>(null);
  const refresh = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const response = await accountRequest(`/api/customer-access?billId=${encodeURIComponent(bill.id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAccess(data.access);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }, [bill.id]);
  useEffect(() => { void refresh(); }, [refresh]);
  async function changeLink(action: "create" | "revoke") {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await accountRequest("/api/customer-access", { method: action === "create" ? "POST" : "DELETE", body: JSON.stringify({ billId: bill.id, ...(action === "create" ? { version: bill.version } : {}), confirmed: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (action === "create") { setUrl(new URL(data.path, window.location.origin).href); setAccess(data.access); setNotice("Link created. Copy it now and share it with this customer."); }
      else { setUrl(""); setAccess({ active: false, reason: "revoked", expiresAt: null }); setNotice("Link turned off. Your saved bill is kept."); }
    } catch (e) { setError(errorText(e)); setUrl(""); }
    finally { setBusy(false); setConfirm(null); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setNotice("Link copied. You can send it to this customer."); }
    catch { setNotice("Select the full link below and copy it."); }
  }
  return <>
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="customer-dialog"><DialogHeader><DialogTitle>Customer bill link</DialogTitle><DialogDescription>{bill.customer} · {bill.billNo}<br />{dateText(bill.weekStart)} – {dateText(flowerDate(bill.weekStart, 6))}</DialogDescription></DialogHeader>
      <div className="customer-link-explanation"><ShieldCheck aria-hidden="true" /><p>Anyone with this link can view this saved bill, its payments and pending amount, and request a correction. Share it only with this customer.</p></div>
      <p>The page shows your latest saved entries. The link expires after 30 days, and you can turn it off at any time.</p>
      {access && <div className="customer-link-status"><strong>{access.active ? "Link is active" : access.reason === "recipient_changed" ? "Customer details changed — create a new link" : access.reason === "expired" ? "Link expired" : "No active link"}</strong>{access.active && access.expiresAt && <span>Expires {new Date(access.expiresAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}</span>}</div>}
      {url ? <div className="customer-link-copy"><label htmlFor="customer-bill-link">Private bill link<Input id="customer-bill-link" value={url} readOnly onFocus={event => event.target.select()} /></label><Button variant="outline" onClick={copy}><Copy /> Copy link</Button><p>Keep a copy. If you need another link later, creating one turns off the previous link.</p></div> : access?.active && <p className="customer-help">The full link is shown only when created. Create a replacement if you no longer have it.</p>}
      {notice && <p role="status" className="customer-success">{notice}</p>}{error && <p role="alert" className="quantity-error">{error}</p>}
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>{!access ? <Button disabled={busy} onClick={refresh}>{busy ? "Loading…" : "Retry"}</Button> : <><Button variant="outline" disabled={busy || !access.active} onClick={() => setConfirm("revoke")}>Turn off link</Button><Button disabled={busy} onClick={() => setConfirm("create")}><Link2 /> {access.active ? "Create replacement" : "Create link"}</Button></>}</DialogFooter>
    </DialogContent></Dialog>
    <AlertDialog open={confirm !== null} onOpenChange={open => { if (!open && !busy) setConfirm(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm === "revoke" ? "Turn off this customer’s link?" : access?.active ? "Replace this customer’s link?" : "Share this weekly bill?"}</AlertDialogTitle><AlertDialogDescription>{confirm === "revoke" ? "The customer will no longer be able to open this link. Their bill and submitted requests will be kept." : `${bill.customer} will be able to view this bill using the link. Any previous link for this bill will stop working.`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={event => { event.preventDefault(); if (confirm) void changeLink(confirm); }}>{busy ? "Please wait…" : confirm === "revoke" ? "Turn off link" : "Create link"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}

function RequestReview({ item, disabled, onOpenBill, onReviewed }: { item: OwnerCorrection; disabled: boolean; onOpenBill: (id: string) => Promise<void>; onReviewed: () => void }) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function review(status: "resolved" | "declined") {
    if (busy || disabled) return;
    setBusy(true); setError("");
    try {
      const response = await accountRequest("/api/customer-requests", { method: "POST", body: JSON.stringify({ id: item.id, status, reply }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onReviewed();
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }
  async function openBill() {
    setBusy(true); setError("");
    try { await onOpenBill(item.billId); }
    catch (e) { setError(errorText(e)); setBusy(false); }
  }
  return <article className="correction-card">
    <div className="correction-heading"><div><h3>{item.customer}</h3><p>{item.billNo} · {dateText(item.weekStart)}</p></div><span className={`correction-status ${item.status}`}>{item.status === "pending" ? "Waiting" : item.status === "resolved" ? "Resolved" : "Not changed"}</span></div>
    <p><strong>{item.category}</strong> · {item.dayIndex === null ? "Whole bill" : dateText(flowerDate(item.weekStart, item.dayIndex))}</p>
    <p className="correction-message">{item.message}</p><p className="customer-help">Received {new Date(item.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST{item.currentVersion !== item.billVersion ? " · Bill updated since this request" : ""}</p>
    {item.status === "pending" ? <><Button variant="outline" disabled={busy || disabled} onClick={openBill}>Open bill to check / edit</Button><label htmlFor={`reply-${item.id}`}>Your reply to the customer<Textarea id={`reply-${item.id}`} value={reply} maxLength={500} onChange={event => setReply(event.target.value)} placeholder="Explain what you checked or corrected." disabled={busy} /></label><div className="correction-actions"><Button disabled={busy || disabled || !reply.trim()} onClick={() => review("resolved")}>Mark resolved</Button><Button variant="outline" disabled={busy || disabled || !reply.trim()} onClick={() => review("declined")}>Keep bill unchanged</Button></div></> : <div className="correction-reply"><strong>Your reply</strong><p>{item.reply}</p></div>}
    {error && <p role="alert" className="quantity-error">{error}</p>}
  </article>;
}

export function CustomerRequests({ dirty, onOpenBill }: { dirty: boolean; onOpenBill: (id: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<OwnerCorrection[]>([]);
  const [pending, setPending] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const response = await accountRequest(`/api/customer-requests?status=${status}&page=${page}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!controller.signal.aborted) { setItems(data.requests); setHasMore(data.hasMore); setPending(data.pendingCount); }
      } catch (e) { if (!controller.signal.aborted) setError(errorText(e)); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [open, status, page, revision]);
  return <><Button variant="outline" onClick={() => setOpen(true)}><MessageSquare /> Customer requests{pending > 0 && <span className="request-count">{pending}</span>}</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="customer-dialog customer-requests-dialog"><DialogHeader><DialogTitle>Customer correction requests</DialogTitle><DialogDescription>Check the bill and save any edits before marking a request resolved. Replies appear on the customer’s bill page.</DialogDescription></DialogHeader>
      <div className="correction-toolbar"><Tabs value={status} onValueChange={value => { setStatus(value); setPage(0); }}><TabsList><TabsTrigger value="pending">Waiting ({pending})</TabsTrigger><TabsTrigger value="reviewed">Reviewed</TabsTrigger></TabsList></Tabs><Button variant="outline" size="icon" aria-label="Refresh requests" disabled={loading} onClick={() => setRevision(n => n + 1)}><RefreshCw /></Button></div>
      <p className="customer-help">Requests come from people with a bill link. Reviewing a request does not change the bill automatically.</p>
      {dirty && <p className="quantity-error">Save your open bill’s changes before reviewing requests.</p>}
      {loading ? <p role="status">Loading requests…</p> : error ? <p role="alert" className="quantity-error">{error}</p> : !items.length ? <p className="customer-empty">{status === "pending" ? "No requests waiting. Customer requests will appear here." : "No reviewed requests on this page."}</p> : <div className="correction-list">{items.map(item => <RequestReview key={item.id} item={item} disabled={dirty} onOpenBill={async id => { await onOpenBill(id); setOpen(false); }} onReviewed={() => setRevision(n => n + 1)} />)}</div>}
      {(page > 0 || hasMore) && <div className="correction-actions"><Button variant="outline" disabled={loading || page === 0} onClick={() => setPage(n => n - 1)}>Previous</Button><span>Page {page + 1}</span><Button variant="outline" disabled={loading || !hasMore} onClick={() => setPage(n => n + 1)}>Next</Button></div>}
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Close</Button></DialogFooter>
    </DialogContent></Dialog></>;
}
