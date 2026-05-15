import React from "react";
import { Info } from "../common";
import type { SettingsPayload } from "../../types";

export function IntegrationSettingsList({ items }: { items: SettingsPayload["integrations"] }) {
  const configuredCount = items.filter((item) => item.configured).length;
  const missingCount = items.length - configuredCount;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Info label="設定済み" value={`${configuredCount}/${items.length}`} />
        <Info label="未設定" value={`${missingCount}`} />
      </div>
      <div className="grid gap-2">
        {items.map((item) => (
          <div key={item.key} className={`flex min-h-16 flex-col items-start justify-between gap-3 border px-4 py-3 sm:flex-row sm:items-center sm:gap-4 ${item.configured ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50/50"}`}>
            <span className="min-w-0">
              <span className="block text-sm font-black text-slate-950">{item.label}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">{item.key}</span>
                <span className="border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-black text-slate-500">{formatIntegrationRole(item.key)}</span>
              </span>
            </span>
            <span className={`inline-flex shrink-0 items-center gap-2 border px-2 py-1 ${item.configured ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
              <span className={`status-dot ${item.configured ? "status-dot-on" : ""}`} aria-hidden="true" />
              <span className={`text-xs font-black ${item.configured ? "text-emerald-700" : "text-amber-800"}`}>
                {item.configured ? "接続済み" : "未接続"}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatIntegrationRole(key: string): string {
  if (key.includes("FIRECRAWL")) return "候補発見";
  if (key.includes("GEMINI") || key.includes("ZAI")) return "AI生成";
  if (key.includes("SENDGRID")) return "メール";
  if (key.includes("TELEGRAM")) return "通知";
  if (key.includes("STRIPE")) return "決済";
  if (key.includes("ADMIN")) return "管理";
  return "連携";
}
