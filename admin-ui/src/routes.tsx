import React from "react";
import { Navigate, Route, Routes, matchPath } from "react-router-dom";
import { PortalPage, RunDetailPage, RunsPage, SeoSalesHome, SettingsPage, SiteDetailPage, SitesPage } from "./pages";

interface AdminRouteDefinition {
  path: string;
  title: string;
  description: string;
  element: React.ReactNode;
}

const adminRoutes: AdminRouteDefinition[] = [
  { path: "/", title: "業務アプリ", description: "利用する業務を選択します。", element: <PortalPage /> },
  { path: "/admin", title: "業務アプリ", description: "利用する業務を選択します。", element: <PortalPage /> },
  { path: "/admin/", title: "業務アプリ", description: "利用する業務を選択します。", element: <PortalPage /> },
  { path: "/admin/seo-sales", title: "SEO営業", description: "候補発見、SEO解析、提案作成の実行状況を確認します。", element: <SeoSalesHome /> },
  { path: "/admin/seo-sales/sites", title: "URL一覧", description: "解析済みURLごとの最新状態です。", element: <SitesPage /> },
  { path: "/admin/seo-sales/sites/:id", title: "URL詳細", description: "", element: <SiteDetailPage /> },
  { path: "/admin/seo-sales/runs", title: "実行ログ", description: "解析の実行履歴です。", element: <RunsPage /> },
  { path: "/admin/seo-sales/runs/:id", title: "実行詳細", description: "", element: <RunDetailPage /> },
  { path: "/admin/seo-sales/settings", title: "外部サービス設定", description: "連携設定と実行ポリシーです。", element: <SettingsPage /> },
];

export function AdminRoutes() {
  return (
    <Routes>
      {adminRoutes.map((route) => <Route key={route.path} path={route.path} element={route.element} />)}
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}

export function getPageMeta(pathname: string): { title: string; description: string } {
  return adminRoutes.find((route) => matchPath({ path: route.path, end: true }, pathname)) ?? adminRoutes[1];
}
