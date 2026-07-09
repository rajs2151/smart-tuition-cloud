import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initAuth, refreshMembership, useSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function AuthGate({ children }: { children: ReactNode }) {
  const session = useSession();

  useEffect(() => {
    initAuth();
  }, []);

  if (session.status === "loading") {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session.status === "signed-out") return <SignInScreen />;
  if (session.status === "error") return <SessionErrorScreen />;
  if (session.status === "no-institute") return <CreateInstituteScreen />;
  if (session.status === "disabled") return <DisabledAccountScreen />;
  if (session.status === "expired") return <SubscriptionStatusScreen kind="expired" />;
  if (session.status === "blocked") return <SubscriptionStatusScreen kind="blocked" />;
  return <>{children}</>;
}

function SessionErrorScreen() {
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const onRetry = async () => {
    setBusy(true);
    try {
      await refreshMembership();
    } finally {
      setBusy(false);
    }
  };
  const onSignOut = async () => {
    await supabase.auth.signOut();
  };
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="font-heading text-2xl font-bold text-foreground">Something went wrong</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {session.errorMessage ?? "Couldn't load your account. Please try again."}
        </p>
        <div className="mt-6 flex gap-2">
          <Button onClick={onRetry} disabled={busy} className="flex-1">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Try again
          </Button>
          <Button variant="ghost" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function DisabledAccountScreen() {
  const session = useSession();
  const onSignOut = async () => {
    await supabase.auth.signOut();
  };
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Your account has been disabled.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Please contact the administrator.</p>
        {session.email ? (
          <p className="mt-4 text-xs text-muted-foreground">Signed in as {session.email}</p>
        ) : null}
        <div className="mt-6">
          <Button variant="outline" onClick={onSignOut} className="w-full">
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function SubscriptionStatusScreen({ kind }: { kind: "expired" | "blocked" }) {
  const session = useSession();
  const onSignOut = async () => {
    await supabase.auth.signOut();
  };
  const title = kind === "expired" ? "Subscription Expired" : "Access Blocked";
  const message =
    kind === "expired"
      ? "Your Vidyafee subscription has ended. Please contact the administrator to renew your subscription and restore access to your institute."
      : "Access to this institute has been disabled. Please contact the administrator for assistance.";
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        {session.email ? (
          <p className="mt-4 text-xs text-muted-foreground">Signed in as {session.email}</p>
        ) : null}
        <div className="mt-6">
          <Button variant="outline" onClick={onSignOut} className="w-full">
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function SignInScreen() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast.error("Enter your email and password");
      return;
    }
    setBusy(true);
    try {
      if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        // If email confirmation is enabled in Supabase (Authentication →
        // Providers → Email → "Confirm email"), signUp succeeds but no
        // session is returned until the user clicks the confirmation
        // link — session stays signed-out until then, which is correct.
        if (!data.session) {
          toast.success("Account created. Check your email to confirm, then sign in.");
          setMode("sign-in");
          return;
        }
        // Confirmation disabled: signUp already returned a session —
        // onAuthStateChange picks it up, nothing else to do here.
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          toast.error(error.message);
          return;
        }
        // onAuthStateChange picks up the SIGNED_IN event from here.
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="font-heading text-2xl font-bold text-foreground">Welcome to Vidyafee</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fee management for coaching institutes.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@institute.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full" size="lg">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode === "sign-up" ? "Create account" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "sign-up" ? "Already have an account?" : "New institute owner?"}{" "}
          <button
            type="button"
            className="font-medium text-foreground underline underline-offset-2"
            onClick={() => setMode(mode === "sign-up" ? "sign-in" : "sign-up")}
          >
            {mode === "sign-up" ? "Sign in" : "Create an account"}
          </button>
        </p>
      </div>
    </div>
  );
}

function CreateInstituteScreen() {
  const session = useSession();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (!name.trim()) {
      toast.error("Institute name is required");
      return;
    }
    if (!session.userId) return;
    setBusy(true);
    try {
      // Single atomic call: creates the institute AND the owner membership
      // in one DB transaction (see create_institute_with_owner RPC). This
      // replaces the old "check if a membership exists, then insert" flow,
      // which had a race window between the check and the insert — two
      // fast/duplicate submissions could both pass the check and each
      // create their own institute. The RPC is idempotent (safe to call
      // again) and a unique index in the database is the final backstop
      // against duplicate/orphan institute records even under concurrency.
      const { error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ error: { code?: string; message: string } | null }>)("create_institute_with_owner", {
        _name: name.trim(),
        _phone: phone.trim(),
        _address: address.trim(),
        _email: session.email ?? "",
      });
      if (error) {
        // 23505 = unique_violation. This can only happen if two creation
        // requests raced each other at the database level; it means an
        // institute now exists for this user, so just load it instead of
        // showing an error.
        if ((error as { code?: string }).code === "23505") {
          await refreshMembership();
          return;
        }
        throw error;
      }
      toast.success("Institute created");
      await refreshMembership();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="font-heading text-2xl font-bold text-foreground">Set up your institute</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {session.email}. Create your institute to get started.
        </p>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="i-name">Institute name *</Label>
            <Input
              id="i-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dnyanpeeth Classes"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-phone">Contact phone</Label>
            <Input
              id="i-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-address">Address</Label>
            <Input
              id="i-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="FC Road, Pune"
            />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <Button onClick={onCreate} disabled={busy} className="flex-1">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create institute
          </Button>
          <Button variant="ghost" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
