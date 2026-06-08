import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { NotificationBell } from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Activity,
  Globe,
  Settings,
  LogOut,
} from "lucide-react";
import { DogIcon } from "./DogIcon";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Monitors", href: "/monitors", icon: Activity },
  { label: "Status Pages", href: "/status-pages", icon: Globe },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 h-full w-60 bg-sidebar border-r border-sidebar-border flex flex-col z-30 transition-transform duration-200",
        open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-14 border-b border-sidebar-border">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <DogIcon className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sidebar-foreground text-sm tracking-wide flex-1">
          Watchdog
        </span>
        <NotificationBell />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            location.pathname === item.href ||
            (item.href !== "/dashboard" && location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User */}
      <div className="px-4 py-4 space-y-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar className="w-7 h-7 flex-shrink-0">
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {user?.email?.[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start gap-2 text-sidebar-foreground/50 hover:text-sidebar-foreground text-xs h-7 px-2"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
