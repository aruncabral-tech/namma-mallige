"use client";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Flower2, IndianRupee, RotateCcw, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { monthlyReport, type ReportBill } from "@/lib/monthly-report";
import { flowerDate, todayInIndia } from "@/lib/daily-prices";

const money = (n: number) => n.toLocaleString("en-IN", { style: "currency", currency: "INR" });
const quantity = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 6 });
const dateLabel = (date: string) => new Date(date + "T12:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
function shiftMonth(month: string, by: number) {
  const date = new Date(month + "-01T12:00:00Z");
  date.setUTCMonth(date.getUTCMonth() + by);
  return date.toISOString().slice(0, 7);
}

export function MonthlyReports({ bills, personal, dirty, onRefresh }: { bills: ReportBill[]; personal: boolean; dirty: boolean; onRefresh: () => void }) {
  const [month, setMonth] = useState(() => todayInIndia().slice(0, 7));
  const report = useMemo(() => monthlyReport(bills, month), [bills, month]);
  const title = new Date(month + "-01T12:00:00Z").toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  return <section className="monthly-reports" aria-label="Monthly flower reports">
    <div className="report-toolbar"><div className="report-month-picker"><Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft /></Button><label htmlFor="report-month">Report month<Input id="report-month" type="month" value={month} onChange={e => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value)) setMonth(e.target.value); }} /></label><Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight /></Button></div><Button variant="outline" onClick={onRefresh}><RotateCcw /> Refresh saved records</Button></div>
    {dirty && <p className="report-notice" role="status">You have unsaved edits. This report uses your saved records; save your daily entry to include the changes.</p>}
    <h3>{title}</h3>
    <div className="report-cards">
      <div className="panel"><div className="report-stat-label"><span>Total flower buds</span><Flower2 aria-hidden="true"/></div><strong>{quantity(report.totals.mBuds + report.totals.jBuds)}</strong><small>M {quantity(report.totals.mBuds)} · J {quantity(report.totals.jBuds)}</small></div>
      <div className="panel report-value-card"><div className="report-stat-label"><span>{personal ? "Flower earnings" : "Flower value"}</span><IndianRupee aria-hidden="true"/></div><strong>{money(report.totals.flowers)}</strong><small>Flowers dated in {title}. Before expenses.</small></div>
      <div className="panel"><div className="report-stat-label"><span>Payments recorded</span><Wallet aria-hidden="true"/></div><strong>{money(report.totals.paid)}</strong><small>Payments dated in {title}, including payments for older bills.</small></div>
    </div>
    <p className="report-explanation">M = Jasmine · J = Pink jasmine. Weeks crossing two months are split by each flower date. Old balances are not counted as new flower value.</p>
    {report.hasUndatedPayments && <p className="report-notice">Some older payments have no date. They remain in your book but are excluded from monthly payment totals.</p>}
    {!report.customers.length ? <div className="panel report-empty"><h3>No entries for {title}</h3><p>Choose another month or save daily flowers and dated payments in your book.</p></div> : <>
      <section className="panel report-table-panel"><h3>{personal ? "By buyer / record" : "By customer"}</h3><Table><TableHeader><TableRow><TableHead>{personal ? "Buyer / record" : "Customer"}</TableHead><TableHead>M buds</TableHead><TableHead>J buds</TableHead><TableHead>{personal ? "Earnings" : "Flower value"}</TableHead><TableHead>Payments</TableHead></TableRow></TableHeader><TableBody>{report.customers.map(row => <TableRow key={row.key}><TableCell><strong>{row.customer}</strong>{row.phone && <small>{row.phone}</small>}</TableCell><TableCell>{quantity(row.mBuds)}</TableCell><TableCell>{quantity(row.jBuds)}</TableCell><TableCell>{money(row.flowers)}</TableCell><TableCell>{money(row.paid)}</TableCell></TableRow>)}</TableBody></Table></section>
      <section className="panel report-table-panel"><h3>Daily breakdown</h3><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>M buds</TableHead><TableHead>J buds</TableHead><TableHead>M amount</TableHead><TableHead>J amount</TableHead><TableHead>Total</TableHead><TableHead>Payments</TableHead></TableRow></TableHeader><TableBody>{report.daily.map(row => <TableRow key={row.date}><TableCell>{dateLabel(row.date)}</TableCell><TableCell>{quantity(row.mBuds)}</TableCell><TableCell>{quantity(row.jBuds)}</TableCell><TableCell>{money(row.mAmount)}</TableCell><TableCell>{money(row.jAmount)}</TableCell><TableCell><strong>{money(row.flowers)}</strong></TableCell><TableCell>{money(row.paid)}</TableCell></TableRow>)}</TableBody></Table></section>
    </>}
    <Collapsible className="panel report-balances"><CollapsibleTrigger className="disclosure-trigger"><span>Latest bill balances · {money(report.latestBillPending)}</span><ChevronRight /></CollapsibleTrigger><CollapsibleContent><p className="report-explanation">Current saved balance from the latest weekly bill for each name and phone number, across all months. This is not a month-end balance. Older bills are not added again, to avoid counting carried amounts twice; check that unpaid balances were carried to the latest bill.</p><Table><TableHeader><TableRow><TableHead>{personal ? "Buyer / record" : "Customer"}</TableHead><TableHead>Week ending</TableHead><TableHead>Pending</TableHead></TableRow></TableHeader><TableBody>{report.balances.map(row => <TableRow key={row.key}><TableCell>{row.customer}{row.phone && <small>{row.phone}</small>}</TableCell><TableCell>{dateLabel(flowerDate(row.weekStart, 6))}</TableCell><TableCell>{money(row.pending)}</TableCell></TableRow>)}</TableBody></Table></CollapsibleContent></Collapsible>
  </section>;
}
