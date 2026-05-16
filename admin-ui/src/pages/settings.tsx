import React from "react";
import { ErrorState, Loading, Panel } from "../components/common";
import {
  DiscoverySettingsPanel,
  IntegrationSettingsList,
  SalesOperationSettingsPanel,
  SideEffectPolicyControls,
  createDiscoverySettingsKey,
  createSalesSettingsKey,
  createPoliciesKey,
} from "../components/settings";
import { useApi } from "../hooks";
import type { SettingsPayload } from "../types";

export function SettingsPage() {
  const { data, loading, error } = useApi<SettingsPayload>("/api/admin/seo-sales/settings");
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;
  const policies = data?.policies ?? [];

  return (
    <div className="space-y-5">
      {data?.discovery ? <DiscoverySettingsPanel key={createDiscoverySettingsKey(data.discovery)} settings={data.discovery} /> : null}
      {data?.sales ? (
        <Panel title="営業送信設定">
          <SalesOperationSettingsPanel key={createSalesSettingsKey(data.sales)} settings={data.sales} />
        </Panel>
      ) : null}
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)] xl:grid-cols-2">
        <Panel title="外部サービス設定">
          <IntegrationSettingsList items={data?.integrations ?? []} />
        </Panel>
        <Panel title="副作用の許可設定">
          <SideEffectPolicyControls key={createPoliciesKey(policies)} policies={policies} />
        </Panel>
      </div>
    </div>
  );
}
