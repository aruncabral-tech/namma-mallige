"use client";
import {DailyBillImage} from "@/components/daily-bill-image";
import {SponsorSpace} from "@/components/sponsor-space";
import { MonthlyReports } from "@/components/monthly-reports";
import { CustomerAccessDialog, CustomerRequests } from "@/components/customer-access";
import {LiveAppUpdate} from "@/components/live-app-update";
import {AppUpdates} from "@/components/app-updates";
import {T, LanguagePicker} from "@/components/language";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { flushSync } from "react-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChartNoAxesCombined, Settings, LogOut, BookOpen, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Copy, Flower2, Info, IndianRupee, Link2, LoaderCircle, LockKeyhole, MessageCircle, Plus, Printer, RotateCcw, Save, Trash2 } from "lucide-react";

import { BUDS, flowerAmount, sumAmounts } from "@/lib/flower-calculation";
import { accountRequest, billsRequest, dailyPricesRequest } from "@/lib/bills-client";
import { FlowerQuantityInput } from "@/components/flower-quantity-input";
import { splitChenduAndBuds } from "@/lib/flower-quantity";
import { billBalance, isPaymentAmount, paymentSummary, type PaymentFields, type PaymentRecord } from "@/lib/bill-payments";
import { DailyPricesPanel } from "@/components/daily-prices-panel";
import { flowerDate, hasSavedFlowerPrice, todayInIndia, withDailyPrices, type DailyPrice, type FlowerDay } from "@/lib/daily-prices";
import { AccountGate, Brand } from "@/components/account-gate";
import { PaymentHistory } from "@/components/payment-history";
import { BookSettings } from "@/components/book-settings";
import { APP_NAME, type OwnerAccount } from "@/lib/account-types";
type Entry = FlowerDay;
const money = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
const iso = (date: Date) => [date.getFullYear(), String(date.getMonth()+1).padStart(2,"0"), String(date.getDate()).padStart(2,"0")].join("-");
const addDays = (start: string, days: number) => { const d = new Date(start + "T00:00:00"); d.setDate(d.getDate() + days); return d; };
const businessDate = () => addDays(todayInIndia(), 0);
const blankEntry = (): Entry => ({ jasmineQty: 0, jasmineUnit: "chendu", jasmineRate: 0, pinkQty: 0, pinkUnit: "chendu", pinkRate: 0 });
type Bill = PaymentFields & { id: string; version: number; customer: string; phone: string; weekStart: string; billNo: string; days: Entry[] };
const sunday = (date: Date) => { const d = new Date(date); d.setDate(d.getDate() - d.getDay()); return iso(d); };
const dayAmount = (d: Entry) => sumAmounts([flowerAmount(d.jasmineQty,d.jasmineUnit,d.jasmineRate), flowerAmount(d.pinkQty,d.pinkUnit,d.pinkRate)]);
const billAmount = (b: Bill) => sumAmounts(b.days.map(dayAmount));
const budsIn = (entries: Entry[]) => entries.reduce((total, day) => total + day.jasmineQty * BUDS[day.jasmineUnit] + day.pinkQty * BUDS[day.pinkUnit], 0);
const quantityNumber = (value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 6 });
const quantityText = (buds: number) => {
  const { chendus, extraBuds } = splitChenduAndBuds(buds, "buds");
  return `${quantityNumber(chendus)} ${chendus === 1 ? "chendu" : "chendus"} + ${quantityNumber(extraBuds)} buds`;
};
// Printed notation joins whole chandus and remaining buds; it is never used as a decimal quantity.
const printedQuantityText = (buds: number) => {
  const { chendus, extraBuds } = splitChenduAndBuds(buds, "buds");
  if (chendus === 0) return quantityNumber(extraBuds);
  if (!Number.isInteger(extraBuds)) return `${quantityNumber(chendus)} Chandu + ${quantityNumber(extraBuds)} buds`;
  return `${quantityNumber(chendus)}.${String(extraBuds).padStart(3, "0")} Chandu`;
};
const compactQuantityText = (buds: number) => {
  const { chendus, extraBuds } = splitChenduAndBuds(buds, "buds");
  if (chendus === 0) return quantityNumber(extraBuds);
  if (!Number.isInteger(extraBuds)) return `${quantityNumber(chendus)} + ${quantityNumber(extraBuds)}`;
  return `${quantityNumber(chendus)}.${String(extraBuds).padStart(3, "0")}`;
};
function QuantitySummary({ totalBuds }: { totalBuds: number }) {
  return <div className="quantity-total"><span>Total flowers · M + J</span><strong>{quantityText(totalBuds)}</strong><p>Total buds: <b>{quantityNumber(totalBuds)}</b></p></div>;
}
function PaymentTotals({ balance }: { balance: ReturnType<typeof paymentSummary> }) {
  return <dl className="payment-totals">
    <div><dt>This week’s flowers</dt><dd>{money(balance.flowerTotal)}</dd></div>
    <div><dt>Old pending amount</dt><dd>{money(balance.openingBalance)}</dd></div>
    <div className="payable-row"><dt><T text="Total payable"/></dt><dd>{money(balance.totalPayable)}</dd></div>
    <div><dt><T text="Amount paid"/></dt><dd>−{money(balance.amountPaid)}</dd></div>
    <div className="pending-row"><dt><T text="Pending amount"/></dt><dd>{balance.pending >= 0 ? money(balance.pending) : "Check payment"}</dd></div>
  </dl>;
}
function PrintedPaymentTotals({ balance }: { balance: ReturnType<typeof paymentSummary> }) {
  return <dl className="payment-totals">
    <div><dt>Previous Balance</dt><dd>{money(balance.openingBalance)}</dd></div>
    <div><dt>This Week Amount</dt><dd>{money(balance.flowerTotal)}</dd></div>
    {balance.amountPaid > 0 && <div><dt><T text="Amount paid"/></dt><dd>−{money(balance.amountPaid)}</dd></div>}
    <div className="pending-row"><dt>Total Balance</dt><dd>{balance.pending >= 0 ? money(balance.pending) : "Check payment"}</dd></div>
  </dl>;
}
const PRINT_FORMATS = {
  receiptCustom: { label: "Custom width / length", page: "size: auto; margin: 2mm;", help: "Set paper width and length below. Use 0 for automatic roll length. Match the paper in the device print dialog; the printer driver controls actual roll length." },
  receiptRoll60: { label: "60 mm thermal roll", page: "size: auto; margin: 2mm;", help: "Choose 60 mm roll paper in your printer settings. The bill uses a 56 mm printable area and continues as needed." },
  receiptTramble5: { label: "Tramble · 2.5 × 5 inches", page: "size: 2.5in 5in; margin: 2mm;", help: "Choose custom paper 2.5 inches wide × 5 inches high (63.5 × 127 mm). Long bills continue onto another page so no details are cut off." },
  receiptShort4: { label: "Short receipt · 2.5 × 4 inches", page: "size: 2.5in 4in; margin: 2mm;", help: "Choose custom paper 2.5 inches wide × 4 inches high (63.5 × 101.6 mm). Long bills continue onto another page." },
  receiptLong6: { label: "Long receipt · 2.5 × 6 inches", page: "size: 2.5in 6in; margin: 2mm;", help: "Choose custom paper 2.5 inches wide × 6 inches high (63.5 × 152.4 mm). Long bills continue onto another page." },
  receipt75long: { label: "Long weekly bill · 75 × 292 mm", page: "size: 75mm 292mm; margin: 2mm;", help: "Choose custom paper 75 mm wide × 292 mm high, with a 71 mm printable area." },
  receipt60: { label: "Tramble · 80 (76) × 210 mm", page: "size: 80mm 210mm; margin: 2mm;", help: "Choose custom paper 80 mm wide × 210 mm high. Set the printer print area to 76 mm, use 100% scale, and turn headers and footers off. Each customer bill is kept on one sheet with the grand total, balance, paid amount and pending amount." },
  receipt80: { label: "80 mm receipt / thermal printer", page: "size: auto; margin: 0;", help: "Choose 80 mm roll paper in the print window. The receipt uses a 72 mm print area." },
  receipt58: { label: "58 mm terminal / thermal printer", page: "size: auto; margin: 2mm 5mm;", help: "Choose 58 mm roll paper in the print window. The bill is designed for a 48 mm printable area with short labels and one narrow thermal column." },
  a4: { label: "A4 bill printer", page: "size: A4 portrait; margin: 10mm 8mm;", help: "Choose A4 paper and portrait orientation in the print window." },
  a5: { label: "A5 bill printer", page: "size: A5 portrait; margin: 6mm;", help: "Choose A5 paper and portrait orientation in the print window." },
} as const;
type PrintFormat = keyof typeof PRINT_FORMATS;
const PAPER_DIMENSIONS: Record<PrintFormat, {width:number;height:number|null}> = {
  receiptCustom:{width:80,height:null}, receipt60:{width:80,height:210}, receipt80:{width:80,height:null}, receipt58:{width:58,height:null},
  receiptRoll60:{width:60,height:null}, receiptTramble5:{width:63.5,height:127},
  receiptShort4:{width:63.5,height:101.6}, receiptLong6:{width:63.5,height:152.4},
  receipt75long:{width:75,height:292}, a4:{width:210,height:297}, a5:{width:148,height:210},
};
const PRINT_PREFERENCE = "namma-mallige-printer-paper";
const PRINT_SIZE_PREFERENCE = "namma-mallige-print-size";
const PRINT_SIZES = [
  { value: "90", label: "90% · small", help: "Example: use when the bill cuts on the right or bottom." },
  { value: "95", label: "95% · slightly small", help: "Example: use when only a small edge is cutting." },
  { value: "100", label: "100% · normal", help: "Example: best first choice for 80 × 210 mm paper." },
  { value: "105", label: "105% · larger", help: "Example: use when the print looks too small." },
  { value: "110", label: "110% · extra large", help: "Example: use for bolder print if your printer has space." },
] as const;

