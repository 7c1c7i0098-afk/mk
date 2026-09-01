"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type BaseProps = {
  label: string;
  error?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "className">;

export function TextField({ label, error, className, ...props }: BaseProps) {
  const generatedId = useId();
  const id = props.id ?? generatedId;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        className={cn(
          "h-12 w-full rounded-2xl border bg-surface px-4 text-[15px] text-fg outline-none transition placeholder:text-muted",
          "focus:bg-surface-2 focus:ring-4 focus:ring-brand/10",
          error ? "border-danger focus:border-danger" : "border-line focus:border-brand/60",
        )}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function PasswordField({ label, error, className, ...props }: BaseProps) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          {...props}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          className={cn(
            "h-12 w-full rounded-2xl border bg-surface px-4 pe-12 text-[15px] text-fg outline-none transition placeholder:text-muted",
            "focus:bg-surface-2 focus:ring-4 focus:ring-brand/10",
            error ? "border-danger focus:border-danger" : "border-line focus:border-brand/60",
          )}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          className="absolute end-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
        >
          {visible ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export function SubmitButton({
  children,
  loading,
  ...props
}: { loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="submit"
      {...props}
      disabled={loading || props.disabled}
      className="tap h-12 w-full rounded-2xl bg-brand text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "جارٍ المعالجة…" : children}
    </button>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      {message}
    </p>
  );
}
