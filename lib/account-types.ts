export const APP_NAME = "Namma Mallige";
export const APP_HEADLINE = "Where Beautiful Blooms Meet Happy Clients.";
export type AccountType = "personal" | "business";
export type OwnerAccount = {
  id: string;
  ownerName: string;
  phone: string;
  accountType: AccountType;
  companyName: string;
  location: string;
  googleSheetUrl: string;
  mpinConfigured: boolean | number;
};
