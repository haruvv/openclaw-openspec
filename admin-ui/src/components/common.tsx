import React from "react";
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import type { Status } from "../types";
import { formatStatus } from "../utils";

export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/[0.02]"><div className="mb-4 flex items-center justify-between gap-4 border-b border-slate-200 pb-3"><h2 className="min-w-0 break-words text-lg font-black tracking-normal">{title}</h2>{action}</div><div className="panel-body">{children}</div></section>;
}

export function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return <section className="border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/[0.02]"><div className="flex items-center justify-between gap-3"><div className="text-sm font-bold text-slate-500">{label}</div><div className="text-blue-700 [&_svg]:h-5 [&_svg]:w-5">{icon}</div></div><div className="mt-3 text-3xl font-black tracking-normal">{value}</div></section>;
}

export function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="border border-slate-200 bg-slate-50 p-3 ring-1 ring-black/[0.015]"><div className="text-xs font-bold text-slate-500">{label}</div><div className="mt-1 break-words text-sm font-black">{value}</div></div>;
}

export function Empty({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center"><div className="text-sm font-black text-slate-700">{title}</div>{description ? <p className="mx-auto mt-2 max-w-xl text-sm font-semibold text-slate-500">{description}</p> : null}{action ? <div className="mt-4 flex justify-center">{action}</div> : null}</div>;
}

export function Loading() {
  return <div className="border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">読み込み中...</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <div className="border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800"><div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />読み込みに失敗しました</div><p className="mt-2 font-semibold">{message}</p></div>;
}

export function StatusPill({ status, label }: { status: Status; label?: string }) {
  const styles = {
    passed: "status-passed",
    failed: "status-failed",
    skipped: "status-skipped",
    running: "status-running",
  };
  const icons = {
    passed: <CheckCircle2 className="h-3.5 w-3.5" />,
    failed: <XCircle className="h-3.5 w-3.5" />,
    skipped: <Clock3 className="h-3.5 w-3.5" />,
    running: <RefreshCw className="h-3.5 w-3.5" />,
  };
  return <span className={`inline-flex items-center gap-1 border bg-slate-100 px-2.5 py-1 text-xs font-black ${styles[status]}`}>{icons[status]}{label ?? formatStatus(status)}</span>;
}
