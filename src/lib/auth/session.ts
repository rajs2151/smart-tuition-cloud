import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hydrateSettingsFromDb, resetSettings } from "@/lib/settings/store";

export type SessionState = {
  status: "loading" | "signed-out" | "no-institute" | "ready" | "expired" | "blocked";
  userId: string | null;
  email: string | null;
  instituteId: string | null;
  role: "owner" | "staff" | null;
};

let state: SessionState = {
  status: "loading",
  userId: null,
  email: null,
  instituteId: null,
  role: null,
};

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function set(patch: Partial<SessionState>) {
  state = { ...state, ...patch };
  emit();
}

export function getSession(): SessionState {
  return state;
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}

async function loadActiveInstitute(userId: string) {
  // Pick first membership (owner preferred)
  const { data: memberships, error } = await supabase
    .from("institute_members")
    .select("institute_id, role")
    .eq("user_id", userId)
    .order("role", { ascending: true }); // 'owner' < 'staff' alphabetically
  if (error) {
    console.error("[session] memberships error", error);
    set({ status: "no-institute", instituteId: null, role: null });
    return;
  }
  if (!memberships || memberships.length === 0) {
    set({ status: "no-institute", instituteId: null, role: null });
    return;
  }
  const owner = memberships.find((m) => m.role === "owner") ?? memberships[0];
  const instituteId = owner.institute_id;
  const { data: inst, error: instErr } = await supabase
    .from("institutes")
    .select("*")
    .eq("id", instituteId)
    .single();
  if (instErr || !inst) {
    console.error("[session] institute load error", instErr);
    set({ status: "no-institute" });
    return;
  }
  hydrateSettingsFromDb(inst);
  const rawStatus = (inst as { subscription_status?: string }).subscription_status ?? "trial";
  let subStatus: "trial" | "active" | "expired" | "blocked";
  if (rawStatus === "trial" || rawStatus === "active" || rawStatus === "expired" || rawStatus === "blocked") {
    subStatus = rawStatus;
  } else {
    console.error("[session] unexpected subscription_status; treating as blocked:", rawStatus);
    subStatus = "blocked";
  }
  if (subStatus === "expired") {
    set({ status: "expired", instituteId, role: owner.role as "owner" | "staff" });
    return;
  }
  if (subStatus === "blocked") {
    set({ status: "blocked", instituteId, role: owner.role as "owner" | "staff" });
    return;
  }
  set({
    status: "ready",
    instituteId,
    role: owner.role as "owner" | "staff",
  });
}

export async function refreshMembership() {
  if (!state.userId) return;
  await loadActiveInstitute(state.userId);
}

export async function signOut() {
  await supabase.auth.signOut();
  resetSettings();
  set({
    status: "signed-out",
    userId: null,
    email: null,
    instituteId: null,
    role: null,
  });
}

let initialized = false;
export function initAuth() {
  if (initialized) return;
  initialized = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      resetSettings();
      set({
        status: "signed-out",
        userId: null,
        email: null,
        instituteId: null,
        role: null,
      });
      return;
    }
    set({
      userId: session.user.id,
      email: session.user.email ?? null,
      status: "loading",
    });
    // defer to avoid deadlock
    setTimeout(() => {
      loadActiveInstitute(session.user!.id);
    }, 0);
  });

  supabase.auth.getSession().then(({ data }) => {
    const session = data.session;
    if (!session?.user) {
      set({ status: "signed-out" });
      return;
    }
    set({
      userId: session.user.id,
      email: session.user.email ?? null,
      status: "loading",
    });
    loadActiveInstitute(session.user.id);
  });
}
