"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import type { SupplierActionState } from "@/app/admin/suppliers/actions";

/**
 * Form shells for supplier actions.
 *
 * They differ from the shared admin ones in a single, important way: a supplier
 * action has something to say when it *succeeds* — how many items synced, what
 * the connection test found — so success is rendered, not just failure.
 */

export type SupplierAction = (
  state: SupplierActionState,
  form: FormData,
) => Promise<SupplierActionState>;

export function ResultBanner({ state }: { state: SupplierActionState }) {
  if (state.error) {
    return (
      <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
        {state.error}
      </p>
    );
  }
  if (state.ok && state.message) {
    return (
      <p className="rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-xs text-success">
        {state.message}
      </p>
    );
  }
  return null;
}

export function SupplierActionForm({
  action,
  children,
  className,
  onDone,
}: {
  action: SupplierAction;
  children: React.ReactNode;
  className?: string;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(
    async (previous: SupplierActionState, form: FormData) => {
      const result = await action(previous, form);
      if (result.ok) onDone?.();
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className={className}>
      <div className="mb-3 empty:mb-0">
        <ResultBanner state={state} />
      </div>
      {children}
    </form>
  );
}

/**
 * A single button that runs one action — test, sync, toggle — and shows its
 * outcome inline. Long-running by nature, so the pending state is explicit.
 */
export function SupplierButtonForm({
  action,
  fields,
  label,
  pendingLabel,
  variant = "ghost",
  confirm,
  className,
}: {
  action: SupplierAction;
  fields: Record<string, string>;
  label: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "ghost" | "danger";
  confirm?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <div className="space-y-2">
      <form
        action={formAction}
        onSubmit={(event) => {
          if (confirm && !window.confirm(confirm)) event.preventDefault();
        }}
      >
        {Object.entries(fields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <PendingButton variant={variant} pendingLabel={pendingLabel} className={className}>
          {label}
        </PendingButton>
      </form>
      <ResultBanner state={state} />
    </div>
  );
}

export function PendingButton({
  children,
  variant = "primary",
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "tap flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60",
        variant === "primary" && "bg-brand text-white hover:bg-brand-600",
        variant === "ghost" && "border border-line bg-surface text-fg hover:border-brand/40",
        variant === "danger" &&
          "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
        className,
      )}
    >
      {pending ? (pendingLabel ?? "…") : children}
    </button>
  );
}

/** Small status pill used across the supplier screens. */
export function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "danger" | "warn" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold",
        tone === "success" && "border border-success/40 bg-success/10 text-success",
        tone === "danger" && "border border-danger/40 bg-danger/10 text-danger",
        tone === "warn" && "border border-warn/40 bg-warn/10 text-warn",
        tone === "muted" && "border border-line bg-surface-2 text-muted",
      )}
    >
      {children}
    </span>
  );
}
