export interface BusinessApp {
  id: string;
  name: string;
  description: string;
  status: "active" | "planned";
  entryPath: string;
  primaryLinks: Array<{ label: string; href: string }>;
}

export const businessApps: BusinessApp[] = [
  {
    id: "seo-sales",
    name: "SEO営業",
    description: "サイトをクロールし、SEO改善提案と営業用の提案書を生成します。",
    status: "active",
    entryPath: "/admin/seo-sales",
    primaryLinks: [
      { label: "URL一覧", href: "/admin/seo-sales/sites" },
      { label: "実行ログ", href: "/admin/seo-sales/runs" },
      { label: "外部サービス設定", href: "/admin/seo-sales/settings" },
    ],
  },
  {
    id: "stock-trading",
    name: "株自動売買",
    description: "戦略、売買ログ、損益、証券API接続を管理する予定の業務アプリです。",
    status: "planned",
    entryPath: "/admin",
    primaryLinks: [],
  },
];

export function getBusinessApp(id: string): BusinessApp | undefined {
  return businessApps.find((app) => app.id === id);
}
