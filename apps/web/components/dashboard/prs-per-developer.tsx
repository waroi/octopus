"use client";

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconGitPullRequest, IconTrendingUp, IconTrendingDown } from "@tabler/icons-react";
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
  prs: number;
}

interface PrsPerDeveloperCardProps {
  chartData: ChartDataPoint[];
  averagePrsPerDev: number;
  trendPercent: number | null;
}

export function PrsPerDeveloperCard({ chartData, averagePrsPerDev, trendPercent }: PrsPerDeveloperCardProps) {
  const hasData = chartData.length > 0 && averagePrsPerDev > 0;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <IconGitPullRequest className="size-3.5" />
          PRs per Developer
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="flex-1">
          {hasData ? (
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="prsDevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis hide />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={20}
                />
                <Tooltip
                  content={
                    <ChartTooltip
                      formatter={(value) => [value ?? 0, "PRs"]}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="prs"
                  stroke="#4ade80"
                  strokeWidth={2}
                  fill="url(#prsDevGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[100px] items-center justify-center">
              <p className="text-sm text-muted-foreground">No data available</p>
            </div>
          )}
        </div>
        <div className="mt-auto min-h-[60px] border-t pt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold">
              {hasData ? `${averagePrsPerDev} PRs` : "-"}
            </span>
            {hasData && <span className="text-sm text-muted-foreground">/dev</span>}
            {trendPercent !== null && (
              <Badge
                variant="secondary"
                className={`ml-auto text-xs ${trendPercent > 0 ? "text-emerald-500" : "text-red-500"}`}
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
          <p className="mt-1 text-[10px] text-muted-foreground">
            Avg. merged PRs per developer
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