function PrintedWeeklyBill({ bill: b, format, owner }: { bill: Bill; format: PrintFormat; owner: OwnerAccount }) {
  const receipt = format === "receipt80" || format === "receipt58";
  const compactReceipt = true;
  const flowerLines = (d: Entry) => [
    { code: "M", buds: d.jasmineQty * BUDS[d.jasmineUnit], rate: d.jasmineRate, cost: flowerAmount(d.jasmineQty, d.jasmineUnit, d.jasmineRate) },
    { code: "J", buds: d.pinkQty * BUDS[d.pinkUnit], rate: d.pinkRate, cost: flowerAmount(d.pinkQty, d.pinkUnit, d.pinkRate) },
  ];
  const dayLabel = (i: number) => addDays(b.weekStart, i).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const figures = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (compactReceipt) return <article className={`batch-receipt compact-receipt ${format === "receipt58" ? "terminal-receipt" : ""}`}>
    <header className="compact-heading"><h1>{owner.companyName || owner.ownerName}</h1>{owner.location && <p>{owner.location}</p>}<p>{owner.ownerName} · {owner.phone}</p><p>{format === "receipt58" ? "58 mm bill" : "Weekly bill"} · {b.billNo}</p></header>
    <div className="compact-customer"><strong>{b.customer}</strong>{b.phone && <span>{b.phone}</span>}<p>{addDays(b.weekStart,0).toLocaleDateString("en-IN")} – {addDays(b.weekStart,6).toLocaleDateString("en-IN")}</p><p>Saturday Bill</p></div>
    <table className="compact-table"><colgroup><col style={{width:format === "receipt58" ? "19%" : "21%"}}/><col style={{width:format === "receipt58" ? "31%" : "35%"}}/><col style={{width:"24%"}}/><col style={{width:format === "receipt58" ? "26%" : "22%"}}/></colgroup><thead><tr><th>{format === "receipt58" ? "Dt" : <>Date<br/>Day</>}</th><th>{format === "receipt58" ? "Qty" : "Flower / Quantity"}</th><th>Price<br/>（₹）</th><th>Amount<br/>（₹）</th></tr></thead>{b.days.map((d,i)=><tbody key={i}>{flowerLines(d).map((line,index)=><tr key={line.code}>{index===0 && <td rowSpan={2}>{addDays(b.weekStart,i).toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit"})}<br/><b>{addDays(b.weekStart,i).toLocaleDateString("en-IN",{weekday:"short"})}</b></td>}<td><b>{line.code}</b> {compactQuantityText(line.buds)}</td><td>{figures(line.rate)}</td><td>{figures(line.cost)}</td></tr>)}</tbody>)}</table>
    <div className="weekly-grand-total"><strong>{format === "receipt58" ? "Grand total" : "Weekly Grand Total"}</strong><strong>{money(billAmount(b))}</strong></div>
    <PrintedPaymentTotals balance={billBalance(b)} />
    <footer className="compact-footer"><p>Thank you</p><p className="compact-footer-address">{owner.location && <>{owner.location} | </>}https://nammamallige.store</p></footer>
  </article>;
  return <article className="batch-receipt">
    <header className="print-heading"><div><h1>{owner.companyName || owner.ownerName}</h1>{owner.location && <p>{owner.location}</p>}<p>{owner.ownerName} · {owner.phone}</p></div><div><p className="print-label"><T text="Weekly flower bill"/></p><p>{b.billNo}</p></div></header>
    <div className="print-meta"><div><p><T text="Customer"/></p><h2>{b.customer}</h2>{b.phone && <p>{b.phone}</p>}</div><div><p><strong>Bill date: {addDays(b.weekStart,6).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</strong></p><p>{addDays(b.weekStart,0).toLocaleDateString("en-IN")} – {addDays(b.weekStart,6).toLocaleDateString("en-IN")}</p></div></div>
    {receipt ? <div className="receipt-days">{b.days.map((d, i) => <section className="receipt-day" key={i}>
      <div className="receipt-day-heading"><strong>{dayLabel(i)}</strong><span>Total <b>{money(dayAmount(d))}</b></span></div>
      {flowerLines(d).map(line => <div className="receipt-flower" key={line.code}><div className="receipt-flower-amount"><span><b>{line.code}</b> · {printedQuantityText(line.buds)}</span><strong>{money(line.cost)}</strong></div><p>Price: {money(line.rate)} / atte</p></div>)}
    </section>)}</div> : <Table className="printed-daily-table"><TableHeader><TableRow><TableHead scope="col"><T text="Date"/></TableHead><TableHead scope="col">Flower / quantity</TableHead><TableHead scope="col">Price / atte ₹</TableHead><TableHead scope="col">Amount ₹</TableHead><TableHead scope="col">Daily total ₹</TableHead></TableRow></TableHeader>{b.days.map((d,i) => <TableBody key={i}>{flowerLines(d).map((line,index) => <TableRow key={line.code}>
      {index === 0 && <TableCell rowSpan={2}>{dayLabel(i)}</TableCell>}<TableCell className="printed-quantity"><strong>{line.code}</strong> · {printedQuantityText(line.buds)}</TableCell><TableCell>{figures(line.rate)}</TableCell><TableCell>{figures(line.cost)}</TableCell>{index === 0 && <TableCell rowSpan={2}><strong>{figures(dayAmount(d))}</strong></TableCell>}
    </TableRow>)}</TableBody>)}</Table>}
    <div className="weekly-grand-total"><strong>Weekly Grand Total</strong><strong>{money(billAmount(b))}</strong></div>
    <footer className="print-notes"><p>Thank you · {APP_NAME}</p></footer>
  </article>;
}
const saturdayFor = (date: string) => iso(addDays(sunday(addDays(date,0)),6));
const FARMING_TIPS = [
  "Check the plants for pests and disease. Remove affected leaves or buds promptly.",
  "Water early in the morning. Keep the soil moist, but avoid waterlogging around the roots.",
  "Use only well-decomposed organic manure and follow your local horticulture officer's advice.",
  "Remove weeds and dry branches to improve airflow around the jasmine plants.",
  "Use clean tools for pruning so infection does not spread between plants.",
  "Harvest mature buds gently in the cool morning and keep them shaded after picking.",
  "Record the harvest, quality and selling rate every week to plan the next crop.",
];

export default function Home() {
  return <AccountGate landing>{(owner, update, signedOut) => <BillingApp key={owner.id} owner={owner} onOwnerChange={update} onSignedOut={signedOut} />}</AccountGate>;
}

function BillingApp({ owner, onOwnerChange, onSignedOut }: {owner: OwnerAccount; onOwnerChange: (owner: OwnerAccount) => void; onSignedOut: () => void}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wideNavigation, setWideNavigation] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1200px)");
    const updateNavigation = () => setWideNavigation(media.matches);
    updateNavigation();
    media.addEventListener("change", updateNavigation);
    return () => media.removeEventListener("change", updateNavigation);
  }, []);
  const personal = owner.accountType === "personal";
  const bookName = owner.companyName || owner.ownerName;
  const needsBookSetup = !owner.mpinConfigured || (owner.accountType === "business" && (!owner.companyName || !owner.location));
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const signOut = async () => {
    setSigningOut(true); setSignOutError("");
    try { const response = await accountRequest("/api/account/auth", {method:"POST", body:JSON.stringify({action:"logout"})}); if (!response.ok) throw new Error("Could not sign out. Please retry."); onSignedOut(); }
    catch (error) { setSignOutError(error instanceof Error ? error.message : "Could not sign out."); }
    finally { setSigningOut(false); }
  };
  const [entrySession, setEntrySession] = useState(0);
  const [view, setView] = useState("prices");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [weekStart, setWeekStart] = useState(() => sunday(businessDate()));
  const [billNo, setBillNo] = useState(() => `NMM-W-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}`);
  const [entries, setDays] = useState<Entry[]>(() => Array.from({ length: 7 }, blankEntry));
  const [savedEntryPrices, setSavedEntryPrices] = useState<Entry[] | undefined>(undefined);
  const [prices, setPrices] = useState<Record<string, DailyPrice>>({});
  const [priceDate, setPriceDate] = useState(todayInIndia);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesError, setPricesError] = useState("");
  const days = withDailyPrices(entries, savedEntryPrices, weekStart, prices);
  const priceProblem = null; // Each customer bill stores its own editable flower rates.
  const acceptPrices = useCallback((incoming: DailyPrice[]) => setPrices(current => ({ ...current, ...Object.fromEntries(incoming.map(price => [price.date, price])) })), []);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [id, setId] = useState("");
  const [version, setVersion] = useState(0);
  const [savedBills, setSavedBills] = useState<Bill[]>([]);
  const [sharedBill, setSharedBill] = useState<Bill | null>(null);
  const [accountSaturday, setAccountSaturday] = useState(() => iso(addDays(sunday(businessDate()),6)));
  const [printBatch, setPrintBatch] = useState<Bill[] | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<PrintFormat>("receipt60");
  const [customPaper, setCustomPaper] = useState({width:80,height:0});
  const paperDimensions = printFormat === "receiptCustom" ? {width:customPaper.width,height:customPaper.height || null} : PAPER_DIMENSIONS[printFormat];
  const customPage = customPaper.height ? `size: ${customPaper.width}mm ${customPaper.height}mm; margin: 2mm;` : "size: auto; margin: 2mm;";
  const updateCustomPaper = (field: "width" | "height", raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const next = {...customPaper,[field]: Math.min(field === "width" ? 420 : 2000, Math.max(field === "width" ? 40 : 0,value))};
    setCustomPaper(next);
    try { localStorage.setItem("namma-mallige-custom-paper",JSON.stringify(next)); } catch { /* Current session remains usable. */ }
  };
  const [printSize, setPrintSize] = useState("100");
  const [printError, setPrintError] = useState("");
  const printCleanupRef = useRef<(() => void) | null>(null);
  const printDialogVisible = !personal && printDialogOpen && Boolean(printBatch?.length);
  const accountBills = savedBills.filter(b => iso(addDays(b.weekStart,6)) === accountSaturday).sort((a,b) => a.customer.localeCompare(b.customer));
  const printableBills = printBatch ?? (view === "accounts" ? accountBills : savedBills.filter(b => b.id === id));
  const [selectedDay, setSelectedDay] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [pendingOpen, setPendingOpen] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Bill | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Loading saved bills…");
  const [messageError, setMessageError] = useState(false);
  const openBill = (bill: Bill) => {
    setEntrySession(session => session + 1);
    setView("daily"); setMessageError(false);
    setId(bill.id); setVersion(bill.version); setCustomer(bill.customer); setPhone(bill.phone);
    setWeekStart(bill.weekStart); setBillNo(bill.billNo); setDays(bill.days); setSavedEntryPrices(bill.days); setDirty(false);
    setOpeningBalance(bill.openingBalance ?? 0); setAmountPaid(bill.amountPaid ?? 0); setPaymentHistory(bill.paymentHistory ?? []);
    const today = businessDate();
    const offset = Math.round((today.getTime() - addDays(bill.weekStart, 0).getTime()) / 86400000);
    setSelectedDay(offset >= 0 && offset < 7 ? offset : 0);
    setMessage("Saved bill opened. Select a day to enter or update its flowers.");
    setShareMessage("");
  };
  const loadBills = async () => {
    setBusy(true); setMessageError(false);
    try {
      const response = await billsRequest({ cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSavedBills(data.bills);
      setMessage("Saved bills loaded. Choose a bill to continue, or start a new one.");
    } catch(e) { setMessageError(true); setMessage(e instanceof Error ? e.message : "Could not load bills. Please retry."); }
    finally { setBusy(false); }
  };
  const loadPrices = useCallback(async () => {
    setPricesLoading(true); setPricesError("");
    try {
      const response = await dailyPricesRequest(weekStart, flowerDate(weekStart, 6), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      acceptPrices(data.prices);
    } catch (error) { setPricesError(error instanceof Error ? error.message : "Could not load daily prices. Please retry."); }
    finally { setPricesLoading(false); }
  }, [weekStart, acceptPrices]);
  useEffect(() => { void loadPrices(); }, [loadPrices]);
  useEffect(() => { setId(crypto.randomUUID()); setBillNo("NMM-" + Date.now().toString(36).toUpperCase()); setSelectedDay(businessDate().getDay()); void loadBills(); }, []);
  useEffect(() => {
    try {
      const preference = localStorage.getItem(PRINT_PREFERENCE);
      const storedCustomPaper = JSON.parse(localStorage.getItem("namma-mallige-custom-paper") || "null");
      if (storedCustomPaper && Number.isFinite(storedCustomPaper.width) && storedCustomPaper.width >= 40 && storedCustomPaper.width <= 420 && Number.isFinite(storedCustomPaper.height) && storedCustomPaper.height >= 0 && storedCustomPaper.height <= 2000) setCustomPaper(storedCustomPaper);
      const sizePreference = localStorage.getItem(PRINT_SIZE_PREFERENCE);
      if (preference === "receipt120" || preference === "receipt100") setPrintFormat("receipt60");
      else if (preference && Object.hasOwn(PRINT_FORMATS, preference)) setPrintFormat(preference as PrintFormat);
      if (sizePreference && PRINT_SIZES.some(option => option.value === sizePreference)) setPrintSize(sizePreference);
    } catch { /* Printing still works when device preferences cannot be saved. */ }
    const finishPrinting = () => { setPrintDialogOpen(false); };
    window.addEventListener("afterprint", finishPrinting);
    return () => {
      window.removeEventListener("afterprint", finishPrinting);
      printCleanupRef.current?.();
    };
  }, []);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if(dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!printDialogOpen || printBatch?.length) return;
    setPrintDialogOpen(false);
    setPrintBatch(null);
    setPrintError("");
  }, [printDialogOpen, printBatch]);
  const save = async () => {
    if(priceProblem) { setMessageError(true); setMessage(priceProblem.error); return; }
    if(paymentInvalid) { setMessageError(true); setMessage("Check the old pending amount and amount paid. Use non-negative amounts with two decimal places; paid cannot exceed total payable."); return; }
    const duplicate = savedBills.find(b => b.id !== id && b.weekStart === weekStart && b.customer.trim().toLowerCase() === customer.trim().toLowerCase() && b.phone.trim() === phone.trim());
    if(duplicate) { setMessageError(true); setMessage("A bill for this customer and week already exists. Open it from the account book to add today's entry."); return; }
    setBusy(true); setMessageError(false); setMessage("Saving daily entries…");
    const bill = { id, version, customer, phone, weekStart, billNo, days, openingBalance, amountPaid, paymentHistory };
    try {
      const response = await billsRequest({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bill) });
      const data = await response.json();
      if(!response.ok) throw new Error(data.error);
      const saved: Bill = data.bill ?? { ...bill, version: data.version };
      setDays(saved.days); setSavedEntryPrices(saved.days);
      setVersion(data.version); setDirty(false);
      if(addDays(weekStart,0).getDay() === 0) setAccountSaturday(iso(addDays(weekStart,6)));
      setSavedBills(all => [saved, ...all.filter(b => b.id !== id)]);
      setMessage("Bill saved, including daily flowers, old pending amount and payment details.");
    } catch(e) { setMessageError(true); setMessage(e instanceof Error ? e.message : "Could not save. Your entries are still here."); }
    finally { setBusy(false); }
  };
  const dates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const amount = flowerAmount;
  const dailyTotals = days.map(dayAmount);
  const weeklyTotal = sumAmounts(dailyTotals);
  const payments = paymentSummary(weeklyTotal, openingBalance, amountPaid);
  const paymentInvalid = !isPaymentAmount(openingBalance) || !isPaymentAmount(amountPaid) || payments.pending < 0;
  const selectedEntry = days[selectedDay];
  const selectedDate = dates[selectedDay];
  const selectedMAmount = amount(selectedEntry.jasmineQty, selectedEntry.jasmineUnit, selectedEntry.jasmineRate);
  const selectedJAmount = amount(selectedEntry.pinkQty, selectedEntry.pinkUnit, selectedEntry.pinkRate);
  const dailyWhatsAppMessage = [
    `*${bookName}*`,
    `Daily Flower Bill — ${selectedDate.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}`,
    "",
    `Customer: ${customer || "Customer"}`,
    `Bill No: ${billNo}`,
    `From: ${bookName} · ${owner.phone}`,
    `${owner.location ? `${owner.location} · ` : ""}${owner.ownerName}`,
    "",
    "*Today's flower rates*",
    `M — Jasmine: ${money(selectedEntry.jasmineRate)} per atte`,
    `J — Pink Jasmine: ${money(selectedEntry.pinkRate)} per atte`,
    "",
    "*Today's bill*",
    `M: ${selectedEntry.jasmineQty * BUDS[selectedEntry.jasmineUnit]} buds × ${money(selectedEntry.jasmineRate)} ÷ 3,200 = ${money(selectedMAmount)}`,
    `J: ${selectedEntry.pinkQty * BUDS[selectedEntry.pinkUnit]} buds × ${money(selectedEntry.pinkRate)} ÷ 3,200 = ${money(selectedJAmount)}`,
    "Each flower amount is rounded down to the nearest ₹0.05.",
    `Quantity (M + J): ${quantityText(budsIn([selectedEntry]))}`,
    `Total buds: ${quantityNumber(budsIn([selectedEntry]))}`,
    `*Daily total: ${money(dailyTotals[selectedDay])}*`,
    "",
    "*Weekly account — all recorded days*",
    `This week's flowers: ${money(weeklyTotal)}`,
    `Old pending amount: ${money(openingBalance)}`,
    `Total payable: ${money(payments.totalPayable)}`,
    `Amount paid: ${money(amountPaid)}`,
    `*Pending amount: ${money(payments.pending)}*`,
    "",
    `🌱 *Flower farming tip:* ${FARMING_TIPS[selectedDay]}`,
    "",
    "The complete weekly bill will be provided on Saturday.",
    "Thank you.",
  ].join("\n");
  const whatsappNumber = (() => { const digits = phone.replace(/\D/g, "").replace(/^0+/, ""); return digits.length === 10 ? "91" + digits : digits; })();
  const validWhatsApp = whatsappNumber.length >= 10 && whatsappNumber.length <= 15;
  const reset = (keepCustomer = false) => {
    if(keepCustomer && paymentInvalid) return;
    setEntrySession(session => session + 1);
    const start = keepCustomer ? sunday(addDays(weekStart,7)) : iso(addDays(accountSaturday,-6));
    const existing = keepCustomer && savedBills.find(b => b.weekStart === start && b.customer === customer && b.phone === phone);
    if(existing) { openBill(existing); return; }
    setView("daily"); setMessageError(false);
    setId(crypto.randomUUID()); setVersion(0); setWeekStart(start);
    setSelectedDay(start === sunday(businessDate()) ? businessDate().getDay() : 0);
    if(!keepCustomer) { setCustomer(""); setPhone(""); }
    setOpeningBalance(keepCustomer ? payments.pending : 0); setAmountPaid(0); setPaymentHistory([]); setDirty(keepCustomer);
    setDays(Array.from({ length: 7 }, blankEntry)); setSavedEntryPrices(undefined); setBillNo("NMM-" + Date.now().toString(36).toUpperCase());
    setShareMessage("");
    setMessage(keepCustomer ? `New week: ${money(payments.pending)} carried forward as the old pending amount. Save this new bill.` : "New customer-week bill. Previous saved bills are kept.");
  };
  const print = (batch: Bill[] | null) => {
    if (personal) return;
    const bills = batch ?? savedBills.filter(b => b.id === id);
    if (dirty || !bills.length) return;
    // Recover when a mobile print service returns without firing afterprint.
    printCleanupRef.current?.();
    setPrintBatch(bills); setPrintError(""); setPrintDialogOpen(true);
  };
  const closePrintDialog = () => {
    flushSync(() => {
      setPrintDialogOpen(false);
      setPrintBatch(null);
      setPrintError("");
    });
  };
  const choosePrintFormat = (value: string) => {
    if (!Object.hasOwn(PRINT_FORMATS, value)) return;
    setPrintFormat(value as PrintFormat);
    try { localStorage.setItem(PRINT_PREFERENCE, value); } catch { /* Use this choice for the current session. */ }
  };
  const choosePrintSize = (value: string) => {
    if (!PRINT_SIZES.some(option => option.value === value)) return;
    setPrintSize(value);
    try { localStorage.setItem(PRINT_SIZE_PREFERENCE, value); } catch { /* Use this choice for the current session. */ }
  };
  const openPrintWindow = () => {
    if (!printBatch?.length || printCleanupRef.current) return;
    const cleanupPrint = () => {
      document.body.style.removeProperty("--receipt-print-zoom");
      window.removeEventListener("afterprint", cleanupPrint);
      printCleanupRef.current = null;
      setPrintDialogOpen(false);
      // Keep the selected bills mounted: some mobile browsers capture them later.
      // They are hidden on screen and replaced when another bill is selected.
    };
    printCleanupRef.current = cleanupPrint;
    window.addEventListener("afterprint", cleanupPrint);
    document.body.style.setProperty("--receipt-print-zoom", String(Number(printSize) / 100));
    flushSync(() => setPrintDialogOpen(false));
    try {
      // One synchronous native print call preserves the user's click activation.
      // Print-only CSS shows the bills; the entries remain visible on screen.
      window.print();
    } catch {
      setPrintError("Could not open printing. Please try in your device’s browser.");
      setPrintDialogOpen(true);
    } finally {
      // Nonblocking mobile print dialogs must not erase the receipt DOM.
      printCleanupRef.current = null;
    }
  };
  const sendWhatsApp = () => {
    if (personal) return;
    if(!validWhatsApp || dirty || version === 0) return;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(dailyWhatsAppMessage)}`, "_blank", "noopener,noreferrer");
    setShareMessage(`WhatsApp link opened for ${customer || "this customer"}. Choose WhatsApp or WhatsApp Business if your device offers an app choice. Confirm you are using ${owner.phone}, then tap Send.`);
  };
  const copyDailyMessage = async () => {
    try { await navigator.clipboard.writeText(dailyWhatsAppMessage); setShareMessage("Daily bill message copied."); }
    catch { setShareMessage("Could not copy automatically. Select the message below and copy it."); }
  };
  const requestDelete = (bill: Bill) => { setDeleteError(""); setPendingDelete(bill); };
  const deleteBill = async () => {
    if (!pendingDelete || deleting) return;
    const target = pendingDelete;
    setDeleting(true); setDeleteError("");
    try {
      const response = await billsRequest({ method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: target.id, version: target.version, confirmed: true }) });
      const result = await response.json();
      if(!response.ok) throw new Error(result.error);
      setSavedBills(all => all.filter(b => b.id !== target.id));
      setPrintBatch(null);
      if(id === target.id) { reset(false); setDirty(false); }
      setPendingDelete(null);
      setMessage("Bill " + target.billNo + " for " + target.customer + " removed from the bill book. Other bills are unchanged.");
    } catch(e) { setDeleteError(e instanceof Error ? e.message : "Could not confirm deletion. Please refresh saved bills."); }
    finally { setDeleting(false); }
  };

  const chooseBill = (value: string) => {
    const bill = savedBills.find(b => b.id === value);
    if (dirty) setPendingOpen(value);
    else if (bill) openBill(bill);
  };
  const openRequestedBill = async (billId: string) => {
    if (dirty) throw new Error("Save your current changes first.");
    const response = await billsRequest();
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    const bill = (result.bills as Bill[]).find(item => item.id === billId);
    if (!bill) throw new Error("This bill is no longer available. Refresh the requests.");
    setSavedBills(result.bills); openBill(bill);
  };
  const canSave = Boolean(id && customer.trim() && billNo.trim() && !paymentInvalid && !priceProblem);
  const showPrices = (date: string) => { setPriceDate(date); setView("prices"); };
  const weekRange = `${dates[0].toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${dates[6].toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  const flowerFields = (day: Entry, i: number, kind: "jasmine" | "pink") => {
    const qtyKey = `${kind}Qty` as "jasmineQty" | "pinkQty";
    const unitKey = `${kind}Unit` as "jasmineUnit" | "pinkUnit";
    const rateKey = `${kind}Rate` as "jasmineRate" | "pinkRate";
    const name = kind === "jasmine" ? "Jasmine" : "Pink Jasmine";
    const date = flowerDate(weekStart, i);
    return <section className={`daily-flower ${kind}`} aria-label={name}>
      <div className="flower-title"><span className="flower-code">{kind === "jasmine" ? "M" : "J"}</span><div><h3><T text={name}/></h3><p><T text="Daily flower supply"/></p></div></div>
      <label className="customer-fixed-price"><span>{name} price per atte · {dates[i].toLocaleDateString("en-IN", { day: "numeric", month: "short" })} (₹)</span><Input aria-label={`${customer || "Customer"} ${name} price per atte for ${date}`} type="number" inputMode="decimal" min="0" max="100000000" step="any" value={String(day[rateKey])} onChange={event => {
        const value = event.target.value === "" ? 0 : Number(event.target.value);
        if (!Number.isFinite(value) || value < 0 || value > 100000000) return;
        setDirty(true); setShareMessage("");
        setDays(all => all.map((entry, index) => index === i ? { ...entry, [rateKey]: value, [`${kind}PriceLocked`]: true } : entry));
      }} /><small>This rate belongs to this customer's bill. You can change it whenever needed.</small></label>
      <fieldset className="quantity-fieldset"><FlowerQuantityInput key={`${id}-${entrySession}-${i}-${kind}`} fieldId={`${kind}-${i}`} qty={day[qtyKey]} unit={day[unitKey]} onEditing={() => { setDirty(true); setShareMessage(""); }} onChange={(qty, unit) => {
        setDirty(true); setShareMessage("");
        setDays(all => all.map((entry, index) => index === i ? { ...entry, [qtyKey]: qty, [unitKey]: unit } : entry));
      }} /></fieldset>
      <p className="buds-equivalent">{(day[qtyKey] * BUDS[day[unitKey]]).toLocaleString("en-IN")} buds · 1 atte = 3,200 buds</p>
      <div className="row-amount"><span>{name} amount</span><strong>{money(amount(day[qtyKey], day[unitKey], day[rateKey]))}</strong></div>
    </section>;
  };
  const billActions = (bill: Bill) => <div className="account-row-actions">
    <Button variant="outline" onClick={() => chooseBill(bill.id)}><T text={personal ? "Open record" : "Open bill"}/> <ChevronRight /></Button>
    {!personal && <Button variant="outline" size="icon" disabled={dirty} onClick={() => setSharedBill(bill)} aria-label={`Customer link for ${bill.customer}, ${bill.billNo}`} title="Customer bill link"><Link2 /></Button>}
    <Button variant="ghost" size="icon" className="delete-button" disabled={dirty} onClick={() => requestDelete(bill)} aria-label={`Delete bill ${bill.billNo} for ${bill.customer}`}><Trash2 /></Button>
  </div>;

  return <main className={`app-shell ${personal ? "personal-book" : "business-book"}`}>
    <div className="app-surface">
      <LiveAppUpdate blocked={dirty || busy || printDialogVisible || !!sharedBill || deleting || signingOut}/>
      <a className="skip-link" href="#book-workspace">Skip to your book</a>
      <header className="app-header">
        <Brand />
        <div className="account-header-actions"><LanguagePicker compact/><AppUpdates ownerId={owner.id} personal={personal} ready={!needsBookSetup && !settingsOpen}/><div className="owner-info"><span className="owner-avatar" aria-hidden="true">{owner.ownerName.trim().slice(0,1).toLocaleUpperCase()}</span><span><b>{owner.ownerName}</b>{owner.phone}</span></div><Button variant="outline" className="profile-action" aria-label={personal ? "My profile" : "My book"} onClick={() => setSettingsOpen(true)}><Settings /><span className="header-action-label"><T text={personal ? "My profile" : "My book"}/></span></Button><Button variant="ghost" className="signout-action" aria-label="Sign out" onClick={() => {setSignOutError("");setSignOutOpen(true);}}><LogOut /><span className="header-action-label"><T text="Sign out"/></span></Button></div>
      </header>
      <Tabs value={view} onValueChange={setView} orientation={wideNavigation ? "vertical" : "horizontal"} className="app-tabs">
        <nav className="navigation" aria-label={personal ? "Diary sections" : "Billing sections"}>
          <div className="book-identity"><span className="book-symbol"><BookOpen aria-hidden="true" /></span><div><span className="book-account-type">{personal ? "Personal account" : "Business account"}</span><strong>{personal ? "My flower diary" : owner.companyName || "Your customer book"}</strong><span>{personal ? owner.ownerName : owner.location || "Complete your profile in My book"}</span></div></div>
          <TabsList aria-label={personal ? "Diary sections" : "Billing sections"}><TabsTrigger value="prices"><IndianRupee /> <T text="Daily prices"/></TabsTrigger><TabsTrigger value="daily"><Flower2 /> <T text="Daily entry"/></TabsTrigger><TabsTrigger value="accounts"><BookOpen /> <T text={personal ? "My diary" : "Account book"}/></TabsTrigger><TabsTrigger value="reports"><ChartNoAxesCombined /> <T text="Reports"/></TabsTrigger></TabsList>
          <div className="navigation-support">{!personal && <div className="customer-requests-entry"><CustomerRequests dirty={dirty} onOpenBill={openRequestedBill} /></div>}<span className="navigation-note"><CalendarDays /><span>Sunday – Saturday<span className="navigation-note-detail">Your seven-day flower week</span></span></span></div>
        </nav>
        <div className="book-workspace" id="book-workspace" tabIndex={-1}>
        <div className="page-heading">
          <div><p className="page-kicker">{businessDate().toLocaleDateString("en-IN", {weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p><h2><T text={view === "reports" ? "Monthly reports" : view === "prices" ? "Daily flower prices" : view === "daily" ? "Daily flower entry" : personal ? "My flower diary" : "Customer account book"}/></h2><p>{view === "reports" ? "Your saved flowers and payments, month by month." : view === "prices" ? "Set M and J prices once for each flower date." : view === "daily" ? "Enter the day’s flowers using the fixed daily prices." : personal ? "Your daily flowers, earnings and payments, week by week." : "Every customer’s seven-day bill, ready for Saturday."}</p></div>
          {view !== "prices" && view !== "reports" && <div className="heading-actions">
            <span className={`save-state ${dirty ? "unsaved" : version ? "saved" : ""}`}>{busy ? <LoaderCircle className="spin" /> : dirty ? <Info /> : version ? <CheckCircle2 /> : <BookOpen />}{busy ? "Please wait…" : dirty ? "Unsaved changes" : version ? "Bill saved" : "New bill"}</span>
            <Button onClick={() => reset(false)} disabled={busy || dirty}><Plus /> <T text={personal ? "New diary record" : "Add bill"}/></Button>
          </div>}
        </div>
        {view !== "prices" && <div className={`status-bar ${messageError ? "error" : ""}`} role={messageError ? "alert" : "status"} aria-live="polite">{busy ? <LoaderCircle className="spin" /> : <Info />}<span>{message}</span></div>}
        <div inert={view !== "prices" && busy} aria-busy={view !== "prices" && busy}>
          <TabsContent value="prices"><DailyPricesPanel key={priceDate} date={priceDate} prices={prices} onDateChange={setPriceDate} onPrices={acceptPrices} onContinue={() => { const index = days.findIndex((_, index) => flowerDate(weekStart, index) === priceDate); if(index >= 0) setSelectedDay(index); setView("daily"); }} /></TabsContent>
          <TabsContent value="reports"><MonthlyReports bills={savedBills} personal={personal} dirty={dirty} onRefresh={loadBills} /></TabsContent>
          <TabsContent value="daily">
            <section className="panel customer-panel" aria-label="Customer details">
              <div className="section-heading"><span className="section-step" aria-hidden="true">01</span><h3>{personal ? "Buyer & week" : "Customer & week"}</h3></div>
              <div className="saved-picker">
                <label id="saved-bill-label">{personal ? "Continue a saved diary record" : "Continue a saved weekly bill"}<Select value={version ? id : ""} onValueChange={chooseBill}><SelectTrigger aria-labelledby="saved-bill-label"><SelectValue placeholder="Choose customer and week" /></SelectTrigger><SelectContent>{savedBills.length ? savedBills.map(b => <SelectItem key={b.id} value={b.id}>{b.customer} · {addDays(b.weekStart, 0).toLocaleDateString("en-IN")} · {b.billNo}</SelectItem>) : <SelectItem value="no-bills" disabled><T text="No saved bills yet"/></SelectItem>}</SelectContent></Select></label>
                <div className="saved-tools">
                  <Button variant="ghost" onClick={loadBills}><RotateCcw /> <T text="Refresh"/></Button>
                  {version > 0 && <Button variant="outline" onClick={() => chooseBill(id)}>Reopen saved copy</Button>}
                  {version > 0 && <Button variant="ghost" size="icon" className="delete-button" disabled={dirty} onClick={() => { const bill = savedBills.find(b => b.id === id); if(bill) requestDelete(bill); }} aria-label="Delete selected weekly bill"><Trash2 /></Button>}
                </div>
              </div>
              <div className="customer-fields">
                <label htmlFor="customer-name"><T text={personal ? "Katte / buyer name" : "Customer name"}/><Input id="customer-name" maxLength={200} value={customer} onChange={e => { setCustomer(e.target.value); setDirty(true); }} placeholder={personal ? "Where did you supply your flowers?" : "Enter customer name"} autoComplete="name" /></label>
                {!personal && <label htmlFor="customer-phone"><span><T text="WhatsApp number"/> <span className="optional">(for daily messages)</span></span><Input id="customer-phone" type="tel" maxLength={40} value={phone} onChange={e => { setPhone(e.target.value); setDirty(true); setShareMessage(""); }} autoComplete="tel" placeholder="+91 98765 43210" /></label>}
                <label htmlFor="week-start">Week starts Sunday<Input id="week-start" type="date" disabled={version > 0} value={weekStart} onChange={e => { if(e.target.value) { setWeekStart(sunday(addDays(e.target.value,0))); setDirty(true); } }} /></label>
                <label htmlFor="bill-number"><T text="Bill number"/><Input id="bill-number" maxLength={80} value={billNo} onChange={e => { setBillNo(e.target.value); setDirty(true); }} /></label>
              </div>
            </section>
            {version > 0 && dates[0].getDay() !== 0 && <p className="status-bar">This older bill keeps its original dates. New bills use Sunday–Saturday.</p>}
            <div className="workspace-grid">
              <div className="daily-editor">
                <form id="daily-bill-form" className="panel entry-panel" aria-label="Daily quantities and prices" onSubmit={event => { event.preventDefault(); void save(); }}>
                  <div className="panel-title"><div className="section-heading"><span className="section-step" aria-hidden="true">02</span><h3>Daily flowers</h3></div><span>{dates[selectedDay].toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span></div>
                  {pricesError && <div className="status-bar error" role="alert"><span>{pricesError}</span><Button type="button" variant="outline" onClick={() => void loadPrices()}>Retry prices</Button></div>}
                  <Tabs value={String(selectedDay)} onValueChange={v => { setSelectedDay(Number(v)); setShareMessage(""); }} className="day-tabs">
                    <TabsList aria-label="Delivery day">{dates.map((date,i) => <TabsTrigger value={String(i)} key={i} aria-label={date.toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long" })}><span className="day-label">{date.toLocaleDateString("en-IN", { weekday:"short" })}</span><b>{date.getDate()}</b><span className="day-entry-mark">{(days[i].jasmineQty > 0 || days[i].pinkQty > 0) && <Check aria-label="Has flower entries" />}</span></TabsTrigger>)}</TabsList>
                    {dates.map((date,i) => <TabsContent value={String(i)} key={i}>
                      <div className="day-title"><CalendarDays /><span>{date.toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}</span></div>
                      <div className="entry-price-status"><span>{prices[flowerDate(weekStart, i)] ? "M and J prices are fixed for this date." : pricesLoading ? "Loading daily prices…" : "Set M and J prices for this date before adding new flowers."}</span><Button type="button" variant="outline" onClick={() => showPrices(flowerDate(weekStart, i))}><IndianRupee />{prices[flowerDate(weekStart, i)] ? "View daily prices" : "Set daily prices"}</Button></div>
                      <div className="flower-fields-grid">{flowerFields(days[i], i, "jasmine")}{flowerFields(days[i], i, "pink")}</div>
                    </TabsContent>)}
                  </Tabs>
                  <QuantitySummary totalBuds={budsIn([selectedEntry])} />
                  <div className="daily-save-bar"><div><span>Daily total · {selectedDate.toLocaleDateString("en-IN", { weekday:"short" })}</span><strong aria-live="polite">{money(dailyTotals[selectedDay])}</strong></div><Button type="submit" disabled={!canSave}><Save /> {personal ? "Save daily entry" : "Save daily bill"}</Button></div>
                  {!customer.trim() && <p className="entry-hint">{personal ? "Enter a katte or buyer name above to save your entry." : "Enter a customer name above to save this bill."}</p>}
                  {priceProblem && <p className="entry-hint" role="alert">{priceProblem.error}</p>}
                  {dirty && <p className="entry-hint">{personal ? "Save your changes before starting another diary record." : "Save your changes before printing, sending or starting another bill."}</p>}
                  <Collapsible className="conversion-guide"><CollapsibleTrigger className="disclosure-trigger"><Info /> Units & calculation <ChevronDown /></CollapsibleTrigger><CollapsibleContent className="guide-content"><div className="unit-chips"><span><T text="1 chendu = 800 buds"/></span><span>1 atte = 3,200 buds</span></div><p>Amount = buds × daily price per atte ÷ 3,200. Each M and J amount is rounded down to ₹0.05 before adding daily and weekly totals.</p><p>Choose “Chendus + extra buds” and enter the two counts separately: 1 chendu + 200 buds = 1,000 buds; 2 chendus + 400 buds = 2,000 buds.</p></CollapsibleContent></Collapsible>
                </form>
                {!personal && <section className="panel whatsapp-card" aria-label="Daily WhatsApp bill">
                  <div className="whatsapp-heading"><span className="whatsapp-icon"><MessageCircle /></span><div><h3>WhatsApp / WhatsApp Business daily bill</h3><p>Send one daily bill image; print the full bill on Saturday</p></div></div>
                  <div className="whatsapp-recipient"><strong>{customer || "Choose a customer"}</strong><span>{phone || "Add their WhatsApp number above"}</span></div>
                  <DailyBillImage key={dailyWhatsAppMessage} disabled={dirty || version === 0} recipient={customer} lines={[
                    bookName,`${owner.ownerName} · ${owner.phone}`,owner.location || "",
                    "DAILY FLOWER BILL",selectedDate.toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"short",year:"numeric"}),
                    `Customer: ${customer}`,`Bill: ${billNo}`,"",
                    `M · Jasmine: ${compactQuantityText(selectedEntry.jasmineQty * BUDS[selectedEntry.jasmineUnit])}`,
                    `Rate / atte: ${money(selectedEntry.jasmineRate)}   Amount: ${money(selectedMAmount)}`,
                    `J · Pink Jasmine: ${compactQuantityText(selectedEntry.pinkQty * BUDS[selectedEntry.pinkUnit])}`,
                    `Rate / atte: ${money(selectedEntry.pinkRate)}   Amount: ${money(selectedJAmount)}`,
                    "Quantity: chendu + extra buds; 1 chendu = 800 buds", "",
                    `DAILY TOTAL: ${money(dailyTotals[selectedDay])}`,"",
                    "ACCOUNT BALANCE · all recorded days",`Week flowers: ${money(weeklyTotal)}`,
                    `Previous balance: ${money(openingBalance)}`,`Payments recorded this week: ${money(amountPaid)}`,
                    `PENDING BALANCE: ${money(payments.pending)}`,"", "Full weekly bill provided on Saturday.","Thank you"
                  ]}/>
                  <div className="whatsapp-actions"><Button className="whatsapp-button" onClick={sendWhatsApp} disabled={!validWhatsApp || dirty || version === 0}><MessageCircle /> Send text instead</Button><Button variant="outline" onClick={() => void copyDailyMessage()}><Copy /> Copy text</Button></div>
                  {phone.trim() && !validWhatsApp && <p className="entry-hint" role="alert">Enter a valid number with country code. Indian 10-digit numbers use +91 automatically.</p>}
                  {(dirty || version === 0) && <p className="whatsapp-help">Save the daily bill before sending it.</p>}
                  <p className="whatsapp-help">Use regular WhatsApp or WhatsApp Business with {owner.phone}, then tap Send. Your device or browser chooses which app opens for text links.</p>
                  {shareMessage && <p className="share-status" role="status">{shareMessage}</p>}
                  <Collapsible className="whatsapp-preview"><CollapsibleTrigger className="disclosure-trigger">Preview {selectedDate.toLocaleDateString("en-IN", { weekday:"long" })}’s message <ChevronDown /></CollapsibleTrigger><CollapsibleContent><pre tabIndex={0} aria-label="WhatsApp message preview">{dailyWhatsAppMessage}</pre></CollapsibleContent></Collapsible>
                </section>}
              </div>
              <aside className="panel weekly-summary" aria-label="Weekly bill summary">
                <div className="summary-heading"><p className="eyebrow">{personal ? "My weekly earnings" : "Weekly bill"}</p><h3>{dates[6].getDay() === 6 ? "Saturday" : dates[6].toLocaleDateString("en-IN",{weekday:"long"})}, {dates[6].toLocaleDateString("en-IN", { day:"numeric", month:"long" })}</h3><p>{weekRange}</p></div>
                <div className="summary-body">
                  <div className="summary-customer"><strong>{customer || (personal ? "Buyer name" : "Customer name")}</strong><span>{billNo}</span>{phone && <span>{phone}</span>}</div>
                  <table className="summary-table"><caption className="sr-only">Daily flower amounts for the billing week. M means Jasmine; J means Pink Jasmine.</caption><thead><tr><th scope="col">Day</th><th scope="col">M (₹)</th><th scope="col">J (₹)</th><th scope="col">Total (₹)</th></tr></thead><tbody>{days.map((day,i) => <tr key={i} className={selectedDay === i ? "selected-summary-row" : ""}><td><b>{dates[i].toLocaleDateString("en-IN", { weekday:"short" })}</b><span>{dates[i].toLocaleDateString("en-IN", { day:"numeric", month:"short" })}</span></td><td>{amount(day.jasmineQty,day.jasmineUnit,day.jasmineRate).toLocaleString("en-IN", {minimumFractionDigits:2,maximumFractionDigits:2})}</td><td>{amount(day.pinkQty,day.pinkUnit,day.pinkRate).toLocaleString("en-IN", {minimumFractionDigits:2,maximumFractionDigits:2})}</td><td><b>{dailyTotals[i].toLocaleString("en-IN", {minimumFractionDigits:2,maximumFractionDigits:2})}</b></td></tr>)}</tbody></table>
                  <QuantitySummary totalBuds={budsIn(days)} />
                  <div className="payment-fields">
                    <h3><T text="Old balance & payment"/></h3>
                    <label htmlFor="opening-balance"><T text="Old pending amount (₹)"/><Input id="opening-balance" form="daily-bill-form" type="number" min="0" max="100000000" step="0.01" inputMode="decimal" value={openingBalance} onFocus={e => e.target.select()} onChange={e => { const value=Number(e.target.value); if(Number.isFinite(value)) {setOpeningBalance(value);setDirty(true);setShareMessage("");} }} /></label>
                    <p className="payment-help">Enter the unpaid amount from the previous bill.</p>
                    <PaymentHistory key={id+"-"+entrySession} records={paymentHistory} paid={amountPaid} pending={payments.pending} onAdd={record=>{setPaymentHistory(rows=>[...rows,record]);setAmountPaid(value=>sumAmounts([value,record.amount]));setDirty(true);setShareMessage("");}} />
                    {paymentInvalid && <p className="quantity-error" role="alert">Check payment amounts. Use up to two decimal places and keep paid at or below total payable.</p>}
                    <Button type="submit" form="daily-bill-form" variant="outline" disabled={!canSave}><Save /> <T text="Save payment details"/></Button>
                  </div>
                  <PaymentTotals balance={payments} />
                  <div className="summary-actions">{!personal && <Button onClick={() => print(null)} disabled={payments.totalPayable === 0 || dirty || version === 0 || paymentInvalid}><Printer /> Print this week bill</Button>}<Button variant="outline" onClick={() => reset(true)} disabled={dirty || !customer.trim() || paymentInvalid}><CalendarDays /> <T text={personal ? "Next week, same buyer" : "Next week, same customer"}/></Button></div>
                  {!personal && <><Button variant="outline" disabled={dirty || version === 0 || busy} onClick={() => { const bill = savedBills.find(item => item.id === id); if (bill) setSharedBill(bill); }}><Link2 /> Customer bill link</Button><p className="summary-note">Print on 80 mm / 58 mm receipt paper or A4 / A5 bill paper.</p></>}
                  <p className="summary-note">Next week carries the pending amount into the new bill. An existing next-week bill is kept as saved.</p>
                </div>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="accounts">
            <section className="panel account-book" aria-label="Saved customer bills">
              <div className="account-toolbar">
                <div className="saturday-picker"><Button variant="outline" size="icon" aria-label="Previous Saturday" onClick={() => setAccountSaturday(iso(addDays(accountSaturday,-7)))}><ChevronLeft /></Button><label htmlFor="account-saturday">{personal ? "Week ending Saturday" : "Print bill on Saturday"}<Input id="account-saturday" type="date" value={accountSaturday} onChange={e => { if(e.target.value) setAccountSaturday(saturdayFor(e.target.value)); }} /></label><Button variant="outline" size="icon" aria-label="Next Saturday" onClick={() => setAccountSaturday(iso(addDays(accountSaturday,7)))}><ChevronRight /></Button></div>
                <div className="account-total"><p>{accountBills.length} {personal ? (accountBills.length === 1 ? "diary record" : "diary records") : (accountBills.length === 1 ? "customer bill" : "customer bills")} · Pending amount</p><strong>{money(sumAmounts(accountBills.map(b => billBalance(b).pending)))}</strong></div>
                <div className="heading-actions"><Button variant="outline" onClick={loadBills} aria-label="Refresh account book"><RotateCcw /> <T text="Refresh"/></Button><Button variant="outline" onClick={() => setSettingsOpen(true)}>Backup / export</Button>{!personal && <Button onClick={() => print(accountBills)} disabled={dirty || !accountBills.length}><Printer /> Print weekly bills</Button>}</div>
              </div>
              {!accountBills.length ? <div className="account-empty"><BookOpen /><h3>{personal ? "Your diary starts here" : "No bills for this week yet"}</h3><p>{personal ? "Add your daily flowers and buyer. Your saved entries and payments will appear here." : "Add a customer’s daily flowers. Their saved bill will appear here with all seven days and the weekly total."}</p><Button onClick={() => reset(false)} disabled={dirty}><Plus />{personal ? "Add your first entry" : "Add the first bill"}</Button></div> : <>
                <div className="account-table"><Table><TableHeader><TableRow><TableHead>{personal ? "Buyer / record" : "Customer / bill"}</TableHead>{Array.from({length:7},(_,i) => <TableHead key={i}>{addDays(accountSaturday,i-6).toLocaleDateString("en-IN",{weekday:"short"})}<span>{addDays(accountSaturday,i-6).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</span></TableHead>)}<TableHead><T text="Week flowers"/></TableHead><TableHead><T text="Old pending"/></TableHead><TableHead><T text="Paid"/></TableHead><TableHead><T text="Pending"/></TableHead><TableHead><T text="Actions"/></TableHead></TableRow></TableHeader><TableBody>{accountBills.map(b => <TableRow key={b.id} className={b.id === id ? "account-current" : ""}><TableCell><strong>{b.customer}</strong><small>{b.phone}</small><small>{b.billNo}</small></TableCell>{b.days.map((d,i) => <TableCell key={i}>{money(dayAmount(d))}</TableCell>)}<TableCell>{money(billAmount(b))}</TableCell><TableCell>{money(b.openingBalance ?? 0)}</TableCell><TableCell>{money(b.amountPaid ?? 0)}</TableCell><TableCell><strong>{money(billBalance(b).pending)}</strong></TableCell><TableCell>{billActions(b)}</TableCell></TableRow>)}</TableBody></Table></div>
                <div className="account-mobile">{accountBills.map(b => <article className={`account-card ${b.id === id ? "account-current" : ""}`} key={b.id}><div className="account-card-top"><div><h3>{b.customer}</h3><p>{b.phone || b.billNo}</p></div><div className="account-card-balance"><span><T text="Pending"/></span><strong>{money(billBalance(b).pending)}</strong></div></div><div className="mobile-week-amounts">{b.days.map((d,i) => <div key={i}><span>{addDays(b.weekStart,i).toLocaleDateString("en-IN",{weekday:"short",day:"numeric"})}</span><b>{money(dayAmount(d))}</b></div>)}</div><div className="account-payment-summary"><span><T text="Old pending"/> <b>{money(b.openingBalance ?? 0)}</b></span><span><T text="Paid"/> <b>{money(b.amountPaid ?? 0)}</b></span></div>{billActions(b)}</article>)}</div>
              </>}
            </section>
            {dirty && <p className="entry-hint">{personal ? "Save your daily entry before adding or deleting records." : "You have unsaved edits in Daily entry. Save them before adding, deleting or printing bills."}</p>}
          </TabsContent>
        </div>
        </div>
      </Tabs>
      <BookSettings key={owner.ownerName + owner.accountType + owner.companyName + owner.location + owner.googleSheetUrl} owner={owner} open={settingsOpen || needsBookSetup} onOpenChange={setSettingsOpen} onSaved={onOwnerChange} />
      {!personal && sharedBill && <CustomerAccessDialog key={sharedBill.id} bill={sharedBill} onClose={() => setSharedBill(null)} />}
      <AlertDialog open={signOutOpen} onOpenChange={open => {if(!signingOut) setSignOutOpen(open);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Sign out of your book?</AlertDialogTitle><AlertDialogDescription>{dirty ? "You have unsaved entries. Save them first, or sign out and discard those changes." : "Your saved bills and prices will be kept in your account."}</AlertDialogDescription></AlertDialogHeader>{signOutError && <p role="alert" className="quantity-error">{signOutError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={signingOut}>Keep working</AlertDialogCancel><AlertDialogAction disabled={signingOut} onClick={e => {e.preventDefault();void signOut();}}>{signingOut ? "Signing out…" : "Sign out"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <SponsorSpace/>
      <footer className="app-footer"><span>{APP_NAME}</span><span>M = Jasmine · J = Pink Jasmine</span><span>Developed by Arun Cabral · Shirva</span><a href="tel:+918971891245">8971891245</a><a href="mailto:ARUN.CABRAL54@GMAIL.COM">ARUN.CABRAL54@GMAIL.COM</a></footer>
      {printDialogVisible && <div className="print-modal-overlay" role="presentation" onClick={closePrintDialog}><section className="print-dialog print-modal-content" role="dialog" aria-modal="true" aria-labelledby="print-dialog-title" onClick={event => event.stopPropagation()}><DialogHeader className="print-dialog-hero"><div className="print-dialog-title-row"><div><span className="print-kicker">Thermal bill studio</span><h2 id="print-dialog-title">Preview & print weekly {printBatch?.length === 1 ? "bill" : "bills"}</h2></div><Button type="button" variant="outline" size="sm" onClick={closePrintDialog}>Close</Button></div><p className="text-muted-foreground text-sm">{printBatch?.length === 1 ? `${printBatch[0].customer} · ${printBatch[0].billNo}` : `${printBatch?.length ?? 0} customer bills ready.`} Grand total, paid amount and pending amount are included.</p></DialogHeader>
        <div className="print-option-grid">
          <label className="print-control-card" id="printer-paper-label"><span>Bill printing size</span><select aria-label="Bill printing size" aria-describedby="printer-paper-help" value={printFormat} onChange={event => choosePrintFormat(event.target.value)}>{Object.entries(PRINT_FORMATS).map(([value, option]) => <option value={value} key={value}>{option.label}</option>)}</select></label>
          {printFormat === "receiptCustom" && <div className="custom-paper-controls"><label className="print-control-card"><span>Paper width (mm)</span><input aria-label="Custom paper width in millimetres" type="number" min="40" max="420" step="0.5" value={customPaper.width} onChange={event=>updateCustomPaper("width",event.target.value)}/></label><label className="print-control-card"><span>Paper length (mm; 0 = automatic)</span><input aria-label="Custom paper length in millimetres" type="number" min="0" max="2000" step="0.5" value={customPaper.height} onChange={event=>updateCustomPaper("height",event.target.value)}/></label></div>}
          {printFormat.startsWith("receipt") && <label className="print-control-card" id="printer-size-label"><span>Trouble printing size</span><select aria-label="Trouble printing size" aria-describedby="printer-size-help" value={printSize} onChange={event => choosePrintSize(event.target.value)}>{PRINT_SIZES.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>}
        </div>
        <section className="print-size-choices" aria-label="10 preset sizes and custom size"><h3>Choose a size to preview</h3>
          <div className="bill-preview-size-list">{Object.entries(PRINT_FORMATS).map(([value,option])=><button type="button" key={value} aria-pressed={printFormat===value} onClick={()=>choosePrintFormat(value)}>{option.label}</button>)}</div>
        </section>
        {printBatch && <section className="print-bill-summary" aria-label="Bills selected for printing"><div><span>Selected for Saturday bill</span><strong>{printBatch.length === 1 ? printBatch[0].customer : `${printBatch.length} customers`}</strong><p>{printBatch.length === 1 ? printBatch[0].billNo : "Bills will print one after another."}</p></div><div><span>Paper</span><strong>{PRINT_FORMATS[printFormat].label}</strong><p>{printFormat === "receipt60" ? "Original bill size · 76 mm printable" : "Use matching paper in your printer settings"}</p></div></section>}
        <div className="print-setup-help print-prime-help" id="printer-paper-help"><strong>Best print setting</strong><p>{PRINT_FORMATS[printFormat].help}</p><p>Match your printer paper setting to the selected size. Keep scale at 100% and switch off headers and footers. Your original 80 × 210 mm Tramble size remains available.</p></div>
        {printFormat.startsWith("receipt") && <div className="print-setup-help" id="printer-size-help"><strong>Fine tune size</strong><p>{PRINT_SIZES.find(option => option.value === printSize)?.help}</p><p>Right side missing: choose 90% or 95%. Bill too small: choose 105% or 110%. Normal: keep 100%.</p></div>}
        <section className="bill-preview-studio" aria-label="Bill previews for all paper sizes">
          <h3>Preview all printing sizes</h3>

          <p>{paperDimensions.width} mm wide · {paperDimensions.height ? `${paperDimensions.height} mm per page` : 'Roll length follows bill content'}. Preview of the first selected customer.</p>
          <p className="field-help">Scroll to inspect the whole bill. Dotted lines mark approximate page boundaries; final pagination depends on printer settings.</p>
          <div className="bill-preview-scroll"><div className={`bill-preview-paper paper-preview-${printFormat} ${printFormat==='receipt58'?'bill-preview-narrow':''}`} style={{"--preview-zoom":printFormat.startsWith("receipt") ? Number(printSize) / 100 : 1,width:`${paperDimensions.width}mm`,minHeight:paperDimensions.height?`${paperDimensions.height}mm`:undefined,backgroundSize:paperDimensions.height?`100% ${paperDimensions.height}mm`:undefined,backgroundImage:paperDimensions.height?'linear-gradient(to bottom, transparent calc(100% - 1px), #a0a0a0 1px)':undefined} as CSSProperties}>{printBatch?.[0] && <PrintedWeeklyBill bill={printBatch[0]} format={printFormat} owner={owner}/>}</div></div>
        </section>
        <p className="printer-connection-note">Select your printer in the phone or PC print menu. If it is missing, set it up with the printer maker’s driver or print service first.</p>
        {printError && <p className="quantity-error" role="alert">{printError}</p>}
        <DialogFooter className="print-actions"><Button type="button" variant="outline" onClick={closePrintDialog}><T text="Cancel"/></Button><Button type="button" onClick={openPrintWindow} disabled={!printBatch?.length} className="print-primary-action"><Printer /> Open print window</Button></DialogFooter>
      </section></div>}
      <AlertDialog open={pendingOpen !== null} onOpenChange={open => { if(!open) setPendingOpen(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>Your saved bills will be kept. Only the changes you have not saved will be discarded.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => { const bill = savedBills.find(b => b.id === pendingOpen); if(bill) openBill(bill); setPendingOpen(null); }}>Open saved bill</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={pendingDelete !== null} onOpenChange={open => { if(!open && !deleting) setPendingDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{personal ? "Delete this weekly diary record?" : "Delete this weekly bill?"}</AlertDialogTitle><AlertDialogDescription>{personal ? "This removes the selected week’s daily entries and payment details from your diary." : "This removes this customer’s bill, seven daily entries and payment details from the account book and Saturday printing."}</AlertDialogDescription></AlertDialogHeader>{pendingDelete && <div className="rounded-lg border p-4 space-y-1"><p className="font-bold">{pendingDelete.customer}</p><p>Bill: {pendingDelete.billNo}</p><p>{addDays(pendingDelete.weekStart,0).toLocaleDateString("en-IN")} – {addDays(pendingDelete.weekStart,6).toLocaleDateString("en-IN")}</p><p>Week flowers: {money(billAmount(pendingDelete))}</p><p className="font-bold">Pending amount: {money(billBalance(pendingDelete).pending)}</p></div>}{deleteError && <p role="alert" className="text-red-700">{deleteError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={deleting}>Cancel, keep bill</AlertDialogCancel><AlertDialogAction className="bg-red-700 text-white hover:bg-red-800" disabled={deleting} onClick={event => { event.preventDefault(); void deleteBill(); }}>{deleting ? "Deleting…" : "Yes, delete bill"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
    <style media="print">{`@page { ${printFormat === "receiptCustom" ? customPage : PRINT_FORMATS[printFormat].page} }`}</style>
    {!personal && <div style={printFormat === "receiptCustom" ? {"--custom-print-width":`${customPaper.width - 4}mm`} as CSSProperties : undefined} className={`print-batch paper-${printFormat} ${printFormat.startsWith("receipt") ? "receipt-paper" : "sheet-paper"}`}>{printableBills.length ? printableBills.map(b => <PrintedWeeklyBill key={b.id} bill={b} format={printFormat} owner={owner} />) : <p>No saved bill selected. Open a saved bill and choose “Print Saturday bill”.</p>}</div>}
  </main>;
}
