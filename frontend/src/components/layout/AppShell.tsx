import { useState } from "react";
import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3, Boxes, ClipboardList, FileSpreadsheet, HardHat, LayoutDashboard, LogOut, Menu, PackageCheck, Users,
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { can, useMe } from "@/lib/auth";
import { endSession } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/format";
import type { UserOut } from "@/lib/types";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, perm: "report:read", end: true, id: "dashboard" },
  { to: "/hpp", label: "Perhitungan HPP", icon: ClipboardList, perm: "hpp:read", id: "hpp" },
  { to: "/packaging", label: "Packaging Form", icon: PackageCheck, perm: "packaging:read", id: "packaging" },
  { to: "/import", label: "Upload File Buyer", icon: FileSpreadsheet, perm: "import", id: "import" },
  { to: "/materials", label: "Database Material", icon: Boxes, perm: "material:read", id: "materials" },
  { to: "/labor", label: "Upah Tenaga Kerja", icon: HardHat, perm: "labor:read", id: "labor" },
  { to: "/reports", label: "Laporan", icon: BarChart3, perm: "report:read", id: "reports" },
  { to: "/users", label: "Pengguna", icon: Users, perm: "user:manage", id: "users" },
];

function SideNav({ user, onNavigate }: { user: UserOut; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md bg-[#C47B2B] font-heading text-lg font-bold text-white">B</div>
          <div>
            <p className="font-heading text-[15px] font-semibold leading-tight">Balagi Rattan</p>
            <p className="text-[11px] uppercase tracking-[0.14em] text-[#A8A29E]">HPP · R&D System</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV.filter((n) => can(user, n.perm)).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={onNavigate}
            data-testid={`nav-${n.id}`}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] transition-[background-color,color] duration-150 ${
                isActive ? "bg-sidebar-accent font-semibold text-[#F59E0B]" : "text-[#D6D3D1] hover:bg-[#2A241E] hover:text-white"
              }`
            }
          >
            <n.icon className="size-4" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-4 text-[11px] leading-relaxed text-[#A8A29E]">
        PT Balagi Rattan<br />Kanci, Cirebon
      </div>
    </div>
  );
}

export default function AppShell() {
  const { data: user, isLoading, isError } = useMe();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground" data-testid="app-loading">Memuat...</div>;
  }
  if (isError || !user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;

  return (
    <div className="min-h-screen bg-background">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 md:block">
        <SideNav user={user} />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 border-0 p-0">
          <SheetTitle className="sr-only">Navigasi</SheetTitle>
          <SideNav user={user} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="md:pl-60">
        <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/85 px-4 backdrop-blur-md md:px-6">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setOpen(true)} data-testid="mobile-menu-button">
              <Menu className="size-5" />
            </Button>
            <span className="hidden text-xs uppercase tracking-[0.16em] text-muted-foreground sm:inline">Sistem HPP · Research &amp; Development</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium" data-testid="header-user-name">{user.name}</p>
              <p className="text-[11px] text-muted-foreground">{user.email}</p>
            </div>
            <Badge className="bg-[#FEF3C7] text-[#92400E]" data-testid="header-user-role">{ROLE_LABELS[user.role]}</Badge>
            <Button variant="outline" size="sm" onClick={() => endSession()} data-testid="logout-button">
              <LogOut className="size-4" /> Keluar
            </Button>
          </div>
        </header>
        <main className="print-full mx-auto max-w-[1440px] p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <Toaster richColors />
    </div>
  );
}
