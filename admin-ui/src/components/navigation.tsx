import React from "react";
import { useEffect, useState } from "react";
import { Activity, BriefcaseBusiness, ChevronDown, Globe2, LayoutDashboard, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { isActive } from "../utils";

export const navItems = [
  { label: "業務アプリ", href: "/admin", icon: LayoutDashboard },
  { label: "SEO営業 概要", href: "/admin/seo-sales", icon: BriefcaseBusiness },
  { label: "最新結果", href: "/admin/seo-sales/sites", icon: Globe2 },
  { label: "実行ログ", href: "/admin/seo-sales/runs", icon: Activity },
  { label: "外部サービス設定", href: "/admin/seo-sales/settings", icon: Settings },
];

export function SidebarGroup({ label, items, path }: { label: string; items: typeof navItems; path: string }) {
  const containsActiveItem = items.some((item) => isActive(item.href, path));
  const [open, setOpen] = useState(containsActiveItem);

  useEffect(() => {
    if (containsActiveItem) setOpen(true);
  }, [containsActiveItem]);

  return (
    <div>
      <button type="button" className="flex w-full items-center justify-between px-3 py-1 text-left text-[11px] font-bold uppercase tracking-normal text-slate-500" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span>{label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "" : "-rotate-90"}`} />
      </button>
      {open ? (
        <div className="mt-2 space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, path);
            return (
              <Link key={item.href} to={item.href} className={`relative flex items-center gap-3 border px-3 py-2.5 pl-4 text-sm font-bold ${active ? "border-blue-200 bg-blue-50 text-slate-950" : "border-transparent text-slate-300 hover:border-slate-200 hover:bg-white hover:text-slate-950"}`} aria-current={active ? "page" : undefined}>
                {active ? <span className="absolute inset-y-2 left-0 w-1 bg-blue-700" aria-hidden="true" /> : null}
                <Icon className={`h-4 w-4 ${active ? "text-blue-700" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
