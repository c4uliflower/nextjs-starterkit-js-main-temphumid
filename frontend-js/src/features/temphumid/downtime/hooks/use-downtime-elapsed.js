"use client";

import { useEffect, useState } from "react";

import { parseUTC } from "@/utils/time";

export function useDowntimeElapsed(processedAt, markedDoneAt) {
  const getSnapshot = () => {
    const start = parseUTC(processedAt);
    const end = markedDoneAt ? parseUTC(markedDoneAt) : new Date();

    if (!start || Number.isNaN(start.getTime())) return 0;
    if (!end || Number.isNaN(end.getTime())) return 0;

    return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000));
  };

  const [elapsed, setElapsed] = useState(getSnapshot);

  useEffect(() => {
    setElapsed(getSnapshot());

    if (markedDoneAt) return undefined;

    const interval = setInterval(() => setElapsed(getSnapshot()), 1000);
    return () => clearInterval(interval);
  }, [processedAt, markedDoneAt]);

  return elapsed;
}
