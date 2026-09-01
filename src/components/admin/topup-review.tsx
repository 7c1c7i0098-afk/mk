"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Check, X } from "lucide-react";
import { StatusPill } from "@/components/admin/supplier-ui";
import {
  approveTopUpRequest,
  rejectTopUpRequest,
  type WalletAdminState,
} from "@/app/admin/wallet/actions";
import { formatMoney } from "@/lib/money";
import type { TopUpStatus } from "@/generated/prisma/enums";

/**
 * Reviewing what customers claim to have paid.
 *
 * Approving here credits a wallet, so the row shows everything a reviewer needs
 * to match the claim against the bank: who, how much, through which rail, and
 * the reference they quoted. The note field is shared by both buttons — a
 * rejection reason reaches the customer, an approval note stays in the audit.
 */

export type TopUpRow = {
  id: string;
  /** Deposit number — its own series, never a store-order number. */
  number: number;
  userName: string;
  userEmail: string;
  userPublicId: string | null;
  methodName: string;
  amount: number;
  fee: number;
  credited: number;
  status: TopUpStatus;
  reference: string | null;
  note: string | null;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewerName: string | null;
};

const STATUS_LABELS: Record<TopUpStatus, string> = {
  PENDING: "قيد المراجعة",
  APPROVED: "معتمد",
  REJECTED: "مرفوض",
  CANCELLED: "ملغى",
};

const STATUS_TONE: Record<TopUpStatus, "success" | "danger" | "warn" | "muted"> = {
  PENDING: "warn",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "muted",
};

export function TopUpReview({ requests }: { requests: TopUpRow[] }) {
  if (requests.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface px-4 py-10 text-center text-sm text-muted">
        لا توجد طلبات شحن
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {requests.map((request) => (
        <li key={request.id} className="space-y-3 rounded-2xl border border-line bg-surface p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-fg">{request.userName}</span>
            {request.userPublicId && (
              <span className="num text-[11px] text-muted-2">#{request.userPublicId}</span>
            )}
            <span className="num text-[11px] text-muted">شحن #{request.number}</span>
            <StatusPill tone={STATUS_TONE[request.status]}>
              {STATUS_LABELS[request.status]}
            </StatusPill>
            <span className="num ms-auto text-sm font-bold text-brand">
              {formatMoney(request.credited)}
            </span>
          </div>

          <div className="grid gap-2 rounded-xl border border-line bg-ink p-3 sm:grid-cols-4">
            <Fact label="الطريقة">{request.methodName}</Fact>
            <Fact label="المبلغ المدفوع">
              <span className="num">{formatMoney(request.amount)}</span>
            </Fact>
            <Fact label="الرسوم">
              <span className="num">
                {request.fee > 0 ? formatMoney(request.fee) : "—"}
              </span>
            </Fact>
            <Fact label="رقم العملية">
              <span dir="ltr" className="num block truncate text-start">
                {request.reference ?? "—"}
              </span>
            </Fact>
          </div>

          <p className="num text-[11px] text-muted-2">
            {request.userEmail} · {request.createdAt}
            {request.reviewedAt && request.reviewerName
              ? ` · روجع بواسطة ${request.reviewerName} في ${request.reviewedAt}`
              : ""}
          </p>

          {request.note && (
            <p className="rounded-xl border border-line bg-ink px-3 py-2 text-[11px] text-muted">
              ملاحظة العميل: {request.note}
            </p>
          )}

          {request.adminNote && (
            <p className="rounded-xl border border-line bg-ink px-3 py-2 text-[11px] text-muted">
              ملاحظة الإدارة: {request.adminNote}
            </p>
          )}

          {request.status === "PENDING" && <ReviewControls id={request.id} />}
        </li>
      ))}
    </ul>
  );
}

function ReviewControls({ id }: { id: string }) {
  const [approveState, approveAction] = useActionState(approveTopUpRequest, {});
  const [rejectState, rejectAction] = useActionState(rejectTopUpRequest, {});
  const state: WalletAdminState = approveState.error ? approveState : rejectState;

  return (
    <div className="space-y-2">
      {state.error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[11px] text-danger">
          {state.error}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        {/* One note field, submitted by whichever button is pressed. */}
        <input
          form={`approve-${id}`}
          name="adminNote"
          placeholder="سبب الرفض أو ملاحظة للسجل…"
          className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-fg outline-none focus:border-brand/60"
          onChange={(event) => {
            const mirror = document.querySelector<HTMLInputElement>(`#reject-note-${id}`);
            if (mirror) mirror.value = event.target.value;
          }}
        />

        <form action={approveAction} id={`approve-${id}`}>
          <input type="hidden" name="id" value={id} />
          <ActionButton
            tone="success"
            confirm="اعتماد الطلب وإضافة الرصيد إلى محفظة العميل؟"
            icon={<Check className="size-4" />}
          >
            اعتماد
          </ActionButton>
        </form>

        <form action={rejectAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="adminNote" id={`reject-note-${id}`} />
          <ActionButton
            tone="danger"
            confirm="رفض طلب الشحن؟"
            icon={<X className="size-4" />}
          >
            رفض
          </ActionButton>
        </form>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  tone,
  confirm,
  icon,
}: {
  children: React.ReactNode;
  tone: "success" | "danger";
  confirm: string;
  icon: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
      className={`tap flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border px-5 text-sm font-semibold transition disabled:opacity-60 ${
        tone === "success"
          ? "border-success/40 bg-success/10 text-success hover:bg-success/20"
          : "border-danger/40 bg-danger/10 text-danger hover:bg-danger/20"
      }`}
    >
      {pending ? "…" : icon}
      {!pending && children}
    </button>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[10px] text-muted-2">{label}</p>
      <div className="min-w-0 truncate text-xs text-fg">{children}</div>
    </div>
  );
}
