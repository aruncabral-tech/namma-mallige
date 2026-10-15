"use client";
import {T} from "@/components/language";

import { BackupRestore } from "@/components/backup-restore";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Copy, Download, ExternalLink, KeyRound, Save } from "lucide-react";
import { accountRequest } from "@/lib/bills-client";
import { APP_NAME, type AccountType, type OwnerAccount } from "@/lib/account-types";
import { RecoveryNotice } from "@/components/account-gate";

export function BookSettings({ owner, open, onOpenChange, onSaved }: { owner: OwnerAccount; open: boolean; onOpenChange: (open: boolean) => void; onSaved: (owner: OwnerAccount) => void }) {
  const [ownerName, setOwnerName] = useState(owner.ownerName);
  const [accountType, setAccountType] = useState<AccountType>(owner.accountType);
  const [companyName, setCompanyName] = useState(owner.companyName);
  const [location, setLocation] = useState(owner.location);
  const [googleSheetUrl, setGoogleSheetUrl] = useState(owner.googleSheetUrl);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [currentMpin, setCurrentMpin] = useState("");
  const [mpin, setMpin] = useState("");
  const [confirmMpin, setConfirmMpin] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const incomplete = !owner.mpinConfigured || (owner.accountType === "business" && (!owner.companyName || !owner.location));
  const profileIncomplete = accountType === "business" && (!companyName.trim() || !location.trim());
  const cleanMpin = (value: string) => value.replace(/\D/g, "").slice(0, 4);
  const displayName = owner.companyName || owner.ownerName;

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const response = await accountRequest("/api/account", { method: "PATCH", body: JSON.stringify({ ownerName, accountType, companyName, location, googleSheetUrl }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      onSaved(data.owner);
      if (data.owner.mpinConfigured && !(data.owner.accountType === "business" && (!data.owner.companyName || !data.owner.location))) onOpenChange(false);
      else setMessage("Profile saved. Create your 4-digit MPIN below to finish setup.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save book details."); }
    finally { setBusy(false); }
  }

  async function changeMpin(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (mpin.length !== 4 || mpin !== confirmMpin) { setError("Enter the same 4-digit MPIN twice."); return; }
    setBusy(true);
    try {
      const response = await accountRequest("/api/account/mpin", { method: "POST", body: JSON.stringify({ currentMpin: currentMpin || undefined, mpin, confirmMpin }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setCurrentMpin(""); setMpin(""); setConfirmMpin(""); setRecoveryCode(data.recoveryCode);
      const profileResponse = await accountRequest("/api/account"); const profile = await profileResponse.json(); if (profileResponse.ok && profile.owner) onSaved(profile.owner);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update MPIN."); }
    finally { setBusy(false); }
  }

  async function exportSheets() {
    setExportBusy(true); setError(""); setMessage("");
    try {
      const response = await accountRequest("/api/google-sheets/export");
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Could not prepare the Sheets file."); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "Namma-Mallige-google-sheets.csv"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      setMessage("Sheets-compatible file downloaded. Open it with Google Sheets and save it to Drive.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not download the Sheets file."); }
    finally { setExportBusy(false); }
  }

  return <Dialog open={open} onOpenChange={value => { if (!busy && !incomplete && !recoveryCode) onOpenChange(value); }}>
    <DialogContent className="book-settings-dialog" showCloseButton={!incomplete && !recoveryCode}>
      <DialogHeader><DialogTitle>{incomplete ? "Set up your Namma Mallige book" : "My book & account"}</DialogTitle><DialogDescription>Your profile appears on printed Saturday bills and daily WhatsApp messages. Daily flower prices stay fixed once saved for that date.</DialogDescription></DialogHeader>
      {recoveryCode ? <RecoveryNotice code={recoveryCode} onContinue={() => { setRecoveryCode(""); setMessage("MPIN updated. Other devices will need to sign in again."); }} /> : <>
        <form className="account-form" onSubmit={save}>
          <label htmlFor="book-owner"><T text="Full name"/><Input id="book-owner" value={ownerName} required minLength={2} maxLength={100} onChange={e => setOwnerName(e.target.value)} autoComplete="name" /></label>
          <fieldset className="account-type-field"><legend><T text="Account type"/></legend><div className="account-type-choice"><button type="button" className={accountType === "business" ? "selected" : ""} onClick={() => setAccountType("business")}><b><T text="Business owner"/></b><span>Katte / company customer book</span></button><button type="button" className={accountType === "personal" ? "selected" : ""} onClick={() => setAccountType("personal")}><b><T text="Personal"/></b><span>Use your own name and place</span></button></div></fieldset>
          <label htmlFor="book-company"><T text="Katte / company name"/> <span className="field-optional">{accountType === "business" ? "(required)" : "(optional)"}</span><Input id="book-company" value={companyName} required={accountType === "business"} maxLength={150} onChange={e => setCompanyName(e.target.value)} placeholder="Business, katte or company name" autoComplete="organization" /></label>
          <label htmlFor="book-location"><T text="Location"/> <span className="field-optional">{accountType === "business" ? "(required)" : "(optional)"}</span><Input id="book-location" value={location} required={accountType === "business"} maxLength={200} onChange={e => setLocation(e.target.value)} placeholder="Village, town or market" autoComplete="address-level2" /></label>
          <label>Owner’s WhatsApp / login number<Input value={owner.phone} readOnly /></label>
          {profileIncomplete && <p className="field-help">Business accounts need both a katte/company name and a location before the book can be closed.</p>}
          <Button type="submit" disabled={busy}><Save />{busy ? "Saving…" : "Save book details"}</Button>
        </form>
        <BackupRestore/><section className="google-sheet-section"><div><h3>Google Sheets sync & backup</h3><p>Paste a Google Apps Script web-app URL to auto-sync every saved bill and daily price. You can still download the CSV backup and open it in Google Sheets anytime.</p></div><div className="google-sheet-actions"><a href="https://drive.google.com/drive/my-drive" target="_blank" rel="noreferrer"><ExternalLink />Open Google Drive</a><label htmlFor="google-sheet-url">Google Sheet sync web-app URL <span className="field-optional">(optional)</span><Input id="google-sheet-url" type="url" value={googleSheetUrl} onChange={e => setGoogleSheetUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" /></label><p className="field-help">Example: create a Google Apps Script for your Sheet, deploy it as a Web app, then paste the /exec URL here.</p><Button type="button" variant="outline" onClick={exportSheets} disabled={exportBusy}><Download />{exportBusy ? "Preparing…" : "Download backup (.csv)"}</Button>{googleSheetUrl && <a href={googleSheetUrl} target="_blank" rel="noreferrer">Open sync URL</a>}</div></section>
        <Collapsible className="billing-guide"><CollapsibleTrigger className="disclosure-trigger">How to use your book<ChevronDown /></CollapsibleTrigger><CollapsibleContent><ol><li><strong>Set daily prices.</strong> Save M (jasmine) and J (pink jasmine) rates per atte in Daily prices. The saved rates stay fixed for every customer on that date.</li><li><strong>Record each customer’s flowers.</strong> Choose their weekly bill, select the day, and enter whole chandu and extra buds separately. One chandu is 800 buds; one atte is 3,200 buds.</li><li><strong>Save before sharing.</strong> Save entries, then use WhatsApp to open the customer’s prepared message. Review it and tap Send in WhatsApp.</li><li><strong>Finish the Saturday bill.</strong> Check all seven days, old pending amount and payments. Print the weekly bill using your receipt or sheet paper size.</li></ol><p className="field-help">On printed bills, 1 chandu + 200 buds appears as 1.200 Chandu. If there are only 200 buds, it appears as 200.</p></CollapsibleContent></Collapsible><Collapsible className="mpin-section"><CollapsibleTrigger className="disclosure-trigger"><KeyRound /> {owner.mpinConfigured ? "Change 4-digit MPIN" : "Create 4-digit MPIN"}<ChevronDown /></CollapsibleTrigger><CollapsibleContent><form className="account-form password-form" onSubmit={changeMpin}>
          {owner.mpinConfigured && <label htmlFor="current-mpin">Current MPIN<Input id="current-mpin" inputMode="numeric" pattern="[0-9]{4}" type="password" required maxLength={4} value={currentMpin} onChange={e => setCurrentMpin(cleanMpin(e.target.value))} /></label>}
          <label htmlFor="new-mpin">New 4-digit MPIN<Input id="new-mpin" inputMode="numeric" pattern="[0-9]{4}" type="password" required minLength={4} maxLength={4} value={mpin} onChange={e => setMpin(cleanMpin(e.target.value))} /></label>
          <label htmlFor="new-mpin-confirm">Confirm 4-digit MPIN<Input id="new-mpin-confirm" inputMode="numeric" pattern="[0-9]{4}" type="password" required minLength={4} maxLength={4} value={confirmMpin} onChange={e => setConfirmMpin(cleanMpin(e.target.value))} /></label>
          <p className="field-help">Changing the MPIN signs out other devices and creates a new one-time recovery code.</p><Button type="submit" disabled={busy}>Update MPIN</Button>
        </form></CollapsibleContent></Collapsible>
        {!incomplete && <div className="access-details"><h3>Access on another phone or PC</h3><p>Use the app address and this owner’s WhatsApp number. Share the MPIN only with trusted people.</p><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`${APP_NAME}\n${displayName}\nOwner: ${owner.ownerName}\nLogin number: ${owner.phone}\n${window.location.origin}/`); setMessage("App address and login number copied. Share the MPIN separately."); } catch { setError("Could not copy. You can copy your number and the app address manually."); } }}><Copy />Copy login details</Button></div>}
        {message && <p role="status" className="field-help">{message}</p>}{error && <p role="alert" className="quantity-error">{error}</p>}
      </>}
    </DialogContent>
  </Dialog>;
}
