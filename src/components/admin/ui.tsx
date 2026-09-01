"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/app/admin/actions";

export function AdminField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-2">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-fg outline-none transition focus:border-brand/60 focus:bg-surface-2 focus:ring-4 focus:ring-brand/10";

export const textareaClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm leading-relaxed text-fg outline-none transition focus:border-brand/60 focus:bg-surface-2 focus:ring-4 focus:ring-brand/10";

export function AdminToggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-fg">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="size-4 accent-[var(--color-brand)]"
      />
      {label}
    </label>
  );
}

export function SubmitButton({
  children,
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "tap rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60",
        variant === "primary" && "bg-brand text-white hover:bg-brand-600",
        variant === "ghost" && "border border-line bg-surface text-fg hover:border-brand/40",
        variant === "danger" && "border border-danger/40 bg-danger/10 text-danger hover:bg-danger/20",
        className,
      )}
    >
      {pending ? "…" : children}
    </button>
  );
}

/** Wraps a server action and surfaces its error message above the form. */
export function ActionForm({
  action,
  children,
  className,
  onDone,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  onDone?: () => void;
}) {
  const [state, formAction] = useActionState(
    async (previous: ActionState, form: FormData) => {
      const result = await action(previous, form);
      if (result.ok) onDone?.();
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className={className}>
      {state.error && (
        <p className="mb-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      )}
      {children}
    </form>
  );
}

export function ConfirmForm({
  action,
  id,
  message,
  children,
}: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  id: string;
  message: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className="inline"
    >
      <input type="hidden" name="id" value={id} />
      {children}
      {state.error && <span className="ms-2 text-[11px] text-danger">{state.error}</span>}
    </form>
  );
}
