import React, { useState } from "react";
import { apiCache, apiPost } from "../../api";
import type { ContactSuppression } from "../../types";

export function ContactSuppressionPanel({ suppressions }: { suppressions: ContactSuppression[] }) {
  const [items, setItems] = useState(suppressions);
  const [kind, setKind] = useState<ContactSuppression["kind"]>("email");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("do_not_contact");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function addSuppression() {
    if (!value.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiPost<{ suppressions: ContactSuppression[] }>("/api/admin/seo-sales/contact-suppressions", {
        kind,
        value,
        reason,
      });
      setItems(result.suppressions);
      setValue("");
      apiCache.delete("/api/admin/seo-sales/settings");
      setNotice("連絡不要リストに追加しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "連絡不要リストを更新できませんでした");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[120px_minmax(0,1fr)_minmax(180px,0.45fr)_auto]">
        <label className="text-sm font-black text-slate-700" htmlFor="suppression-kind">
          種別
          <select id="suppression-kind" className="input mt-2 w-full" value={kind} onChange={(event) => setKind(event.target.value as ContactSuppression["kind"])}>
            <option value="email">メール</option>
            <option value="domain">ドメイン</option>
          </select>
        </label>
        <label className="text-sm font-black text-slate-700" htmlFor="suppression-value">
          対象
          <input
            id="suppression-value"
            className="input mt-2 w-full"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={kind === "email" ? "info@example.com" : "example.com"}
          />
        </label>
        <label className="text-sm font-black text-slate-700" htmlFor="suppression-reason">
          理由
          <input id="suppression-reason" className="input mt-2 w-full" value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <div className="flex items-end">
          <button type="button" className="btn-primary w-full" disabled={saving || !value.trim()} onClick={() => void addSuppression()}>
            {saving ? "追加中..." : "追加"}
          </button>
        </div>
      </div>

      {notice ? <div className="border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{notice}</div> : null}
      {error ? <div className="border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}

      <div className="border border-slate-200 bg-slate-50">
        {items.length === 0 ? (
          <div className="p-3 text-sm font-bold text-slate-500">登録済みの連絡不要メール/ドメインはありません。</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {items.slice(0, 20).map((item) => (
              <div key={item.id} className="grid gap-2 p-3 text-sm md:grid-cols-[90px_minmax(0,1fr)_minmax(120px,0.4fr)_minmax(120px,0.4fr)]">
                <span className="font-black text-slate-700">{item.kind === "email" ? "メール" : "ドメイン"}</span>
                <span className="break-all font-semibold text-slate-900">{item.value}</span>
                <span className="font-semibold text-slate-600">{item.reason}</span>
                <span className="text-xs font-bold text-slate-500">{formatDate(item.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(value: number): string {
  return new Date(value).toLocaleString("ja-JP", { dateStyle: "medium", timeStyle: "short" });
}
