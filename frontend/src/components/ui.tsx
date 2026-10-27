import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle, type LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/* Small set of building blocks so every page looks the same. */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  icon?: LucideIcon;
  loading?: boolean;
};

const BUTTON_VARIANTS = {
  primary: "border-blue-700 bg-blue-600 text-white hover:bg-blue-700",
  secondary: "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50",
  danger: "border-zinc-300 bg-white text-red-700 hover:border-red-300 hover:bg-red-50",
  ghost: "border-transparent bg-transparent text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
};

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  loading = false,
  className = "",
  type = "button",
  children,
  disabled,
  ...props
}: ButtonProps) {
  const sizing = size === "sm" ? "h-7 gap-1 px-2 text-xs" : "h-8 gap-1.5 px-3 text-sm";
  const iconOnly = !children;
  const shown = loading ? Loader2 : Icon;
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center ${className.includes("justify-") ? "" : "justify-center"} whitespace-nowrap rounded border font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 ${sizing} ${iconOnly ? (size === "sm" ? "w-7 px-0" : "w-8 px-0") : ""} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {shown && <ButtonIcon icon={shown} spin={loading} small={size === "sm"} />}
      {children}
    </button>
  );
}

function ButtonIcon({ icon: Icon, spin, small }: { icon: LucideIcon; spin: boolean; small: boolean }) {
  return <Icon aria-hidden className={`${small ? "h-3.5 w-3.5" : "h-4 w-4"} ${spin ? "animate-spin" : ""}`} strokeWidth={2} />;
}

export function Panel({
  title,
  actions,
  children,
  bodyClassName = "p-4",
  className = "",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-md border border-zinc-200 bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex min-h-10 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-1.5">
          <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const BADGE_TONES: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-800 ring-red-200",
  info: "bg-blue-50 text-blue-800 ring-blue-200",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

const BANNER_TONES: Record<Tone, string> = {
  neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
};

const BANNER_ICONS: Record<Tone, LucideIcon> = {
  neutral: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};

export function Banner({ tone = "info", children, action }: { tone?: Tone; children: ReactNode; action?: ReactNode }) {
  const Icon = BANNER_ICONS[tone];
  return (
    <div className={`flex items-start gap-2.5 rounded border px-3 py-2 text-sm ${BANNER_TONES[tone]}`}>
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-sm text-red-700">
      <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium text-zinc-600">{label}</span>
      {children}
      {hint && <span className="block text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      {Icon && <Icon aria-hidden className="mb-2 h-6 w-6 text-zinc-400" strokeWidth={1.75} />}
      <p className="text-sm font-medium text-zinc-700">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-zinc-500">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 pb-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: LucideIcon }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded border border-zinc-300 bg-white p-0.5">
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className={`inline-flex h-6 items-center gap-1 rounded-sm px-2 text-xs font-medium ${
            option.value === value ? "bg-zinc-800 text-white" : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {option.icon && <option.icon aria-hidden className="h-3.5 w-3.5" />}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-zinc-500">
      <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
      {label}
    </span>
  );
}

/** An anchor styled like a Button, for downloads and links to other pages. */
export function LinkButton({
  href,
  icon: Icon,
  variant = "secondary",
  children,
}: {
  href: string;
  icon?: LucideIcon;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded border px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${BUTTON_VARIANTS[variant]}`}
    >
      {Icon && <Icon aria-hidden className="h-4 w-4" />}
      {children}
    </a>
  );
}
