import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSession } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/store";
import { DEFAULT_TEMPLATE_SELECTION, type DefaultTemplateMap, type MessageTemplate } from "./templates";
import {
  importLegacyLocalTemplates,
  insertCommLog,
  loadMessaging,
  markReminderLogsPaid,
  restoreBuiltInTemplates,
  setDefaultTemplateRow,
  softDeleteTemplate,
  upsertTemplateRow,
  type CommLog,
  type MessagingState,
} from "./adapter";

export type { CommLog };

export const MESSAGING_QUERY_KEY = ["messaging"] as const;

const empty: MessagingState = {
  templates: [],
  defaults: { ...DEFAULT_TEMPLATE_SELECTION },
  logs: [],
};

let cache: MessagingState = empty;

function instituteKey(): string | null {
  return getSession().instituteId ?? getSettings().institute.id ?? null;
}

function queryKey() {
  return [...MESSAGING_QUERY_KEY, instituteKey()] as const;
}

export async function fetchMessagingState(): Promise<MessagingState> {
  await importLegacyLocalTemplates();
  const data = await loadMessaging();
  cache = data;
  return data;
}

export function getMessaging(): MessagingState {
  return cache;
}

export function useMessaging(): MessagingState {
  const instId = instituteKey();
  const q = useQuery({
    queryKey: [...MESSAGING_QUERY_KEY, instId],
    queryFn: fetchMessagingState,
    enabled: !!instId,
  });
  if (q.data) cache = q.data;
  return q.data ?? cache;
}

export function useMessagingQuery() {
  const instId = instituteKey();
  return useQuery({
    queryKey: [...MESSAGING_QUERY_KEY, instId],
    queryFn: fetchMessagingState,
    enabled: !!instId,
  });
}

export async function upsertTemplate(t: MessageTemplate): Promise<MessageTemplate> {
  const saved = await upsertTemplateRow(t);
  cache = await loadMessaging();
  return saved;
}

export async function deleteTemplate(id: string): Promise<void> {
  await softDeleteTemplate(id);
  cache = await loadMessaging();
}

export async function restoreDefaults(): Promise<void> {
  await restoreBuiltInTemplates();
  cache = await loadMessaging();
}

export async function setDefaultTemplate(
  category: keyof DefaultTemplateMap,
  id: string,
): Promise<void> {
  await setDefaultTemplateRow(category, id);
  cache = await loadMessaging();
}

export async function logComm(
  entry: Omit<CommLog, "id" | "date"> & { date?: string },
): Promise<CommLog> {
  const log = await insertCommLog(entry);
  cache = {
    ...cache,
    logs: [log, ...cache.logs].slice(0, 500),
  };
  return log;
}

export async function markLogPaid(studentId: string): Promise<void> {
  await markReminderLogsPaid(studentId);
  cache = {
    ...cache,
    logs: cache.logs.map((l) =>
      l.studentId === studentId && l.category === "reminder"
        ? { ...l, paymentReceivedAfter: true }
        : l,
    ),
  };
}

/** Call after mutations so React Query subscribers refetch. */
export function useInvalidateMessaging() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKey() });
}
