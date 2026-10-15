"use client";
import {useState} from "react";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {todayInIndia} from "@/lib/daily-prices";
import {isPaymentAmount,type PaymentRecord} from "@/lib/bill-payments";
import {T} from "@/components/language";
export function PaymentHistory({records,paid,pending,onAdd}:{records:PaymentRecord[];paid:number;pending:number;onAdd:(r:PaymentRecord)=>void}) {
 const [date,setDate]=useState(todayInIndia);const [amount,setAmount]=useState("");const [method,setMethod]=useState<PaymentRecord['method']>("Cash");const [note,setNote]=useState("");const [error,setError]=useState("");
 const legacy=(Math.round(paid*100)-records.reduce((n,r)=>n+Math.round(r.amount*100),0))/100;
 function add(){const n=Number(amount);if(!date||!isPaymentAmount(n)||n<=0||n>pending){setError("Enter a date and a payment greater than zero, no more than the pending balance.");return;}onAdd({id:crypto.randomUUID(),date,amount:n,method,note:note.trim()});setAmount("");setNote("");setError("");}
 return <section className="payment-history"><h3><T text="Payment history"/></h3>{legacy>0&&<p>Earlier payments (date not recorded): ₹{legacy.toFixed(2)}</p>}{records.length===0&&legacy===0&&<p><T text="No payments yet"/></p>}<ul>{records.map(r=><li key={r.id}><strong>₹{r.amount.toFixed(2)}</strong><span>{r.date} · <T text={r.method}/></span>{r.note&&<span>{r.note}</span>}</li>)}</ul><label><T text="Payment date"/><Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label><T text="Payment amount"/> (₹)<Input type="number" min="0.01" step="0.01" max={Math.max(0,pending)} value={amount} onChange={e=>setAmount(e.target.value)}/></label><label><T text="Payment method"/><select value={method} onChange={e=>setMethod(e.target.value as PaymentRecord['method'])}>{["Cash","UPI","Bank transfer","Other"].map(m=><option key={m} value={m}>{m}</option>)}</select></label><label><T text="Note (optional)"/><Input value={note} maxLength={200} onChange={e=>setNote(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<Button type="button" variant="outline" onClick={add} disabled={!amount||pending<=0||records.length>=500}><T text="Add payment"/></Button><p className="field-help"><T text="Save the bill to keep payment changes."/></p></section>;
}
