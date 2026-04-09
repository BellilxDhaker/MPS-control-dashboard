"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Extract module ID from pathname (e.g., /dashboard/projected-stock-1 → projected-stock-1)
  const currentModule = pathname.split("/dashboard/")[1] || "projected-stock-1";

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Control Bar - Always visible */}
      <div className="sticky top-0 z-40 border-b border-black/10 bg-[color:var(--surface)]">
        <div className="flex items-center gap-4 px-6 py-4">
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-black/10 rounded-full transition"
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? (
              <X className="h-5 w-5 text-[color:var(--foreground)]" />
            ) : (
              <Menu className="h-5 w-5 text-[color:var(--foreground)]" />
            )}
          </button>
          <span className="text-xs text-[color:var(--muted)] uppercase tracking-wide">
            {sidebarOpen ? "Close" : "Menu"}
          </span>
        </div>
      </div>

      {/* Backdrop for sidebar when open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main layout container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Collapsible Sidebar - Slides in from left */}
        <aside
          className={`fixed left-0 top-16 h-[calc(100vh-64px)] w-80 border-r border-black/10 bg-[color:var(--background)] overflow-y-auto transform transition-transform duration-300 ease-in-out z-40 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="p-6">
            <Sidebar currentModule={currentModule} />
          </div>
        </aside>

        {/* Main Content - Full width when sidebar is closed */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
