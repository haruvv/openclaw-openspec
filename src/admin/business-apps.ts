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
    description: "AI判断、内部ペーパー取引、損益、学習ログを管理します。",
    status: "active",
    entryPath: "/admin/stock-trading",
    primaryLinks: [
      { label: "ダッシュボード", href: "/admin/stock-trading" },
      { label: "AI判断", href: "/admin/stock-trading/decisions" },
      { label: "取引履歴", href: "/admin/stock-trading/trades" },
      { label: "学習ログ", href: "/admin/stock-trading/lessons" },
      { label: "連携設定", href: "/admin/stock-trading/settings" },
    ],
  },
];

export function getBusinessApp(id: string): BusinessApp | undefined {
  return businessApps.find((app) => app.id === id);
}
