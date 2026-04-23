"use client";

import { useEffect, useState } from "react";

import { parseUTC } from "@/utils/time";

// Copied from the current temp/humid monitoring route page as an additive scaffold.

export function useElapsedTimer(processedAt) {
  const getSnapshot = () => {
    const start = parseUTC(processedAt);
    const end = new Date();

    if (!start || Number.isNaN(start.getTime())) return 0;
    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  };

  const [elapsed, setElapsed] = useState(getSnapshot);

  useEffect(() => {
    setElapsed(getSnapshot());
    const interval = setInterval(() => setElapsed(getSnapshot()), 1000);
    return () => clearInterval(interval);
  }, [processedAt]);

  return elapsed;
}
