"use client";

import { createContext, useContext } from "react";
import { NO_DISCOUNT, type DiscountRates } from "@/lib/pricing";

/**
 * The signed-in customer's discount rates, handed down from the server so the
 * client cart can show the price they will actually pay.
 *
 * Display only. The rates here are a copy; the server re-reads them from the
 * database when an order is priced, so editing this in the browser changes what
 * the customer sees and nothing about what they are charged.
 */
const DiscountContext = createContext<DiscountRates>(NO_DISCOUNT);

export function DiscountProvider({
  rates,
  children,
}: {
  rates: DiscountRates;
  children: React.ReactNode;
}) {
  return <DiscountContext.Provider value={rates}>{children}</DiscountContext.Provider>;
}

export function useDiscountRates(): DiscountRates {
  return useContext(DiscountContext);
}
