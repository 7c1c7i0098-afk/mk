"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { clearStoredCart } from "@/lib/cart-storage";

/**
 * Ends the session server-side, then drops the locally mirrored cart so the
 * next person on this device never sees the previous customer's items.
 * The stored cart stays safe in the database for the next sign-in.
 */
export function LogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("logout failed");

      clearStoredCart();
      // Full navigation so every server component re-renders as a guest.
      window.location.assign("/");
    } catch {
      toast.error("تعذّر تسجيل الخروج، حاول مرة أخرى");
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={loading}
      className="tap flex w-full items-center justify-center gap-2 rounded-2xl border border-danger/40 bg-danger/10 py-3.5 text-sm font-bold text-danger transition hover:bg-danger/20 disabled:opacity-60"
    >
      <LogOut className="size-4" />
      {loading ? "جارٍ تسجيل الخروج…" : "تسجيل الخروج"}
    </button>
  );
}
