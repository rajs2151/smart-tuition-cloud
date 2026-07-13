import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { X, Plus, Upload } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { TemplatesTab } from "@/components/templates-tab";

import {
  addMasterValue,
  removeMasterValue,
  setInstitute,
  setReceiptConfig,
  useSettings,
} from "@/lib/settings/store";
import type { MasterSettings } from "@/lib/data/types";
import { getEffectiveReceiptContact } from "@/lib/settings/receipt-contact";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Vidyafee" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <AppHeader
        title="Institute Settings"
        subtitle="Branding, receipts, academic structure and backend — all editable, no code changes."
      />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <Tabs defaultValue="institute" className="space-y-4">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="institute">Institute</TabsTrigger>
            <TabsTrigger value="receipt">Receipt</TabsTrigger>
            <TabsTrigger value="templates">Message Templates</TabsTrigger>
            <TabsTrigger value="academic">Academic</TabsTrigger>
            <TabsTrigger value="backend">Backend</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
          </TabsList>

          <TabsContent value="institute"><InstituteTab /></TabsContent>
          <TabsContent value="receipt"><ReceiptTab /></TabsContent>
          <TabsContent value="templates"><TemplatesTab /></TabsContent>
          <TabsContent value="academic"><AcademicTab /></TabsContent>
          <TabsContent value="backend"><BackendTab /></TabsContent>
          <TabsContent value="subscription"><SubscriptionTab /></TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function InstituteTab() {
  const { institute } = useSettings();
  const [form, setForm] = useState(institute);
  const onChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });
  const save = () => {
    setInstitute(form);
    toast.success("Institute profile saved");
  };

  const onLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, logoUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Basic information</CardTitle>
        <p className="text-xs text-muted-foreground">Shown on receipts, dashboard and reports.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border bg-muted">
            {form.logoUrl ? (
              <img src={form.logoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-xs text-muted-foreground">No logo</span>
            )}
          </div>
          <div>
            <Label className="mb-2 block">Institute logo</Label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
              <Upload className="h-4 w-4" /> Upload logo
              <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
            </label>
            {form.logoUrl && (
              <Button variant="ghost" size="sm" className="ml-2" onClick={() => setForm({ ...form, logoUrl: "" })}>
                Remove
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Institute name *" value={form.name} onChange={onChange("name")} />
          <Field label="Contact number *" value={form.phone} onChange={onChange("phone")} />
          <Field label="Email ID *" value={form.email} onChange={onChange("email")} />
          <Field label="Website" value={form.website ?? ""} onChange={onChange("website")} />
          <div className="sm:col-span-2">
            <Field label="Address *" value={form.address} onChange={onChange("address")} />
          </div>
          <Field label="GST number" value={form.gstNumber ?? ""} onChange={onChange("gstNumber")} />
        </div>
        <div className="flex justify-end">
          <Button onClick={save}>Save changes</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ReceiptTab() {
  const { institute, receipt } = useSettings();
  const [form, setForm] = useState(receipt);

  // Whether each field should follow the Institute tab. Derived once from
  // whatever was saved (an existing override means the box starts
  // unchecked) but kept as its own local toggle so unchecking a field
  // reveals an empty, editable input immediately — it doesn't need to
  // persist anywhere, since on save we simply null out the override for
  // any field where this is true.
  const [useInstitutePhone, setUseInstitutePhone] = useState(!receipt.phoneOverride);
  const [useInstituteEmail, setUseInstituteEmail] = useState(!receipt.emailOverride);
  const [useInstituteWebsite, setUseInstituteWebsite] = useState(!receipt.websiteOverride);

  const save = () => {
    const patch: Partial<typeof form> = {
      ...form,
      phoneOverride: useInstitutePhone ? null : form.phoneOverride?.trim() || null,
      emailOverride: useInstituteEmail ? null : form.emailOverride?.trim() || null,
      websiteOverride: useInstituteWebsite ? null : form.websiteOverride?.trim() || null,
    };
    setReceiptConfig(patch);
    toast.success("Receipt configuration saved");
  };

  const preview = getEffectiveReceiptContact(institute, {
    ...form,
    phoneOverride: useInstitutePhone ? null : form.phoneOverride,
    emailOverride: useInstituteEmail ? null : form.emailOverride,
    websiteOverride: useInstituteWebsite ? null : form.websiteOverride,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receipt Contact Details</CardTitle>
          <p className="text-xs text-muted-foreground">
            By default, receipts use the phone, email and website from the Institute tab. Turn any
            of these off to show something different on receipts only — the Institute tab stays
            unchanged either way.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <ContactOverrideField
            label="Use Institute Contact Number"
            useInstitute={useInstitutePhone}
            onUseInstituteChange={setUseInstitutePhone}
            preview={preview.phone || "—"}
          >
            <Label>Phone Numbers</Label>
            <Textarea
              rows={2}
              disabled={useInstitutePhone}
              value={form.phoneOverride ?? ""}
              onChange={(e) => setForm({ ...form, phoneOverride: e.target.value })}
              placeholder={"8637769576\n9021123456"}
            />
            <p className="text-[11px] text-muted-foreground">
              One per line, or comma-separated. Shown on receipts as: 8637769576 • 9021123456
            </p>
          </ContactOverrideField>

          <Separator />

          <ContactOverrideField
            label="Use Institute Email"
            useInstitute={useInstituteEmail}
            onUseInstituteChange={setUseInstituteEmail}
            preview={preview.email || "—"}
          >
            <Label>Email</Label>
            <Input
              disabled={useInstituteEmail}
              value={form.emailOverride ?? ""}
              onChange={(e) => setForm({ ...form, emailOverride: e.target.value })}
              placeholder="accounts@coaching.com"
            />
          </ContactOverrideField>

          <Separator />

          <ContactOverrideField
            label="Use Institute Website"
            useInstitute={useInstituteWebsite}
            onUseInstituteChange={setUseInstituteWebsite}
            preview={preview.website || "—"}
          >
            <Label>Website</Label>
            <Input
              disabled={useInstituteWebsite}
              value={form.websiteOverride ?? ""}
              onChange={(e) => setForm({ ...form, websiteOverride: e.target.value })}
              placeholder="www.coaching.com"
            />
          </ContactOverrideField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receipt configuration</CardTitle>
          <p className="text-xs text-muted-foreground">
            All receipts generated for this institute will use these settings.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Receipt prefix</Label>
              <Input
                value={form.prefix}
                onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
                placeholder="REC / FEE / INV"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Next receipt number</Label>
              <Input
                type="number"
                value={form.nextNumber}
                onChange={(e) => setForm({ ...form, nextNumber: Number(e.target.value) })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Authorized signatory name</Label>
              <Input
                value={form.authorizedSignatory}
                onChange={(e) => setForm({ ...form, authorizedSignatory: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Footer text</Label>
              <Textarea
                rows={2}
                value={form.footerText}
                onChange={(e) => setForm({ ...form, footerText: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Terms &amp; conditions</Label>
              <Textarea
                rows={4}
                value={form.termsAndConditions}
                onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })}
              />
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-3">
            <Toggle
              label="Show GST number"
              checked={form.showGst}
              onCheckedChange={(v) => setForm({ ...form, showGst: v })}
            />
            <Toggle
              label="Show institute logo"
              checked={form.showLogo}
              onCheckedChange={(v) => setForm({ ...form, showLogo: v })}
            />
            <Toggle
              label="Show footer notes"
              checked={form.showFooter}
              onCheckedChange={(v) => setForm({ ...form, showFooter: v })}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={save}>Save receipt settings</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ContactOverrideField({
  label,
  useInstitute,
  onUseInstituteChange,
  preview,
  children,
}: {
  label: string;
  useInstitute: boolean;
  onUseInstituteChange: (v: boolean) => void;
  preview: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <Switch checked={useInstitute} onCheckedChange={onUseInstituteChange} />
      </div>
      <div className="space-y-1.5">{children}</div>
      <p className="text-[11px] text-muted-foreground">On receipts: {preview}</p>
    </div>
  );
}

function AcademicTab() {
  const { master } = useSettings();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MasterList title="Standards" k="standards" values={master.standards} />
      <MasterList title="Boards" k="boards" values={master.boards} />
      <MasterList title="Mediums" k="mediums" values={master.mediums} />
      <MasterList title="Competitive Exams" k="examCategories" values={master.examCategories} />
    </div>
  );
}

function MasterList({ title, k, values }: { title: string; k: keyof MasterSettings; values: string[] }) {
  const [v, setV] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">Values shown across the app dropdowns.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {values.map((val) => (
            <Badge key={val} variant="secondary" className="gap-1 pr-1">
              {val}
              <button
                className="ml-1 rounded p-0.5 hover:bg-destructive/20 hover:text-destructive"
                onClick={() => removeMasterValue(k, val)}
                aria-label={`Remove ${val}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {values.length === 0 && <p className="text-xs text-muted-foreground">No values yet.</p>}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={`Add new ${title.toLowerCase().replace(/s$/, "")}`}
            value={v}
            onChange={(e) => setV(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addMasterValue(k, v);
                setV("");
              }
            }}
          />
          <Button onClick={() => { addMasterValue(k, v); setV(""); }} size="icon" aria-label="Add">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BackendTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Backend connection</CardTitle>
        <p className="text-xs text-muted-foreground">
          Vidyafee speaks to your data through a single adapter. The demo uses in-memory sample data;
          point it at your Google Sheet by deploying the Apps Script web app and pasting the URL below.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Status</Badge>
          <span className="text-sm">Demo (mock data)</span>
        </div>
        <div className="space-y-1.5">
          <Label>Google Apps Script Web App URL</Label>
          <Input placeholder="https://script.google.com/macros/s/…/exec" />
        </div>
        <div className="space-y-1.5">
          <Label>API token</Label>
          <Input placeholder="optional shared secret" />
        </div>
        <Separator />
        <div className="rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed">
          <p className="font-semibold">Sheet structure</p>
          <p className="text-muted-foreground">
            Students · Batches · Payments · Receipts · Settings. Each row carries an Institute ID so a
            single backend can serve multiple coaching institutes. Function signatures live in{" "}
            <code>src/lib/data/adapter.ts</code>.
          </p>
        </div>
        <Button>Save &amp; test connection</Button>
      </CardContent>
    </Card>
  );
}

function SubscriptionTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Subscription</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-display text-lg font-bold">Growth · ₹4,999 / year</p>
          <p className="text-xs text-muted-foreground">
            Up to 500 students · WhatsApp reminders · Unlimited receipts · Multi-batch
          </p>
        </div>
        <Button variant="outline">Manage plan</Button>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
