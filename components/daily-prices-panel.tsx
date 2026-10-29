"use client";
import {T} from "@/components/language";

import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, ChevronRight, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dailyPricesRequest } from "@/lib/bills-client";
import { todayInIndia, type DailyPrice } from "@/lib/daily-prices";

type Props = { date: string; prices: Record<string, DailyPrice>; onDateChange: (date: string) => void; onPrices: (prices: DailyPrice[]) => void; onContinue: () => void };

export function DailyPricesPanel({ date, prices, onDateChange, onPrices, onContinue }: Props) {
  const fixed = prices[date];
  const [mPrice, setMPrice] = useState("");
  const [jPrice, setJPrice] = useState("");
  const [loading, setLoading] = useState(!fixed);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const label = new Date(date + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    dailyPricesRequest(date, date, { cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (active) onPrices(data.prices);
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : "Could not load prices. Please retry."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, refresh, onPrices]);
  const save = async () => {
    if (saving || loading || mPrice === "" || jPrice === "") return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await dailyPricesRequest(date, date, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, jasmineRate: Number(mPrice), pinkRate: Number(jPrice) }) });
      const data = await response.json();
      if (data.price) { onPrices([data.price]); }
      if (!response.ok) throw new Error(data.error);
      setMessage("Default rates saved. You can change each customer's rates separately in Daily entry.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not confirm prices. Please refresh and check."); }
    finally { setSaving(false); }
  };
  return <section className="panel daily-prices-panel" aria-label="Daily flower prices">
    <div className="daily-prices-toolbar"><label htmlFor="daily-price-date"><T text="Flower date"/><Input id="daily-price-date" type="date" value={date} disabled={saving} onChange={event => { if(event.target.value) onDateChange(event.target.value); }} /></label><Button variant="outline" disabled={saving} onClick={() => onDateChange(todayInIndia())}><CalendarDays /> <T text="Today"/></Button><Button variant="ghost" disabled={saving || loading} onClick={() => setRefresh(value => value + 1)}><RotateCcw /> <T text="Refresh prices"/></Button></div>
    <div className="daily-prices-heading"><div><h3>{label}</h3><p>Default rates for the date. Each customer can have a different rate on their own bill.</p></div>{fixed && <span className="price-lock-badge"><span><T text="Prices saved"/><small>Editable directly</small></span></span>}</div>
    {error && <p className="status-bar error" role="alert">{error}</p>}
    {message && <p className="status-bar" role="status"><CheckCircle2 />{message}</p>}
    {loading && !fixed && <p className="status-bar" role="status">Checking prices for this date…</p>}
    <form aria-label="Set daily flower prices" onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="flower-fields-grid">{([{ code: "M", name: "Jasmine", kind: "jasmine", value: mPrice, change: setMPrice }, { code: "J", name: "Pink Jasmine", kind: "pink", value: jPrice, change: setJPrice }] as const).map(flower => <section className={`daily-flower ${flower.kind}`} key={flower.code}>
        <div className="flower-title"><span className="flower-code">{flower.code}</span><div><h3><T text={flower.name}/></h3><p><T text="Price per atte · 3,200 buds"/></p></div></div>
        <img className="daily-flower-photo" src={flower.kind === "jasmine" ? "/mallige-reference.png" : "/jajji-reference.png"} alt="" aria-hidden="true" />
        <label htmlFor={`daily-price-${flower.code}`}>{flower.code} price per atte (₹)<Input id={`daily-price-${flower.code}`} type="number" inputMode="decimal" min="0" max="100000000" step="any" required value={flower.value !== "" ? flower.value : (fixed ? String(fixed[`${flower.kind}Rate`]) : "")} disabled={loading || saving} onChange={event => flower.change(event.target.value)} placeholder="Enter price" /></label>
      </section>)}</div>
      <p className="daily-price-rule">{fixed ? "Change these default rates for this date. Individual customer bills can use different rates." : "Set the default rates. You can adjust rates separately on each customer's bill."}</p>
      <div className="daily-prices-actions"><Button type="submit" disabled={loading || saving || mPrice === "" || jPrice === ""}><Save />{saving ? "Saving prices…" : fixed ? "Save price correction" : "Save prices"}</Button><Button type="button" variant="outline" disabled={saving} onClick={onContinue}><T text="Go to daily entry"/> <ChevronRight /></Button></div>
    </form>
    <p className="daily-price-note">These are starting defaults by flower date. Each customer's saved bill keeps its own editable rates.</p>
  </section>;
}
