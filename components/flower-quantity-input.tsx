"use client";
import {T} from "@/components/language";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUDS, type Unit } from "@/lib/flower-calculation";
import { chenduAndBuds, splitChenduAndBuds } from "@/lib/flower-quantity";

type Mode = "mixed" | Unit;
type Props = { fieldId: string; qty: number; unit: Unit; onChange: (qty: number, unit: Unit) => void; onEditing: () => void };

export function FlowerQuantityInput({ fieldId, qty, unit, onChange, onEditing }: Props) {
  const split = splitChenduAndBuds(qty, unit);
  const [mode, setMode] = useState<Mode>(() => Number.isInteger(split.totalBuds) ? "mixed" : unit);
  const [parts, setParts] = useState(() => ({ chendus: String(split.chendus), buds: String(split.extraBuds) }));
  useEffect(() => {
    const next = splitChenduAndBuds(qty, unit);
    setParts(current => {
      const entered = Number(current.chendus) * BUDS.chendu + Number(current.buds);
      return entered === next.totalBuds ? current : { chendus: String(next.chendus), buds: String(next.extraBuds) };
    });
  }, [qty, unit]);
  const invalidParts = ![Number(parts.chendus), Number(parts.buds)].every(n => Number.isSafeInteger(n) && n >= 0);
  const changePart = (key: "chendus" | "buds", text: string) => {
    const next = { ...parts, [key]: text };
    setParts(next);
    onEditing();
    try { onChange(chenduAndBuds(Number(next.chendus), Number(next.buds)), "buds"); }
    catch { /* Keep the draft visible. The form's whole-number validation prevents saving it. */ }
  };
  return <div className="quantity-entry">
    <div className="field-label quantity-mode"><label id={`${fieldId}-mode-label`}>Enter quantity as</label><Select value={mode} onValueChange={value => {
      setMode(value as Mode);
      setParts({ chendus: String(split.chendus), buds: String(split.extraBuds) });
    }}><SelectTrigger aria-labelledby={`${fieldId}-mode-label`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mixed">Chendus + extra buds</SelectItem><SelectItem value="buds"><T text="Total buds"/></SelectItem><SelectItem value="chendu">Chendu (decimal)</SelectItem><SelectItem value="atte">Atte</SelectItem></SelectContent></Select></div>
    {mode === "mixed" ? <>
      <div className="quantity-fields">
        <label htmlFor={`${fieldId}-chendus`}>Chendu units<Input id={`${fieldId}-chendus`} type="number" min="0" max="125000" step="1" inputMode="numeric" value={parts.chendus} onFocus={e => e.target.select()} onChange={e => changePart("chendus", e.target.value)} aria-describedby={`${fieldId}-help`} /><span className="quantity-help"><T text="1 chendu = 800 buds"/></span></label>
        <label htmlFor={`${fieldId}-buds`}><T text="Buds"/><Input id={`${fieldId}-buds`} type="number" min="0" max="100000000" step="1" inputMode="numeric" value={parts.buds} onFocus={e => e.target.select()} onChange={e => changePart("buds", e.target.value)} aria-describedby={`${fieldId}-help`} /><span className="quantity-help"><T text="Extra individual buds"/></span></label>
      </div>
      <p id={`${fieldId}-help`} className={`quantity-help ${invalidParts ? "quantity-error" : ""}`} role={invalidParts ? "alert" : undefined}>{invalidParts ? "Use whole numbers. For 1 chendu + 200 buds, enter 1 and 200 separately." : `${parts.chendus || "0"} × 800 + ${parts.buds || "0"} = ${split.totalBuds.toLocaleString("en-IN")} buds`}</p>
    </> : <label className="quantity-single" htmlFor={`${fieldId}-quantity`}>{mode === "buds" ? "Total buds" : mode === "chendu" ? "Decimal chendus" : "Atte quantity"}<Input id={`${fieldId}-quantity`} type="number" min="0" max="100000000" step={mode === "buds" ? "1" : "any"} inputMode={mode === "buds" ? "numeric" : "decimal"} value={split.totalBuds / BUDS[mode]} onFocus={e => e.target.select()} onChange={e => {
      const value = Number(e.target.value);
      if(Number.isFinite(value) && value >= 0) onChange(value, mode);
    }} />{mode === "chendu" && <span className="quantity-help">Decimal entry: 1.25 chendus = 1,000 buds. Use “Chendus + extra buds” for separate counts.</span>}</label>}
  </div>;
}
