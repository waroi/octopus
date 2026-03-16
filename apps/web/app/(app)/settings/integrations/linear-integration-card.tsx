"use client";

import { useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { disconnectLinear } from "./actions";

type LinearData = {
  workspaceName: string;
} | null;

function LinearLogo() {
  return (
    <div className="flex size-10 items-center justify-center rounded-md bg-[#5E6AD2]">
      <svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5964C20.0515 94.4522 5.54779 79.9485 1.22541 61.5228zM.00189135 46.8891c-.01764375.2258.07825625.4438.2558.5897L52.5212 99.7432c.1459.1776.364.2735.5897.2558C54.4447 99.9233 55.1567 99.9 56 99.9c.1683 0 .3327-.0011.4952-.0034L.0011 43.4048C.00363.5423.00003 44.7458 0 45.3c0 .5311.00063.9941.00189 1.5891zM4.69799 27.3042c-.2857.5714-.1778 1.2561.2625 1.7107L71.1851 95.3395c.4545.4404 1.1393.5483 1.7107.2625C79.4656 92.0452 85.4242 86.5299 89.3572 79.6993L20.3007 10.6428C13.4701 14.5758 7.95479 20.5344 4.69799 27.3042zM26.8558 6.66676 93.3332 73.1442C97.1946 65.265 99.3 56.39 99.3 47c0-2.6252-.1325-5.2214-.3892-7.7791L60.7791.689243C58.2214.432572 55.6252.3 53 .3c-9.39 0-18.265 2.10537-26.1442 6.36676zM74.5706 4.01045c-5.9813-2.29191-12.4537-3.54568-19.2147-3.70185L98.8914 44.6441C98.7352 37.8831 97.4814 31.4107 95.1896 25.4294L74.5706 4.01045z" fill="white"/>
      </svg>
    </div>
  );
}

export function LinearIntegrationCard({ data }: { data: LinearData }) {
  const [isPending, startTransition] = useTransition();

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <LinearLogo />
            <div>
              <CardTitle className="text-base">Linear</CardTitle>
              <CardDescription>
                Create Linear issues directly from code review findings.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <a href="/api/linear/oauth">
            <Button>Connect Linear</Button>
          </a>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LinearLogo />
            <div>
              <CardTitle className="text-base">Linear</CardTitle>
              <CardDescription>
                Connected to <span className="font-medium">{data.workspaceName}</span>
              </CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-green-700 bg-green-100">
            Connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Button
          variant="destructive"
          size="sm"
          disabled={isPending}
          onClick={() => {
            startTransition(() => {
              disconnectLinear();
            });
          }}
        >
          Disconnect Linear
        </Button>
      </CardContent>
    </Card>
  );
}
