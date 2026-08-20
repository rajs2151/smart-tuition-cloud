import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { inr, inrShort } from "@/lib/format";

type TrendPoint = { m: string; collected: number };
type BatchPoint = { name: string; value: number };

/** Lazy-loaded so recharts stays out of the initial dashboard chunk. */
export function DashboardCharts({
  months,
  hasTrendData,
  batchRevenue,
}: {
  months: TrendPoint[];
  hasTrendData: boolean;
  batchRevenue: BatchPoint[];
}) {
  return (
    <>
      <Card className="xl:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Collection trend</CardTitle>
            <p className="text-xs text-muted-foreground">Last 8 months</p>
          </div>
          {hasTrendData && (
            <Badge variant="outline" className="gap-1">
              <TrendingUp className="h-3 w-3 text-success" /> Trending up
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {hasTrendData ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={months} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={inrShort} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number) => inr(v)}
                  />
                  <Area type="monotone" dataKey="collected" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#g1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <TrendingUp className="h-8 w-8 opacity-40" />
              <p>No payments recorded in the last 8 months yet.</p>
              <p className="text-xs">The trend will appear here once collections start coming in.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function DashboardBatchRevenueChart({ batchRevenue }: { batchRevenue: BatchPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Revenue by batch</CardTitle>
        <p className="text-xs text-muted-foreground">Collected fees per active batch</p>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={batchRevenue} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={inrShort} />
              <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="value" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
