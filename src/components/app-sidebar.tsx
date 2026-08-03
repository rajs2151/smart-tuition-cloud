import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  IndianRupee,
  Receipt,
  CalendarCheck,
  BookOpen,
  MessageCircle,
  BarChart3,
  Settings,
  GraduationCap,
  Wallet,
  Trash2,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { signOut } from "@/lib/auth/session";

const main = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Students", url: "/students", icon: Users },
  { title: "Batches", url: "/batches", icon: BookOpen },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck },
  { title: "Fees", url: "/fees", icon: IndianRupee },
  { title: "Expenses", url: "/expenses", icon: Wallet },
  { title: "Recovery & WhatsApp", url: "/recovery", icon: MessageCircle },
  { title: "Receipts", url: "/receipts", icon: Receipt },
  { title: "Recycle Bin", url: "/recycle-bin", icon: Trash2 },
];

const upcoming = [
  { title: "Reports", url: "/reports", icon: BarChart3 },
];

export function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) =>
    url === "/" ? path === "/" : path === url || path.startsWith(url + "/");

  const { isMobile, setOpenMobile } = useSidebar();
  // Mobile's sidebar is a slide-out overlay (Sheet); it should close the
  // instant a nav link is tapped, matching standard drawer-nav behavior.
  // Desktop's sidebar is part of the persistent layout and isn't affected —
  // setOpenMobile only drives the mobile Sheet's open state.
  const closeOnMobile = () => { if (isMobile) setOpenMobile(false); };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <Link to="/" className="flex items-center gap-2 px-2 py-2" preload="intent" onClick={closeOnMobile}>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-brand text-white shadow-sm">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-sm font-bold">Vidyafee</span>
            <span className="text-[11px] text-muted-foreground">Coaching SaaS</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} preload="intent" onClick={closeOnMobile}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Coming soon</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {upcoming.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    className="opacity-50 cursor-not-allowed"
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link to="/settings" preload="intent" onClick={closeOnMobile}>
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Log out" onClick={() => { closeOnMobile(); void signOut(); }}>
              <LogOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
