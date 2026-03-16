"use client";

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconClock, IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
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
  minutes: number;
}

interface TimeToMergeCardProps {
  chartData: ChartDataPoint[];
  averageFormatted: string;
  trendPercent: number | null;
}

function formatTooltipValue(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  const days = Math.floor(minutes / 1440);
  const hours = Math.round((minutes % 1440) / 60);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

export function TimeToMergeCard({ chartData, averageFormatted, trendPercent }: TimeToMergeCardProps) {
  const hasData = chartData.length > 0 && averageFormatted !== "N/A";

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <IconClock className="size-3.5" />
          Average Time to Merge
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">{averageFormatted}</span>
          {trendPercent !== null && (
            <Badge
              variant="secondary"
              className={`text-xs ${trendPercent > 0 ? "text-red-500" : "text-emerald-500"}`}
            >
              {trendPercent > 0 ? (
                <IconTrendingUp className="mr-0.5 size-3" />
              ) : (
                <IconTrendingDown className="mr-0.5 size-3" />
              )}
              {Math.abs(trendPercent)}%
            </Badge>
          )}
        </div>
        <div className="mt-4 flex-1">
          {hasData ? (
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="ttmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatter={(value) => [formatTooltipValue(value ?? 0), "Time to Merge"]}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="minutes"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  fill="url(#ttmGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[120px] items-center justify-center">
              <p className="text-sm text-muted-foreground">No data available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
