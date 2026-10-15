import {readMarketPrices} from '@/app/api/market-prices/route';
export async function GET(){return readMarketPrices();}
