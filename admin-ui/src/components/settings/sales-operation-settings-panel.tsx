import React, { useEffect, useState } from "react";
import { apiCache, apiPut } from "../../api";
import type { SalesOperationSettings } from "../../types";

interface SalesSettingsForm {
  defaultPaymentAmountJpy: string;
  outreachCooldownDays: string;
  contactDiscoveryMaxPages: string;
  sendgridFromName: string;
}

export function SalesOperationSettingsPanel({ settings }: { settings: SalesOperationSettings }) {
  const [form, setForm] = useState(() => createForm(settings));
  const [savedForm, setSavedForm] = useState(() => createForm(settings));
  const [saving, setSaving] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasChanges = formKey(form) !== formKey(savedForm);

  useEffect(() => {
    if (!saveNotice) return;
    const timer = window.setTimeout(() => setSaveNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [saveNotice]);

  function setFormValue<K extends keyof SalesSettingsForm>(key: K, value: SalesSettingsForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setSaveNotice(null);
    setError(null);
  }

  async function saveSettings() {
    if (!hasChanges) return;
    setSaving(true);
    setSaveNotice(null);
    setError(null);
    try {
      const result = await apiPut<{ sales: SalesOperationSettings }>("/api/admin/seo-sales/settings/sales", {
        defaultPaymentAmountJpy: Number(form.defaultPaymentAmountJpy),
        outreachCooldownDays: Number(form.outreachCooldownDays),
        contactDiscoveryMaxPages: Number(form.contactDiscoveryMaxPages),
        sendgridFromName: form.sendgridFromName,
      });
      const next = createForm(result.sales);
      setForm(next);
      setSavedForm(next);
      apiCache.delete("/api/admin/seo-sales/settings");
      setSaveNotice("保存しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "営業送信設定を保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-black text-slate-700" htmlFor="sales-default-amount">
          デフォルト金額（JPY）
          <input
            id="sales-default-amount"
            className="input mt-2 w-full"
            type="number"
            min="1"
            step="1000"
            value={form.defaultPaymentAmountJpy}
            onChange={(event) => setFormValue("defaultPaymentAmountJpy", event.target.value)}
          />
        </label>
        <label className="text-sm font-black text-slate-700" htmlFor="sales-cooldown-days">
          再送クールダウン（日）
          <input
            id="sales-cooldown-days"
            className="input mt-2 w-full"
            type="number"
            min="0"
            max="365"
            step="1"
            value={form.outreachCooldownDays}
            onChange={(event) => setFormValue("outreachCooldownDays", event.target.value)}
          />
        </label>
        <label className="text-sm font-black text-slate-700" htmlFor="contact-max-pages">
          連絡先探索ページ数
          <input
            id="contact-max-pages"
            className="input mt-2 w-full"
            type="number"
            min="0"
            max="20"
            step="1"
            value={form.contactDiscoveryMaxPages}
            onChange={(event) => setFormValue("contactDiscoveryMaxPages", event.target.value)}
          />
        </label>
        <label className="text-sm font-black text-slate-700" htmlFor="sendgrid-from-name">
          送信者名
          <input
            id="sendgrid-from-name"
            className="input mt-2 w-full"
            value={form.sendgridFromName}
            onChange={(event) => setFormValue("sendgridFromName", event.target.value)}
          />
        </label>
      </div>
      {hasChanges ? <div className="border border-blue-100 bg-blue-50 p-3 text-sm font-bold text-blue-800">未保存の変更があります。</div> : null}
      {saveNotice && !hasChanges ? <div className="border border-emerald-100 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{saveNotice}</div> : null}
      {error ? <div className="border border-red-100 bg-red-50 p-3 text-sm font-bold text-red-800">{error}</div> : null}
      <div className="flex justify-end">
        <button type="button" className="btn-primary" disabled={!hasChanges || saving} onClick={() => void saveSettings()}>
          {saving ? "保存中..." : hasChanges ? "設定を保存" : "変更なし"}
        </button>
      </div>
    </div>
  );
}

function createForm(settings: SalesOperationSettings): SalesSettingsForm {
  return {
    defaultPaymentAmountJpy: String(settings.defaultPaymentAmountJpy),
    outreachCooldownDays: String(settings.outreachCooldownDays),
    contactDiscoveryMaxPages: String(settings.contactDiscoveryMaxPages),
    sendgridFromName: settings.sendgridFromName,
  };
}

function formKey(form: SalesSettingsForm): string {
  return [
    form.defaultPaymentAmountJpy,
    form.outreachCooldownDays,
    form.contactDiscoveryMaxPages,
    form.sendgridFromName,
  ].join("|");
}
