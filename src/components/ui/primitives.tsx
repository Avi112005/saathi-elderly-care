import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "./icon";
import { initials } from "@/lib/domain/format";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export type ButtonSize = "md" | "lg" | "sm";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-sky-600 text-white shadow-[0_6px_16px_-8px_rgb(59_102_174/0.8)] hover:bg-sky-700",
  secondary: "bg-surface text-ink border border-line-2 hover:border-sky-300 hover:bg-sky-50",
  ghost: "text-ink-2 hover:bg-paper-2 hover:text-ink",
  danger: "bg-surface text-rose-700 border border-rose-100 hover:bg-rose-100",
  success: "bg-sage-700 text-white hover:bg-[#2f573f]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "min-h-11 px-4 text-[0.95rem] gap-2 rounded-xl",
  lg: "min-h-14 px-6 text-lg gap-2.5 rounded-2xl",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  return `inline-flex items-center justify-center font-semibold transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className = "",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; icon?: IconName }) {
  return (
    <button className={buttonClass(variant, size, className)} {...props}>
      {icon && <Icon name={icon} className={size === "lg" ? "size-6" : "size-[1.15em]"} />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  className = "",
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; icon?: IconName }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props}>
      {icon && <Icon name={icon} className={size === "lg" ? "size-6" : "size-[1.15em]"} />}
      {children}
    </Link>
  );
}

export function Card({ className = "", children, ...props }: ComponentProps<"div">) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  );
}

const BADGE: Record<string, string> = {
  sky: "bg-sky-100 text-sky-800",
  sage: "bg-sage-100 text-sage-700",
  rose: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-700",
  marigold: "bg-marigold-100 text-marigold-800",
  ink: "bg-paper-3 text-ink",
};

export function Badge({
  tone = "ink",
  children,
  className = "",
}: {
  tone?: keyof typeof BADGE;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 text-4xl leading-[1.05] sm:text-5xl">{title}</h1>
        {description && <p className="mt-3 text-ink-2">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card dot-grid flex flex-col items-center px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-sky-100 text-sky-700">
        <Icon name={icon} className="size-6" />
      </span>
      <h2 className="mt-4 text-2xl">{title}</h2>
      {children && <p className="mt-2 max-w-md text-ink-2">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

const AVATAR: Record<string, string> = {
  sky: "bg-sky-100 text-sky-800",
  marigold: "bg-marigold-200 text-marigold-800",
  sage: "bg-sage-100 text-sage-700",
  rose: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-700",
  violet: "bg-[#ece6fb] text-[#4b3a8a]",
};

export function Avatar({
  name,
  color = "sky",
  size = "md",
}: {
  name: string;
  color?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "lg" ? "size-16 text-2xl" : size === "sm" ? "size-8 text-xs" : "size-11 text-base";
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-full font-serif ${dims} ${AVATAR[color] ?? AVATAR.sky}`}
    >
      {initials(name)}
    </span>
  );
}

/** Small circular progress ring with an accessible text equivalent. */
export function ProgressRing({
  value,
  size = 96,
  stroke = 9,
  label,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value ?? 0;
  const color =
    value === null
      ? "var(--color-line-2)"
      : pct >= 90
        ? "var(--color-sage)"
        : pct >= 70
          ? "var(--color-marigold-400)"
          : "var(--color-rose)";
  return (
    <div
      className="relative grid place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-paper-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: "stroke-dashoffset .8s var(--ease-soft)" }}
        />
      </svg>
      <span className="absolute font-serif text-2xl" aria-hidden="true">
        {value === null ? "—" : `${value}%`}
      </span>
    </div>
  );
}
