"use client";

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { IconAlertCircle } from "@tabler/icons-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";

interface ChartDataPoint {
  date: string;
  issues: number;
}

interface IssuesPerPrStats {
  average: string;
  p25: string;
  p50: string;
  p75: string;
}

interface CommentsPerPrCardProps {
  chartData: ChartDataPoint[];
  stats: IssuesPerPrStats;
}

export function CommentsPerPrCard({ chartData, stats }: CommentsPerPrCardProps) {
  const hasData = chartData.length > 0 && stats.average !== "N/A";

  const statItems = [
    { label: "Average", value: stats.average },
    { label: "P25", value: stats.p25 },
    { label: "P50", value: stats.p50 },
    { label: "P75", value: stats.p75 },
  ];

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <IconAlertCircle className="size-3.5" />
          Issues per PR
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex-1">
          {hasData ? (
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="cprGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis hide />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatter={(value) => [Number(value ?? 0).toFixed(1), "Issues/PR"]}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="issues"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#cprGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[100px] items-center justify-center">
              <p className="text-sm text-muted-foreground">No data available</p>
            </div>
          )}
        </div>
        <div className="mt-auto min-h-[60px] grid grid-cols-4 gap-2 border-t pt-3">
          {statItems.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-xl font-bold">{s.value === "N/A" ? "-" : s.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
