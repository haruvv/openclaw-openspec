import React from "react";
import { Bot, ChevronRight, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { ErrorState, Loading, StatusPill } from "../components/common";
import { useApi } from "../hooks";
import type { BusinessApp } from "../types";

export function PortalPage() {
  const { data, loading, error } = useApi<{ apps: BusinessApp[] }>("/api/admin/apps");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const apps = data?.apps ?? [];
  return (
    <section className="border border-slate-200 bg-white">
      <div className="divide-y divide-slate-200">
        {apps.map((app) => <AppListRow key={app.id} app={app} />)}
      </div>
    </section>
  );
}

function AppListRow({ app }: { app: BusinessApp }) {
  const Icon = app.id === "stock-trading" ? TrendingUp : Bot;
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ring-1 ring-slate-200 ${app.status === "active" ? "bg-blue-50 text-blue-700" : "bg-white text-slate-500"}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-base font-black text-slate-950">{app.name}</div>
          <div className="mt-1 truncate text-sm font-semibold text-slate-500">{app.description}</div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusPill status={app.status === "active" ? "passed" : "skipped"} label={app.status === "active" ? "稼働中" : "準備中"} />
        {app.status === "active" ? <ChevronRight className="h-4 w-4 text-slate-400" /> : null}
      </div>
    </>
  );

  if (app.status !== "active") {
    return <div className="flex min-h-20 items-center justify-between gap-4 bg-slate-50 px-5 py-4 md:px-6">{content}</div>;
  }

  return (
    <Link to={app.entryPath} className="app-list-row flex min-h-20 items-center justify-between gap-4 px-5 py-4 md:px-6">
      {content}
    </Link>
  );
}
