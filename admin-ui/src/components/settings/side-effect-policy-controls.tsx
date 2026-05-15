import React from "react";
import { useEffect, useState } from "react";
import { apiCache, apiPut } from "../../api";
import type { PolicyUpdatePayload, SettingsPayload, SideEffectPolicy } from "../../types";
import { hasPolicyChanges, toPolicyUpdatePayload } from "./settings-utils";

export function SideEffectPolicyControls({ policies }: { policies: SettingsPayload["policies"] }) {
  const [items, setItems] = useState(() => policies);
  const [savedItems, setSavedItems] = useState(() => policies);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = hasPolicyChanges(items, savedItems);
  const enabledItems = items.filter((item) => item.enabled);

  useEffect(() => {
    if (!saveNotice) return;
    const timer = window.setTimeout(() => setSaveNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [saveNotice]);

  function togglePolicy(key: SideEffectPolicy["key"]) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, enabled: !item.enabled } : item));
    setSaveNotice(null);
    setError(null);
  }

  async function savePolicies() {
    if (!hasChanges) return;
    setSaving(true);
    setSaveNotice(null);
    setError(null);
    try {
      await apiPut<{ policies: PolicyUpdatePayload }>("/api/admin/seo-sales/settings/policies", toPolicyUpdatePayload(items));
      setSavedItems(items);
      setConfirmOpen(false);
      apiCache.delete("/api/admin/seo-sales/settings");
      setSaveNotice("保存しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "設定を保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className="flex min-h-14 items-center justify-between gap-4 border border-slate-200 bg-white px-4 py-3 text-left disabled:opacity-70"
            disabled={saving}
            onClick={() => togglePolicy(item.key)}
            aria-pressed={item.enabled}
          >
            <span className="min-w-0">
              <span className="block text-sm font-black text-slate-950">{item.label}</span>
              <span className="mt-0.5 block text-xs font-semibold text-slate-500">{item.enabled ? "有効" : "無効"}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3">
              <span className={`toggle-switch ${item.enabled ? "toggle-switch-on" : ""}`} aria-hidden="true">
                <span className="toggle-knob" />
              </span>
              <span className={`w-10 text-right text-xs font-black ${item.enabled ? "text-blue-700" : "text-slate-500"}`}>
                {item.enabled ? "ON" : "OFF"}
              </span>
            </span>
          </button>
        ))}
      </div>
      {hasChanges ? <div className="border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-800">未保存の変更があります。</div> : null}
      {saveNotice && !hasChanges ? <div className="border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{saveNotice}</div> : null}
      {error ? <div className="border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}
      <div className="flex justify-end">
        <button type="button" className="btn-primary" disabled={!hasChanges || saving} onClick={() => setConfirmOpen(true)}>
          {saving ? "保存中..." : hasChanges ? "設定を保存" : "変更なし"}
        </button>
      </div>
      {confirmOpen ? (
        <SideEffectConfirmModal
          enabledItems={enabledItems}
          saving={saving}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => void savePolicies()}
        />
      ) : null}
    </div>
  );
}

function SideEffectConfirmModal({
  enabledItems,
  saving,
  onCancel,
  onConfirm,
}: {
  enabledItems: SettingsPayload["policies"];
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
      <div className="w-full max-w-lg border border-slate-200 bg-white p-5 shadow-md" role="dialog" aria-modal="true" aria-labelledby="side-effect-confirm-title">
        <div className="border-b border-slate-200 pb-3">
          <h3 id="side-effect-confirm-title" className="text-lg font-black text-slate-950">副作用の許可設定を保存</h3>
        </div>
        <div className="mt-4 space-y-3">
          {enabledItems.length > 0 ? (
            <>
              <p className="text-sm font-semibold leading-6 text-slate-600">以下の副作用を許可します。</p>
              <div className="grid gap-2">
                {enabledItems.map((item) => (
                  <div key={item.key} className="flex min-h-11 items-center justify-between border border-blue-100 bg-blue-50 px-3 py-2">
                    <span className="text-sm font-black text-slate-950">{item.label}</span>
                    <span className="text-xs font-black text-blue-700">ON</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-600">すべての副作用を無効にします。</p>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" disabled={saving} onClick={onCancel}>キャンセル</button>
          <button type="button" className="btn-primary" disabled={saving} onClick={onConfirm}>{saving ? "保存中..." : "保存"}</button>
        </div>
      </div>
    </div>
  );
}
