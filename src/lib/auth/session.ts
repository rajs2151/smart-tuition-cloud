import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hydrateSettingsFromDb, resetSettings } from "@/lib/settings/store";

export type SessionState = {
  status:
    | "loading"
    | "signed-out"
    | "no-institute"
    | "ready"
    | "expired"
    | "blocked"
    | "disabled"
    | "error";
  userId: string | null;
  email: string | null;
  instituteId: string | null;
  role: "owner" | "staff" | null;
  errorMessage: string | null;
};

const initialState: SessionState = {
  status: "loading",
  userId: null,
  email: null,
  instituteId: null,
  role: null,
  errorMessage: null,
};

let state: SessionState = initialState;

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

// ---------------------------------------------------------------------------
// Race-condition guard
// ---------------------------------------------------------------------------
// Every call to loadActiveInstitute() is tagged with a generation number.
// If a newer call has started by the time an older one resolves, the older
// result is discarded instead of being applied to shared state. Without
// this, two in-flight membership loads (e.g. one from initial page load and
// one triggered by "refresh after creating institute") can resolve
// out-of-order and the STALE ("no membership yet") response can silently
// overwrite the FRESH ("membership just created") one, bouncing the user
// back to the onboarding screen even though everything succeeded in the
// database. This was the actual root cause of the reported bug.
let currentGeneration = 0;

async function loadActiveInstitute(userId: string) {
  const myGeneration = ++currentGeneration;
  const isStale = () => myGeneration !== currentGeneration;

  const { data: memberships, error } = await supabase
    .from("institute_members")
    .select("institute_id, role, access_enabled")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (isStale()) return;

  if (error) {
    console.error("[session] memberships error", error);
    // A failed query must NOT be treated as "no membership" — that would
    // incorrectly send an existing, fully-onboarded user back to the
    // "Create Your Institute" screen because of a transient network or
    // RLS error. Surface a distinct, recoverable error state instead.
    set({ status: "error", errorMessage: "Couldn't load your account. Please try again." });
    return;
  }

  if (!memberships || memberships.length === 0) {
    set({ status: "no-institute", instituteId: null, role: null });
    return;
  }

  // Prefer an owner membership if the user has one; otherwise use the
  // first (oldest) membership. Deterministic regardless of row order.
  const membership = memberships.find((m) => m.role === "owner") ?? memberships[0];

  if (!membership.access_enabled) {
    set({
      status: "disabled",
      instituteId: membership.institute_id,
      role: membership.role as "owner" | "staff",
    });
    return;
  }

  const { data: inst, error: instErr } = await supabase
    .from("institutes")
    .select("*")
    .eq("id", membership.institute_id)
    .single();

  if (isStale()) return;

  if (instErr || !inst) {
    console.error("[session] institute load error", instErr);
    set({ status: "error", errorMessage: "Couldn't load your institute. Please try again." });
    return;
  }

  hydrateSettingsFromDb(inst);
  const rawStatus = (inst as { subscription_status?: string }).subscription_status ?? "trial";
  let subStatus: "trial" | "active" | "expired" | "blocked";
  if (
    rawStatus === "trial" ||
    rawStatus === "active" ||
    rawStatus === "expired" ||
    rawStatus === "blocked"
  ) {
    subStatus = rawStatus;
  } else {
    console.error("[session] unexpected subscription_status; treating as blocked:", rawStatus);
    subStatus = "blocked";
  }

  if (subStatus === "expired") {
    set({
      status: "expired",
      instituteId: membership.institute_id,
      role: membership.role as "owner" | "staff",
    });
    return;
  }
  if (subStatus === "blocked") {
    set({
      status: "blocked",
      instituteId: membership.institute_id,
      role: membership.role as "owner" | "staff",
    });
    return;
  }

  set({
    status: "ready",
    instituteId: membership.institute_id,
    role: membership.role as "owner" | "staff",
    errorMessage: null,
  });
}

export async function refreshMembership() {
  if (!state.userId) return;
  await loadActiveInstitute(state.userId);
}

export async function signOut() {
  await supabase.auth.signOut();
  resetSettings();
  currentGeneration++; // invalidate any in-flight load for the old user
  set({
    status: "signed-out",
    userId: null,
    email: null,
    instituteId: null,
    role: null,
    errorMessage: null,
  });
}

let initialized = false;
export function initAuth() {
  if (initialized) return;
  initialized = true;

  // A single subscription is the ONLY source of session truth.
  //
  // supabase-js fires an "INITIAL_SESSION" event on this listener as soon
  // as it subscribes (in addition to SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED
  // later on), so there is no need for a separate supabase.auth.getSession()
  // call alongside it. The previous implementation called both, which meant
  // every page load kicked off TWO independent, unsequenced
  // loadActiveInstitute() calls — the exact race described above. Relying on
  // one listener removes that race entirely instead of papering over it.
  supabase.auth.onAuthStateChange((event, session) => {
    if (!session?.user) {
      resetSettings();
      currentGeneration++; // invalidate any in-flight load
      set({
        status: "signed-out",
        userId: null,
        email: null,
        instituteId: null,
        role: null,
        errorMessage: null,
      });
      return;
    }

    // TOKEN_REFRESHED fires silently in the background roughly every hour
    // for as long as a tab stays open — it's the same user, same
    // membership, just a new access token. Treating it like a fresh
    // sign-in would flash the whole dashboard to a loading spinner and
    // re-run the membership/institute lookup for no reason. Only
    // (re)evaluate membership on events that can actually change who's
    // signed in or what they have access to.
    const shouldReevaluateMembership =
      event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "USER_UPDATED";

    if (!shouldReevaluateMembership) {
      set({ userId: session.user.id, email: session.user.email ?? null });
      return;
    }

    set({
      userId: session.user.id,
      email: session.user.email ?? null,
      status: "loading",
      errorMessage: null,
    });

    // Supabase's own guidance: don't call back into the Supabase client
    // synchronously from inside onAuthStateChange (it can deadlock the
    // internal auth lock). Deferring with setTimeout(0) is safe here
    // because loadActiveInstitute is generation-guarded — even if this
    // fires multiple times in quick succession, only the most recent call's
    // result is ever applied.
    setTimeout(() => {
      loadActiveInstitute(session.user!.id);
    }, 0);
  });
}
