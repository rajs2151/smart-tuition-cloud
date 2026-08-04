import { Search, LogOut, Settings as SettingsIcon, User, Receipt as ReceiptIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/session";
import { listPayments, listStudents } from "@/lib/data/adapter";

export function AppHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  const { email, role } = useSession();
  const initials = (email ?? "?").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex flex-col gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="md:hidden" />
        <div className="hidden md:block">
          <SidebarTrigger />
        </div>
        <div className="flex-1">
          <h1 className="font-display text-lg font-bold leading-tight md:text-xl">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <HeaderSearch />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full" aria-label="Account menu">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <p className="truncate text-sm font-medium">{email ?? "—"}</p>
              {role && <p className="text-xs capitalize text-muted-foreground">{role}</p>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <SettingsIcon className="mr-2 h-4 w-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// Was a bare, disconnected <Input> with no state or onChange at all -
// confirmed dead, not a regression. Desktop-only (hidden md:block on the
// wrapper) is unchanged/intentional. Matches the students/receipts list
// pages' own existing search matching logic (name/rollNo/phone for
// students; receiptNo/student-name for receipts) rather than inventing a
// new one, just surfaced as a dropdown since this component is global
// and isn't itself a list page.
function HeaderSearch() {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const query = term.trim().toLowerCase();

  const resultsQuery = useQuery({
    queryKey: ["header-search-data"],
    queryFn: async () => ({ students: await listStudents(), payments: await listPayments() }),
    enabled: query.length >= 2,
  });

  const students = query.length >= 2
    ? (resultsQuery.data?.students ?? []).filter(
        (s) => s.name.toLowerCase().includes(query) || s.rollNo.toLowerCase().includes(query) || s.phone.includes(query),
      ).slice(0, 5)
    : [];
  const receipts = query.length >= 2
    ? (resultsQuery.data?.payments ?? [])
        .map((p) => ({ ...p, student: resultsQuery.data?.students.find((s) => s.id === p.studentId) }))
        .filter((p) => p.receiptNo.toLowerCase().includes(query) || (p.student?.name.toLowerCase().includes(query) ?? false))
        .slice(0, 5)
    : [];

  const showDropdown = open && query.length >= 2;

  return (
    <div className="relative hidden md:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search students, receipts…"
        className="w-72 pl-9"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {showDropdown && (
        <div className="absolute right-0 top-full z-40 mt-1 w-96 rounded-lg border bg-popover p-1 shadow-lg">
          {resultsQuery.isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Searching…</p>
          ) : students.length === 0 && receipts.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No matches for "{term}"</p>
          ) : (
            <>
              {students.length > 0 && (
                <div className="mb-1">
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Students</p>
                  {students.map((s) => (
                    <Link
                      key={s.id}
                      to="/students/$id"
                      params={{ id: s.id }}
                      onMouseDown={() => setTerm("")}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{s.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{s.rollNo}</span>
                    </Link>
                  ))}
                </div>
              )}
              {receipts.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Receipts</p>
                  {receipts.map((p) => (
                    <Link
                      key={p.id}
                      to="/receipts/$id"
                      params={{ id: p.id }}
                      onMouseDown={() => setTerm("")}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <ReceiptIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate">{p.receiptNo} · {p.student?.name ?? "—"}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
