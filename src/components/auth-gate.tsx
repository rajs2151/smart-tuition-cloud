import { useEffect, useState, type ReactNode } from "react";
import { lovable } from "@/integrations/lovable/index";
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
  if (session.status === "no-institute") return <CreateInstituteScreen />;
  if (session.status === "expired") return <SubscriptionStatusScreen kind="expired" />;
  if (session.status === "blocked") return <SubscriptionStatusScreen kind="blocked" />;
  return <>{children}</>;
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
  const [busy, setBusy] = useState(false);

  const onSignIn = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Sign-in failed");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      // session set — auth state listener will pick it up
    } catch (e) {
      toast.error((e as Error).message);
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
        <Button
          onClick={onSignIn}
          disabled={busy}
          className="w-full gap-2"
          size="lg"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </Button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Sign in creates your account securely. No password needed.
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
      // Idempotency: if the user already has a membership, skip insert and refresh.
      const { data: existing, error: exErr } = await supabase
        .from("institute_members")
        .select("institute_id")
        .eq("user_id", session.userId)
        .limit(1);
      if (exErr) throw exErr;
      if (existing && existing.length > 0) {
        await refreshMembership();
        return;
      }

      const { error } = await supabase.from("institutes").insert({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        email: session.email ?? "",
        created_by: session.userId,
      });
      if (error) throw error;
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
            <Input id="i-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dnyanpeeth Classes" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-phone">Contact phone</Label>
            <Input id="i-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i-address">Address</Label>
            <Input id="i-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="FC Road, Pune" />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <Button onClick={onCreate} disabled={busy} className="flex-1">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create institute
          </Button>
          <Button variant="ghost" onClick={onSignOut}>Sign out</Button>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.5 14.7 2.5 12 2.5 6.8 2.5 2.6 6.7 2.6 12s4.2 9.5 9.4 9.5c5.4 0 9-3.8 9-9.2 0-.6-.1-1.1-.2-1.6H12z"/>
    </svg>
  );
}
