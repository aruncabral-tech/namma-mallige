"use client";
import { LandingPage } from "@/components/landing-page";
import { SubscriptionAccess } from "@/components/subscription-access";
import {T, LanguagePicker} from "@/components/language";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookOpen, CalendarDays, Copy, Flower2, LoaderCircle, LockKeyhole, Wallet } from "lucide-react";
import { accountRequest, setBillingOwner } from "@/lib/bills-client";
import { APP_HEADLINE, APP_NAME, type OwnerAccount, type AccountType } from "@/lib/account-types";

export function Brand({ large = false }: { large?: boolean }) {
 const [headline,setHeadline]=useState(APP_HEADLINE);useEffect(()=>{fetch("/api/site-content").then(r=>r.ok?r.json():null).then(d=>{if(d?.headline)setHeadline(d.headline);}).catch(()=>{});},[]);
  return <div className={`brand ${large ? "auth-brand" : ""}`}>
    <span className="brand-logo"><img src="/brand-logo.png" alt="Namma Mallige jasmine flower logo" width="72" height="72" /></span>
    <div><h1>{APP_NAME}</h1>{!large && <p>{headline}</p>}</div>
  </div>;
}

export function RecoveryNotice({ code, onContinue }: { code: string; onContinue: () => void }) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  return <section className="recovery-notice">
    <LockKeyhole /><h2><T text="Save your recovery code"/></h2>
    <p>Keep this code somewhere private. It lets you reset your 4-digit MPIN if you forget it. Each code can be used once.</p>
    <code>{code}</code>
    <Button type="button" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); } catch { setCopied(false); } }}><Copy />{copied ? "Copied" : "Copy recovery code"}</Button>
    <label className="acknowledge"><input type="checkbox" checked={saved} onChange={e => setSaved(e.target.checked)} />I have saved this code safely</label>
    <Button type="button" disabled={!saved} onClick={onContinue}><T text="Continue to my book"/></Button>
  </section>;
}

type AccountMode = "login" | "password" | "register" | "recover";

