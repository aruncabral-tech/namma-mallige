import { ArrowLeft, Mail, MessageCircle, Phone, Printer, Sheet, Sprout } from "lucide-react";
import Link from "next/link";

const phone = "8971891245";
const email = "ARUN.CABRAL54@GMAIL.COM";

export const metadata = {
  title: "Help & Support | Namma Mallige",
  description: "How to use Namma Mallige, set up printing, connect Google Sheets, and contact developer support.",
};

export default function HelpPage() {
  return <main className="help-shell">
    <header className="help-hero">
      <Link className="help-back" href="/"><ArrowLeft /> Back to Namma Mallige</Link>
      <p className="help-kicker">HELP & SUPPORT</p>
      <h1>Namma Mallige setup guide</h1>
      <p>Use this page for daily entry, Saturday bill printing, Google Sheets backup, and developer support.</p>
      <div className="help-contact-actions">
        <a href={`tel:+91${phone}`}><Phone /> Call developer</a>
        <a href={`https://wa.me/91${phone}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>
        <a href={`mailto:${email}`}><Mail /> Email</a>
      </div>
    </header>

    <section className="help-grid" aria-label="Help topics">
      <article className="help-card">
        <Sprout />
        <h2>Daily work</h2>
        <ol>
          <li>Open <strong>Daily prices</strong> and set M and J price per atte.</li>
          <li>Go to <strong>Daily entry</strong>, choose customer and week.</li>
          <li>Enter chandu and extra buds for M and J.</li>
          <li>Save before WhatsApp sharing or printing.</li>
        </ol>
      </article>

      <article className="help-card">
        <Printer />
        <h2>Printer setup</h2>
        <ol>
          <li>Select <strong>Tramble · 80 (76) × 210 mm</strong>.</li>
          <li>Paper size: <strong>80 mm × 210 mm</strong>.</li>
          <li>Browser print scale: <strong>100%</strong>.</li>
          <li>Headers and footers: <strong>Off</strong>.</li>
          <li>If cutting, use Trouble printing size <strong>90%</strong> or <strong>95%</strong>.</li>
          <li>If too small, use <strong>105%</strong> or <strong>110%</strong>.</li>
        </ol>
      </article>

      <article className="help-card">
        <Sheet />
        <h2>Google Sheets sync</h2>
        <ol>
          <li>Create a Google Sheet for Namma Mallige records.</li>
          <li>Open Extensions → Apps Script.</li>
          <li>Create a Web app that accepts POST data.</li>
          <li>Deploy and copy the <strong>/exec</strong> URL.</li>
          <li>Paste it in <strong>My book & account → Google Sheets sync & backup</strong>.</li>
        </ol>
        <p>Manual CSV backup is also available from the same settings screen.</p>
      </article>

      <article className="help-card">
        <MessageCircle />
        <h2>Developer support</h2>
        <p><strong>Developed by Arun Cabral · Shirva</strong></p>
        <p>Phone / WhatsApp: <a href={`https://wa.me/91${phone}`} target="_blank" rel="noreferrer">{phone}</a></p>
        <p>Email: <a href={`mailto:${email}`}>{email}</a></p>
      </article>
    </section>
  </main>;
}
