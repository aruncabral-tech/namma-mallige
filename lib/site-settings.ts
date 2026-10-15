import {billingDb} from '@/db/billing';
import {z} from 'zod';
import {sponsorDefaults,sponsorSchema} from '@/lib/sponsorship';
export const settingsSchema=z.object({sponsor:sponsorSchema.optional(),headline:z.string().trim().min(1).max(160),announcement:z.string().trim().max(1000),marketMode:z.enum(['automatic','manual']),jasminePrice:z.number().finite().min(0).max(1000000),pinkJasminePrice:z.number().finite().min(0).max(1000000),priceDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
export const defaults={sponsor:sponsorDefaults,headline:'Where Beautiful Blooms Meet Happy Clients.',announcement:'',marketMode:'automatic' as const,jasminePrice:0,pinkJasminePrice:0,priceDate:''};
export async function siteSettings(){const row=await billingDb().prepare("SELECT value FROM site_settings WHERE key='main'").first() as {value:string}|null;return row?{...defaults,...JSON.parse(row.value)}:defaults;}