export function AccountForm({ existingPhone, onSignedIn }: { existingPhone?: string; onSignedIn?: (owner: OwnerAccount) => void }) {
  const [mode, setMode] = useState<AccountMode>(existingPhone ? "register" : "login");
  const [ownerName, setOwnerName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("business");
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState(existingPhone ?? "");
  const [mpin, setMpin] = useState("");
  const [confirmMpin, setConfirmMpin] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [created, setCreated] = useState<{ owner: OwnerAccount; recoveryCode: string } | null>(null);
  const [groupInvite, setGroupInvite] = useState<OwnerAccount | null>(null);
  const [groupOpened, setGroupOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const registration = mode === "register";
  const recovery = mode === "recover";
  const passwordLogin = mode === "password";

  const finish = (owner: OwnerAccount) => { setBillingOwner(owner.id); if (onSignedIn) onSignedIn(owner); else window.location.assign("/"); };
  const resetFields = () => { setMpin(""); setConfirmMpin(""); setPassword(""); setRecoveryCode(""); setError(""); };
  const choose = (value: AccountMode) => { setMode(value); setCreated(null); resetFields(); };

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if ((registration || recovery) && mpin !== confirmMpin) { setError("The two MPINs do not match."); return; }
    setBusy(true);
    try {
      setBillingOwner("");
      const payload = registration
        ? { action: "register", ownerName, accountType, companyName, location, phone, mpin }
        : recovery
          ? { action: "recover", phone, recoveryCode: recoveryCode.trim(), mpin }
          : passwordLogin
            ? { action: "login", phone, password }
            : { action: "login", phone, mpin };
      const response = await accountRequest("/api/account/auth", { method: "POST", body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      resetFields();
      if (data.recoveryCode) setCreated(data); else finish(data.owner);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Please try again."); }
    finally { setBusy(false); }
  }

  return <main className="auth-shell">
    <div className="auth-identity"><Brand large /><div className="auth-intro"><span className="auth-overline">ROOTED IN SHIRVA · MADE FOR YOUR EVERYDAY</span><h2>Beautiful blooms.<br/><em>Beautifully managed.</em></h2><p>Where Beautiful Blooms Meet Happy Clients.</p><div className="auth-brand-art"><img src="/brand-logo.png" alt="" width="180" height="180"/><div><span>THE NAMMA MALLIGE WAY</span><strong>Every flower counts.</strong><p>From your first daily entry to your Saturday bill.</p></div></div><ul className="auth-features"><li><Flower2 aria-hidden="true"/><span>Daily M & J flower entries</span></li><li><CalendarDays aria-hidden="true"/><span>Seven-day records, ready for Saturday</span></li><li><Wallet aria-hidden="true"/><span>Clear payments and pending balances</span></li></ul></div><p className="auth-footnote">Arun Cabral · Shirva</p></div>
    <section className="auth-card"><div className="auth-tools"><span><BookOpen aria-hidden="true"/> Your flower account</span><LanguagePicker compact/></div>
      {groupInvite ? <section className="recovery-notice">
        <Flower2/><h2>Welcome to the {groupInvite.accountType === "business" ? "business" : "personal users’"} community</h2>
        <p>Join the Namma Mallige {groupInvite.accountType === "business" ? "business" : "personal"} users’ WhatsApp group for help, app updates and suggestions.</p>
        <p className="field-help">Joining is optional. Other group members can see your phone number. Never share your MPIN or recovery code.</p>
        <Button asChild><a href={groupInvite.accountType === "business" ? "https://chat.whatsapp.com/DhRiNApxEi8CpMUg9N7hjI?s=cl&p=a&mlu=4" : "https://chat.whatsapp.com/BSjViEEx7ya250v5f7MPQp?s=cl&p=a&mlu=4"} target="_blank" rel="noopener noreferrer" onClick={() => setGroupOpened(true)}>Join {groupInvite.accountType === "business" ? "business" : "personal users’"} group</a></Button>
        {groupOpened && <p role="status">Complete joining in WhatsApp, then continue to your book.</p>}
        <Button variant="outline" onClick={() => finish(groupInvite)}>{groupOpened ? "Continue to my book" : "Skip and open my book"}</Button>
      </section> : created ? <RecoveryNotice code={created.recoveryCode} onContinue={() => { if(registration) { setGroupInvite(created.owner); setCreated(null); } else finish(created.owner); }} /> : <>
        <p className="eyebrow">{registration ? "Personal or business" : recovery ? "Account recovery" : "NAMMA MALLIGE"}</p>
        <h2><T text={mode === "login" ? "Welcome back" : mode === "password" ? "Use account password once" : recovery ? "Reset your MPIN" : "Create your account"}/></h2>
        <p className="auth-description">{mode === "login" ? "Sign in with your WhatsApp number and 4-digit MPIN." : mode === "password" ? "This one-time option keeps older accounts accessible. Set an MPIN in My book after signing in." : recovery ? "Use the recovery code you saved when creating your account." : "Choose personal or business details. You can update your book profile later."}</p>
        {recovery && <p className="field-help">Original app owner without a recovery code? <a href="/owner-reset">Verify ownership and start a new book</a>.</p>}
        <form onSubmit={submit} className="account-form">
          {registration && <label htmlFor="owner-name"><T text="Full name"/><Input id="owner-name" autoComplete="name" required minLength={2} maxLength={100} value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Your full name" /></label>}
          {registration && <fieldset className="account-type-field"><legend><T text="Account type"/></legend><div className="account-type-choice"><button type="button" aria-pressed={accountType === "business"} className={accountType === "business" ? "selected" : ""} onClick={() => setAccountType("business")}><BookOpen aria-hidden="true"/><b><T text="Business owner"/></b><span>Customer books and weekly bills</span></button><button type="button" aria-pressed={accountType === "personal"} className={accountType === "personal" ? "selected" : ""} onClick={() => setAccountType("personal")}><Flower2 aria-hidden="true"/><b><T text="Personal"/></b><span>Your flower diary and earnings</span></button></div></fieldset>}
          {registration && accountType === "business" && <label htmlFor="company-name"><T text="Katte / company name"/><Input id="company-name" required maxLength={150} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Your business or katte name" autoComplete="organization" /></label>}
          {registration && <label htmlFor="account-location"><T text="Location"/> {accountType === "business" && <span className="field-optional">(required for business)</span>}<Input id="account-location" required={accountType === "business"} maxLength={200} value={location} onChange={e => setLocation(e.target.value)} placeholder="Village, town or market" autoComplete="address-level2" /></label>}
          <label htmlFor="login-phone"><T text="WhatsApp number"/><Input id="login-phone" type="tel" autoComplete="username" required maxLength={40} value={phone} onChange={e => setPhone(e.target.value)} readOnly={Boolean(existingPhone)} placeholder="+91 98765 43210" /></label>
          {recovery && <label htmlFor="recovery-code"><T text="Recovery code"/><Input id="recovery-code" autoComplete="off" required value={recoveryCode} maxLength={64} onChange={e => setRecoveryCode(e.target.value)} /></label>}
          {passwordLogin ? <label htmlFor="account-password">Account password<Input id="account-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e => setPassword(e.target.value)} /></label> : <>
            {!recovery && <label htmlFor="login-mpin"><T text={registration ? "Choose a 4-digit MPIN" : "4-digit MPIN"}/><Input id="login-mpin" inputMode="numeric" pattern="[0-9]{4}" autoComplete={registration ? "new-password" : "current-password"} type="password" required minLength={4} maxLength={4} value={mpin} onChange={e => setMpin(e.target.value.replace(/\D/g, "").slice(0, 4))} /></label>}
            {recovery && <label htmlFor="reset-mpin">New 4-digit MPIN<Input id="reset-mpin" inputMode="numeric" pattern="[0-9]{4}" autoComplete="new-password" type="password" required minLength={4} maxLength={4} value={mpin} onChange={e => setMpin(e.target.value.replace(/\D/g, "").slice(0, 4))} /></label>}
            {(registration || recovery) && <label htmlFor="confirm-mpin">Confirm 4-digit MPIN<Input id="confirm-mpin" inputMode="numeric" pattern="[0-9]{4}" autoComplete="new-password" type="password" required minLength={4} maxLength={4} value={confirmMpin} onChange={e => setConfirmMpin(e.target.value.replace(/\D/g, "").slice(0, 4))} /></label>}
          </>}
          {error && <p className="quantity-error" role="alert">{error}</p>}
          <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="spin" />}<T text={busy ? "Please wait…" : mode === "login" ? "Sign in" : passwordLogin ? "Open my book" : recovery ? "Reset MPIN" : "Create my account"}/></Button>
        </form>
        <div className="auth-links">{mode === "login" || passwordLogin ? <><Button variant="ghost" onClick={() => choose("register")}><T text="New owner? Create account"/></Button>{mode === "login" && <><Button variant="link" onClick={() => choose("recover")}><T text="Forgot MPIN?"/></Button></>}</> : <Button variant="ghost" onClick={() => choose("login")}><T text="Back to sign in"/></Button>}</div>
        <p className="field-help auth-password-note"><LockKeyhole aria-hidden="true"/><span>Your number is your login ID. Keep your MPIN and recovery code private.</span></p>
      </>}
    </section>
  </main>;
}

export function AccountGate({ children, landing = false }: { landing?: boolean; children: (owner: OwnerAccount, update: (owner: OwnerAccount) => void, signedOut: () => void) => ReactNode }) {
  const [owner, setOwner] = useState<OwnerAccount | null>(null);
  const [showSignIn,setShowSignIn]=useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const update = (nextOwner: OwnerAccount) => { setBillingOwner(nextOwner.id); setOwner(nextOwner); };
  const load = async () => {
    setLoading(true); setError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    try { const response = await accountRequest("/api/account", { signal: controller.signal }); const data = await response.json(); if (!response.ok) throw new Error(data.error); if (data.owner) update(data.owner); else { setOwner(null); setBillingOwner(""); } }
    catch (caught) {
      setOwner(null); setBillingOwner("");
      setError(caught instanceof DOMException && caught.name === "AbortError" ? "Account check is taking too long. You can still open the app and sign in." : caught instanceof Error ? caught.message : "Could not check your sign-in. Please retry.");
    }
    finally { window.clearTimeout(timer); setLoading(false); }
  };
  useEffect(() => { void load(); const expired=()=>{setBillingOwner("");setOwner(null);setError("");setLoading(false);}; window.addEventListener("account-session-expired",expired);return()=>window.removeEventListener("account-session-expired",expired); }, []);
  if (loading) {
    if (landing && !showSignIn) return <LandingPage onSignIn={() => setShowSignIn(true)} />;
    return <main className="account-loading"><Brand /><p role="status">Opening your account…</p></main>;
  }
  if (error && landing && !showSignIn) return <LandingPage onSignIn={()=>setShowSignIn(true)} />;
  if (error) return <main className="account-loading"><Brand /><p role="alert">{error}</p><Button onClick={() => void load()}>Retry</Button><Button variant="outline" onClick={() => { setError(""); setOwner(null); setBillingOwner(""); }}>Open sign in</Button></main>;
  if (!owner && landing && !showSignIn) return <LandingPage onSignIn={()=>setShowSignIn(true)} />;
  if (!owner) return <><a className="landing-back" href="/">Back to Namma Mallige</a><AccountForm onSignedIn={update} /></>;
  const signedOut = () => { setBillingOwner(""); setOwner(null); };
  return <SubscriptionAccess key={owner.id} owner={owner} onSignOut={signedOut}>{children(owner, update, signedOut)}</SubscriptionAccess>;
}
