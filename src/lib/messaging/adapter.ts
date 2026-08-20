/**
 * Supabase adapter for message templates, defaults, and comm logs.
 * Institute-scoped via RLS (is_member). Soft-delete on templates.
 */
import { supabase } from "@/integrations/supabase/client";
import { getSession } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/store";
import {
  DEFAULT_TEMPLATES,
  DEFAULT_TEMPLATE_SELECTION,
  type DefaultTemplateMap,
  type MessageTemplate,
  type TemplateCategory,
  type TemplateLanguage,
} from "./templates";

export type CommLog = {
  id: string;
  date: string;
  studentId: string;
  studentName: string;
  mobile: string;
  templateId: string;
  templateName: string;
  category: TemplateCategory;
  message: string;
  sentBy: string;
  paymentReceivedAfter?: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function instituteId(): string {
  const id = getSession().instituteId ?? getSettings().institute.id;
  if (!id) throw new Error("No active institute");
  return id;
}

function instituteIdOrNull(): string | null {
  return getSession().instituteId ?? getSettings().institute.id ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTemplate(r: any): MessageTemplate {
  return {
    id: r.id,
    name: r.name,
    category: r.category as TemplateCategory,
    subType: r.sub_type ?? undefined,
    language: r.language as TemplateLanguage,
    content: r.content,
    builtIn: r.built_in ?? false,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toLog(r: any): CommLog {
  return {
    id: r.id,
    date: r.created_at,
    studentId: r.student_id ?? "",
    studentName: r.student_name,
    mobile: r.mobile ?? "",
    templateId: r.template_id ?? "",
    templateName: r.template_name,
    category: r.category as TemplateCategory,
    message: r.message,
    sentBy: r.sent_by ?? "",
    paymentReceivedAfter: r.payment_received_after ?? false,
  };
}

export type MessagingState = {
  templates: MessageTemplate[];
  defaults: DefaultTemplateMap;
  logs: CommLog[];
  /** True when messaging tables are missing / unreachable — use built-in offline copy. */
  offline?: boolean;
  offlineReason?: string;
};

function isMissingRelation(error: unknown): boolean {
  const e = error as { code?: string; message?: string; details?: string; hint?: string };
  const blob = `${e?.code ?? ""} ${e?.message ?? ""} ${e?.details ?? ""} ${e?.hint ?? ""}`.toLowerCase();
  return (
    e?.code === "42P01" ||
    e?.code === "PGRST205" ||
    blob.includes("does not exist") ||
    blob.includes("schema cache") ||
    blob.includes("could not find the table")
  );
}

function resolveDefaults(
  templates: MessageTemplate[],
  fromDb?: { category: string; template_id: string }[],
): DefaultTemplateMap {
  const defaults: DefaultTemplateMap = { ...DEFAULT_TEMPLATE_SELECTION };
  for (const row of fromDb ?? []) {
    const cat = row.category as keyof DefaultTemplateMap;
    if (cat in defaults) defaults[cat] = row.template_id;
  }
  for (const cat of Object.keys(defaults) as (keyof DefaultTemplateMap)[]) {
    if (!templates.some((t) => t.id === defaults[cat])) {
      const bySlug = templates.find((t) => t.id === DEFAULT_TEMPLATE_SELECTION[cat]);
      const byCat = templates.find((t) => t.category === cat);
      defaults[cat] = bySlug?.id ?? byCat?.id ?? defaults[cat];
    }
  }
  return defaults;
}

function offlineFallback(reason: string): MessagingState {
  const templates = DEFAULT_TEMPLATES.map((t) => ({ ...t }));
  return {
    templates,
    defaults: resolveDefaults(templates),
    logs: [],
    offline: true,
    offlineReason: reason,
  };
}

/**
 * If the migration applied but this institute has zero rows (seed missed),
 * INSERT built-ins only — never UPDATE/DELETE existing live rows.
 */
async function ensureBuiltInsIfEmpty(instId: string): Promise<void> {
  const { count, error } = await supabase
    .from("message_templates")
    .select("id", { count: "exact", head: true })
    .eq("institute_id", instId);
  if (error || (count ?? 0) > 0) return;

  for (const t of DEFAULT_TEMPLATES) {
    const { error: insErr } = await supabase.from("message_templates").insert({
      institute_id: instId,
      slug: t.id,
      name: t.name,
      category: t.category,
      sub_type: t.subType ?? null,
      language: t.language,
      content: t.content,
      built_in: true,
    });
    if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) {
      /* leave empty; caller will still load whatever exists */
    }
  }

  const { data: seeded } = await supabase
    .from("message_templates")
    .select("id, slug")
    .eq("institute_id", instId)
    .eq("built_in", true)
    .eq("deleted", false);
  const bySlug = new Map((seeded ?? []).map((r) => [r.slug as string, r.id as string]));
  const pairs: Array<[keyof DefaultTemplateMap, string]> = [
    ["reminder", "tpl_friendly"],
    ["acknowledgement", "tpl_ack_partial"],
    ["admission", "tpl_adm_confirm"],
    ["attendance", "tpl_att_absence_en"],
  ];
  for (const [category, slug] of pairs) {
    const templateId = bySlug.get(slug);
    if (!templateId) continue;
    await supabase.from("message_template_defaults").upsert(
      { institute_id: instId, category, template_id: templateId },
      { onConflict: "institute_id,category" },
    );
  }
}

export async function loadMessaging(): Promise<MessagingState> {
  const instId = instituteIdOrNull();
  if (!instId) {
    return offlineFallback("No active institute");
  }

  try {
    await ensureBuiltInsIfEmpty(instId);
  } catch {
    /* probe/seed failures handled by the select below */
  }

  const [tplRes, defRes, logRes] = await Promise.all([
    supabase
      .from("message_templates")
      .select("*")
      .eq("institute_id", instId)
      .eq("deleted", false)
      .order("name"),
    supabase.from("message_template_defaults").select("*").eq("institute_id", instId),
    supabase
      .from("comm_logs")
      .select("*")
      .eq("institute_id", instId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (tplRes.error || defRes.error || logRes.error) {
    const err = tplRes.error ?? defRes.error ?? logRes.error;
    if (isMissingRelation(err)) {
      return offlineFallback(
        "Messaging tables are not on this database yet. Apply migration 20260814000000_message_templates_and_comm_logs.sql (supabase db push), then refresh.",
      );
    }
    throw err;
  }

  const templates = (tplRes.data ?? []).map(toTemplate);
  if (templates.length === 0) {
    return offlineFallback(
      "No templates found for this institute. Apply the messaging migration or click Restore defaults after the tables exist.",
    );
  }

  return {
    templates,
    defaults: resolveDefaults(templates, defRes.data ?? undefined),
    logs: (logRes.data ?? []).map(toLog),
  };
}

export async function insertTemplate(
  t: Omit<MessageTemplate, "id"> & { id?: string },
): Promise<MessageTemplate> {
  const instId = instituteId();
  const { data, error } = await supabase
    .from("message_templates")
    .insert({
      institute_id: instId,
      name: t.name,
      category: t.category,
      sub_type: t.subType ?? null,
      language: t.language,
      content: t.content,
      built_in: t.builtIn ?? false,
      slug: t.builtIn && t.id && !UUID_RE.test(t.id) ? t.id : null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return toTemplate(data);
}

export async function updateTemplate(t: MessageTemplate): Promise<MessageTemplate> {
  const { data, error } = await supabase
    .from("message_templates")
    .update({
      name: t.name,
      category: t.category,
      sub_type: t.subType ?? null,
      language: t.language,
      content: t.content,
    })
    .eq("id", t.id)
    .eq("deleted", false)
    .select("*")
    .single();
  if (error) throw error;
  return toTemplate(data);
}

export async function upsertTemplateRow(t: MessageTemplate): Promise<MessageTemplate> {
  if (t.id && UUID_RE.test(t.id)) return updateTemplate(t);
  return insertTemplate(t);
}

export async function softDeleteTemplate(id: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("message_templates")
    .update({
      deleted: true,
      deleted_at: now,
      deleted_by: getSession().userId ?? null,
    })
    .eq("id", id)
    .eq("built_in", false);
  if (error) throw error;
}

export async function restoreBuiltInTemplates(): Promise<void> {
  const instId = instituteId();
  for (const t of DEFAULT_TEMPLATES) {
    const { error } = await supabase
      .from("message_templates")
      .update({
        name: t.name,
        category: t.category,
        sub_type: t.subType ?? null,
        language: t.language,
        content: t.content,
      })
      .eq("institute_id", instId)
      .eq("slug", t.id)
      .eq("built_in", true)
      .eq("deleted", false);
    if (error) throw error;
  }
}

export async function setDefaultTemplateRow(
  category: keyof DefaultTemplateMap,
  templateId: string,
): Promise<void> {
  const instId = instituteId();
  const { error } = await supabase.from("message_template_defaults").upsert(
    { institute_id: instId, category, template_id: templateId },
    { onConflict: "institute_id,category" },
  );
  if (error) throw error;
}

export async function insertCommLog(
  entry: Omit<CommLog, "id" | "date"> & { date?: string },
): Promise<CommLog> {
  const instId = instituteId();
  const templateId = entry.templateId && UUID_RE.test(entry.templateId) ? entry.templateId : null;
  const { data, error } = await supabase
    .from("comm_logs")
    .insert({
      institute_id: instId,
      student_id: entry.studentId || null,
      student_name: entry.studentName,
      mobile: entry.mobile,
      template_id: templateId,
      template_name: entry.templateName,
      category: entry.category,
      message: entry.message,
      sent_by: entry.sentBy,
      created_at: entry.date ?? new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return toLog(data);
}

export async function markReminderLogsPaid(studentId: string): Promise<void> {
  const instId = instituteId();
  const { error } = await supabase
    .from("comm_logs")
    .update({ payment_received_after: true })
    .eq("institute_id", instId)
    .eq("student_id", studentId)
    .eq("category", "reminder");
  if (error) throw error;
}

const IMPORT_FLAG = "vidyafee.messaging.imported.v1";
const LEGACY_KEY = "vidyafee.messaging.v1";

/**
 * INSERT-only import of custom (non-built-in) localStorage templates.
 * Built-ins are seeded by the migration, so "any server row" is not a skip
 * signal. Skip only if this institute already has custom templates.
 * Does not UPDATE/DELETE existing rows. Does not set the one-shot flag
 * until the server is reachable (so a missing table can retry after apply).
 */
export async function importLegacyLocalTemplates(): Promise<number> {
  if (typeof window === "undefined") return 0;
  if (localStorage.getItem(IMPORT_FLAG)) return 0;
  const instId = instituteIdOrNull();
  if (!instId) return 0;

  const { data: existingCustom, error: probeError } = await supabase
    .from("message_templates")
    .select("id")
    .eq("institute_id", instId)
    .eq("built_in", false)
    .eq("deleted", false)
    .limit(1);
  if (probeError) return 0;

  if (existingCustom && existingCustom.length > 0) {
    localStorage.setItem(IMPORT_FLAG, "1");
    return 0;
  }

  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) {
    localStorage.setItem(IMPORT_FLAG, "1");
    return 0;
  }

  let parsed: { templates?: MessageTemplate[] };
  try {
    parsed = JSON.parse(raw) as { templates?: MessageTemplate[] };
  } catch {
    localStorage.setItem(IMPORT_FLAG, "1");
    return 0;
  }
  const customs = (parsed.templates ?? []).filter((t) => !t.builtIn);
  let inserted = 0;
  for (const t of customs) {
    try {
      await insertTemplate({
        name: t.name,
        category: t.category,
        subType: t.subType,
        language: t.language,
        content: t.content,
        builtIn: false,
      });
      inserted += 1;
    } catch {
      /* skip duplicates / RLS errors; never UPDATE existing rows */
    }
  }
  localStorage.setItem(IMPORT_FLAG, "1");
  return inserted;
}
