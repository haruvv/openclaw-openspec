import React from "react";
import { TrendingUp } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { SidebarGroup, navItems } from "./components/navigation";
import { AdminRoutes, getPageMeta } from "./routes";
import { isActive, isAdminHome } from "./utils";

export function App() {
  const { pathname } = useLocation();
  const path = pathname;
  const page = getPageMeta(path);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 signal-grid">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-slate-800 bg-slate-950 text-white lg:flex lg:flex-col">
        <Link to="/admin" className="flex items-center gap-3 border-b border-slate-800 px-6 py-6">
          <div className="flex h-10 w-10 items-center justify-center border border-slate-700 bg-white text-sm font-black text-slate-950">RA</div>
          <div>
            <div className="text-sm font-black">RevenueAgent</div>
            <div className="text-xs font-semibold text-slate-400">業務自動化コンソール</div>
          </div>
        </Link>
        <nav className="space-y-7 px-4 py-5">
          <SidebarGroup label="全体" items={navItems.slice(0, 1)} path={path} />
          <SidebarGroup label="SEO営業" items={navItems.slice(1)} path={path} />
          <div>
            <div className="px-3 text-[11px] font-bold uppercase tracking-normal text-slate-500">準備中</div>
            <div className="mt-2 flex items-center gap-3 border border-slate-800 px-3 py-2.5 text-sm font-bold text-slate-600">
              <TrendingUp className="h-4 w-4" />
              株自動売買
            </div>
          </div>
        </nav>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100/90 px-5 py-4 backdrop-blur md:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-bold text-slate-500">管理画面</div>
              <h1 className="text-2xl font-black tracking-normal text-slate-950 md:text-3xl">{page.title}</h1>
            </div>
            <div className="hidden flex-wrap gap-2 md:flex">
              <Link to="/admin" className="btn-secondary">業務アプリ一覧</Link>
            </div>
          </div>
          <nav className="mt-4 grid grid-cols-3 gap-2 lg:hidden">
            {navItems.map((item) => (
              <Link key={item.href} to={item.href} className={`inline-flex min-h-9 items-center justify-center border px-2 py-1.5 text-center text-xs font-bold leading-tight transition-colors sm:text-sm ${isActive(item.href, path) ? "border-blue-700 bg-blue-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"}`}>
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className={`mx-auto px-5 py-6 md:px-8 ${isAdminHome(path) ? "max-w-[1500px]" : "max-w-7xl"}`}>
          <AdminRoutes />
        </main>
      </div>
    </div>
  );
}
