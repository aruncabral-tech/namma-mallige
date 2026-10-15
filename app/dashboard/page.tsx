"use client";
import {AccountGate} from '@/components/account-gate';
import {MarketDashboard} from '@/components/market-dashboard';
export default function Page(){return <AccountGate>{()=> <MarketDashboard/>}</AccountGate>;}
