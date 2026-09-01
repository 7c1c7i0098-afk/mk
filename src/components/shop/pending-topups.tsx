"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Hourglass, XCircle } from "lucide-react";
import { cancelTopUp, type WalletState } from "@/app/(shop)/wallet/actions";
import { MoneyText } from "@/components/shop/money-text";
import type { TopUpStatus } from "@/generated/prisma/enums";

/**
 * Top-up claims still waiting on a decision, plus recently rejected ones.
 *
 * Shown above the history rather than inside it on purpose: none of these has
 * moved money, so mixing them into the ledger would suggest a balance change
 * that has not happened.
 */

export type PendingTopUp = {
  id: string;
  /** Deposit number, its own series — see src/lib/sequences.ts. */
  number: number;
  methodName: string;
  amount: number;
  credited: number;
  status: TopUpStatus;
  adminNote: string | null;
  createdAt: string;
};

export function PendingTopUps({ requests }: { requests: PendingTopUp[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold text-fg">طلبات الشحن</h2>

      <ul className="space-y-2">
        {requests.map((request) => (
          <li
            key={request.id}
            className={`space-y-2 rounded-2xl border p-3.5 ${
              request.status === "PENDING"
                ? "border-warn/40 bg-warn/5"
                : "border-danger/40 bg-danger/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-xl border ${
                  request.status === "PENDING"
                    ? "border-warn/40 bg-warn/10 text-warn"
                    : "border-danger/40 bg-danger/10 text-danger"
                }`}
              >
                {request.status === "PENDING" ? (
                  <Hourglass className="size-4.5" />
                ) : (
                  <XCircle className="size-4.5" />
                )}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{request.methodName}</p>
                <p className="num text-[11px] text-muted">
                  رقم الشحن - #{request.number}
                </p>
                <p className="tnum text-[11px] text-muted-2">
                  {request.status === "PENDING" ? "قيد المراجعة" : "مرفوض"} ·{" "}
                  {request.createdAt}
                </p>
              </div>

              <div className="shrink-0 text-end">
                <MoneyText value={request.amount} className="text-sm font-bold text-fg" />
                {request.credited !== request.amount && (
                  <p className="text-[10px] text-muted-2">
                    يُضاف <MoneyText value={request.credited} />
                  </p>
                )}
              </div>
            </div>

            {request.adminNote && (
              <p className="rounded-xl border border-line bg-surface px-3 py-2 text-[11px] text-muted">
                {request.adminNote}
              </p>
            )}

            {request.status === "PENDING" && <CancelForm id={request.id} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CancelForm({ id }: { id: string }) {
  const router = useRouter();

  const [state, formAction] = useActionState(
    async (previous: WalletState, form: FormData) => {
      const result = await cancelTopUp(previous, form);
      if (result.ok) router.refresh();
      return result;
    },
    {},
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm("إلغاء طلب الشحن هذا؟")) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <CancelButton />
      {state.error && <p className="mt-1 text-[11px] text-danger">{state.error}</p>}
    </form>
  );
}

function CancelButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="tap w-full rounded-xl border border-line bg-surface py-2.5 text-xs font-semibold text-muted transition hover:text-fg disabled:opacity-60"
    >
      {pending ? "…" : "إلغاء الطلب"}
    </button>
  );
}
