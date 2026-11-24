"use client";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { animate, useReducedMotion } from "motion/react";
import {
  X,
  Search,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Files,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
export { Button };
export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function Empty({
  title = "No records",
  children,
  action,
  icon: Icon = Files,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={23} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
export function ErrorNotice({ message }: { message?: string }) {
  return message ? (
    <div role="alert" className="notice error">
      <AlertCircle size={17} />
      {message}
    </div>
  ) : null;
}
export function Tag({
  children,
  tone = "purple",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Search by name or admission number",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-box">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
export function Pager({
  page,
  onChange,
  count,
}: {
  page: number;
  onChange: (page: number) => void;
  count: number;
}) {
  if (!count && !page) return null;
  if (!page && count < 100)
    return (
      <div className="pager">
        <span>
          {count} {count === 1 ? "record" : "records"}
        </span>
      </div>
    );
  return (
    <div className="pager">
      <span>
        Page {page + 1} · {count} records
      </span>
      <Button
        variant="outline"
        disabled={!page}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ArrowLeft />
      </Button>
      <Button
        variant="outline"
        disabled={count < 100}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <ArrowRight />
      </Button>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <dialog
        open
        aria-modal="true"
        aria-label={title}
        className="modal"
        onCancel={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const els = Array.from(
              e.currentTarget.querySelectorAll<HTMLElement>(
                "button,input,select,textarea,a[href]",
              ),
            ).filter((x) => !x.hasAttribute("disabled"));
            const first = els[0],
              last = els[els.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="panel-heading">
          <h2>{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close dialog"
            autoFocus
          >
            <X />
          </Button>
        </div>
        {children}
      </dialog>
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const labelId = useId();
  return (
    <label className="field">
      <span id={labelId}>{label}</span>
      {isValidElement<{ "aria-labelledby"?: string }>(children)
        ? cloneElement(children, { "aria-labelledby": labelId })
        : children}
    </label>
  );
}
export function DownloadLink({
  href,
  children,
  className = "primary-link",
  validate,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  validate?: () => string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <span className="download-control">
      <button
        className={className}
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          const invalid = validate?.();
          if (invalid) {
            setError(invalid);
            return;
          }
          setBusy(true);
          setError("");
          try {
            const response = await fetch(href);
            if (!response.ok) {
              const body = await response.json();
              throw new Error(body.error || "Could not export this report.");
            }
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download =
              response.headers
                .get("Content-Disposition")
                ?.match(/filename="([^"]+)"/)?.[1] || "star-system-report";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
          } catch (e) {
            setError(
              e instanceof Error
                ? e.message
                : "The download failed. Please try again.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Preparing download…" : children}
      </button>
      {error ? (
        <small className="download-error" role="alert">
          {error}
        </small>
      ) : null}
    </span>
  );
}
const numberFormat = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 1,
});
export function AnimatedNumber({ value }: { value: number }) {
  const number = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = number.current;
    if (!el || reduced || value <= 1) return;
    const controls = animate(1, value, {
      duration: 0.5,
      onUpdate: (next) => {
        el.textContent = numberFormat.format(Math.round(next));
      },
    });
    return () => controls.stop();
  }, [reduced, value]);
  const text = numberFormat.format(value);
  return (
    <>
      <span aria-hidden="true" ref={number}>
        {text}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}
export function Form({
  children,
  onSubmit,
  submit = "Save changes",
  disabled = false,
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => Promise<void>;
  submit?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        setBusy(true);
        setError("");
        try {
          await onSubmit(new FormData(form));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not save.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      <ErrorNotice message={error} />
      <div className="form-footer">
        <Button type="submit" disabled={busy || disabled}>
          {busy ? "Saving…" : submit}
        </Button>
      </div>
    </form>
  );
}
