import React from "react";
import { ErrorState, Loading, Panel } from "../components/common";
import { SiteTable } from "../components/tables";
import { useApi } from "../hooks";
import type { SiteRecord } from "../types";

export function SitesPage() {
  const { data, loading, error } = useApi<{ sites: SiteRecord[] }>("/api/admin/seo-sales/sites");
  return <Panel title="URL一覧">{loading ? <Loading /> : error ? <ErrorState message={error} /> : <SiteTable sites={data?.sites ?? []} />}</Panel>;
}
