"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
}

function isActive(pathname: string, href: string) {
  return href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNavLink({ item }: { item: NavItem }) {
  const active = isActive(usePathname(), item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] transition-colors ${active ? "bg-sky-100 font-semibold text-sky-800" : "text-ink-2 hover:bg-paper-2 hover:text-ink"}`}
    >
      <Icon name={item.icon} className="size-5" />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="grid min-w-6 place-items-center rounded-full bg-marigold-400 px-1.5 text-xs font-bold text-ink" aria-label={`${item.badge} waiting`}>
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function TabLink({ item }: { item: NavItem }) {
  const active = isActive(usePathname(), item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-semibold ${active ? "text-sky-700" : "text-ink-2"}`}
    >
      <Icon name={item.icon} className="size-6" />
      {item.label}
      {item.badge ? <span className="absolute top-2 right-[calc(50%-18px)] size-2.5 rounded-full bg-marigold-600" aria-label={`${item.badge} waiting`} /> : null}
    </Link>
  );
}
