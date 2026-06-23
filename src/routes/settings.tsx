import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/app-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Vidyafee" }] }),
  component: Settings,
});

function Settings() {
  return (
    <>
      <AppHeader title="Settings" subtitle="Institute profile, branding and backend connection" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Institute profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Institute name" defaultValue="Dnyanpeeth Classes" />
            <Field label="Owner" defaultValue="Mr. Patil" />
            <Field label="Phone" defaultValue="+91 98765 43210" />
            <Field label="Email" defaultValue="hello@dnyanpeeth.in" />
            <Field label="Address" defaultValue="FC Road, Pune" />
            <Field label="GSTIN" defaultValue="27ABCDE1234F1Z5" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Backend connection</CardTitle>
            <p className="text-xs text-muted-foreground">
              Vidyafee speaks to your data through a single adapter. Today the demo uses in-memory
              sample data; point it at your Google Sheet by deploying the Apps Script web app and
              pasting the URL below.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary">Status</Badge>
              <span className="text-sm">Demo (mock data)</span>
            </div>
            <Field label="Google Apps Script Web App URL" placeholder="https://script.google.com/macros/s/…/exec" />
            <Field label="API token" placeholder="optional shared secret" />
            <Separator />
            <div className="rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed">
              <p className="font-semibold">Sheet structure</p>
              <p className="text-muted-foreground">
                Students · Batches · Payments · Receipts · Attendance. Each sheet uses the first row
                as headers; the adapter contract lives in <code>src/lib/data/adapter.ts</code> — keep
                the function signatures and you can swap to Supabase or Postgres later without touching
                the UI.
              </p>
            </div>
            <Button>Save & test connection</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-display text-lg font-bold">Growth · ₹4,999 / year</p>
              <p className="text-xs text-muted-foreground">Up to 500 students · WhatsApp reminders · Unlimited receipts</p>
            </div>
            <Button variant="outline">Manage plan</Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
}

function Field({ label, defaultValue, placeholder }: { label: string; defaultValue?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input defaultValue={defaultValue} placeholder={placeholder} />
    </div>
  );
}
