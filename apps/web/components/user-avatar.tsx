"use client";

import { useEffect, useRef } from "react";
import { configure, update } from "jdenticon";
import { cn } from "@/lib/utils";

configure({
  hues: [158],
  lightness: {
    color: [0.26, 0.8],
    grayscale: [0.2, 0.9],
  },
  saturation: {
    color: 0.5,
    grayscale: 0.14,
  },
  backColor: "#0000",
});

type UserAvatarProps = {
  value: string;
  size?: number;
  className?: string;
};

export function UserAvatar({ value, size = 32, className }: UserAvatarProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      update(svgRef.current, value);
    }
  }, [value]);

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      data-jdenticon-value={value}
      className={cn("rounded-full", className)}
    />
  );
}
