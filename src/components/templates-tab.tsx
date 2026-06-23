import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, Trash2, Variable } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  CATEGORY_LABELS,
  TEMPLATE_VARIABLES,
  type MessageTemplate,
  type TemplateCategory,
  type TemplateLanguage,
} from "@/lib/messaging/templates";
import {
  deleteTemplate,
  restoreDefaults,
  setDefaultTemplate,
  upsertTemplate,
  useMessaging,
} from "@/lib/messaging/store";
import { renderTemplate, buildContext } from "@/lib/messaging/whatsapp";
import { useSettings } from "@/lib/settings/store";

export function TemplatesTab() {
  const { templates, defaults } = useMessaging();
  const { institute } = useSettings();
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? "");
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];

  const grouped = useMemo(() => {
    const map: Record<TemplateCategory, MessageTemplate[]> = {
      reminder: [], acknowledgement: [], admission: [], general: [],
    };
    templates.forEach((t) => map[t.category].push(t));
    return map;
  }, [templates]);

  const newTemplate = (category: TemplateCategory) => {
    const t: MessageTemplate = {
      id: `tpl_${Date.now()}`,
      name: "New Template",
      category,
      language: "English",
      content: "Dear {{ParentName}},\n\n...\n\nRegards,\n{{InstituteName}}",
    };
    upsertTemplate(t);
    setSelectedId(t.id);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">Default templates</CardTitle>
            <p className="text-xs text-muted-foreground">
              These will be auto-selected for one-click reminders and acknowledgements.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { restoreDefaults(); toast.success("Built-in templates restored"); }}>
            <RotateCcw className="h-4 w-4" /> Restore defaults
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {(["reminder", "acknowledgement", "admission"] as const).map((cat) => (
            <div key={cat} className="space-y-1.5">
              <Label className="text-xs">{CATEGORY_LABELS[cat]}</Label>
              <Select value={defaults[cat]} onValueChange={(v) => setDefaultTemplate(cat, v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {grouped[cat].map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} · {t.language}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="lg:max-h-[640px] lg:overflow-y-auto">
          <CardContent className="p-2 space-y-3">
            {(Object.keys(grouped) as TemplateCategory[]).map((cat) => (
              <div key={cat}>
                <div className="flex items-center justify-between px-2 pb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </p>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => newTemplate(cat)} aria-label="Add">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {grouped[cat].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition ${selected?.id === t.id ? "bg-accent" : "hover:bg-accent/50"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{t.name}</span>
                        <Badge variant="outline" className="text-[10px]">{t.language[0]}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {selected && <TemplateEditor key={selected.id} template={selected} instituteName={institute.name} />}
      </div>
    </div>
  );
}

function TemplateEditor({
  template,
  instituteName,
}: {
  template: MessageTemplate;
  instituteName: string;
}) {
  const [form, setForm] = useState<MessageTemplate>(template);
  const preview = useMemo(
    () => renderTemplate(form.content, buildContext({
      extras: {
        StudentName: "Aarav Sharma",
        ParentName: "Mr. Sharma",
        BatchName: "10th State Board",
        TotalFee: 38000,
        PaidAmount: 15000,
        PendingAmount: 23000,
        ReceiptNumber: "REC-1024",
        PaymentDate: "23 Jun 2026",
        DueDate: "30 Jun 2026",
      },
    })),
    [form.content],
  );

  const insertVar = (v: string) => {
    setForm((f) => ({ ...f, content: `${f.content}{{${v}}}` }));
  };
  const save = () => { upsertTemplate(form); toast.success("Template saved"); };
  const del = () => {
    if (form.builtIn) return toast.error("Built-in templates can't be deleted. Edit or restore defaults instead.");
    deleteTemplate(form.id);
    toast.success("Template deleted");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="space-y-1 flex-1">
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="font-display text-base font-semibold"
          />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as TemplateCategory })}>
              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v as TemplateLanguage })}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="English">English</SelectItem>
                <SelectItem value="Marathi">Marathi</SelectItem>
                <SelectItem value="Hinglish">Hinglish</SelectItem>
              </SelectContent>
            </Select>
            {form.builtIn && <Badge variant="secondary">Built-in</Badge>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Message body</Label>
              <span className="text-[11px] text-muted-foreground">{form.content.length} chars</span>
            </div>
            <Textarea
              rows={14}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="font-mono text-xs"
            />
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Variable className="h-3.5 w-3.5" /> Insert variable
              </div>
              <div className="flex flex-wrap gap-1">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVar(v)}
                    className="rounded border bg-muted/40 px-1.5 py-0.5 text-[11px] hover:bg-accent"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>WhatsApp preview</Label>
            <div className="rounded-xl bg-[#e5ddd5] p-3 min-h-[280px]">
              <div className="ml-auto max-w-[88%] rounded-lg bg-[#dcf8c6] p-3 shadow-sm">
                <p className="text-[11px] font-semibold text-emerald-800">{instituteName}</p>
                <pre className="mt-1 whitespace-pre-wrap break-words font-sans text-xs text-foreground">{preview}</pre>
                <p className="mt-2 text-right text-[10px] text-muted-foreground">12:30 PM ✓✓</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {!form.builtIn && (
            <Button variant="outline" onClick={del}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          <Button onClick={save}>Save template</Button>
        </div>
      </CardContent>
    </Card>
  );
}
