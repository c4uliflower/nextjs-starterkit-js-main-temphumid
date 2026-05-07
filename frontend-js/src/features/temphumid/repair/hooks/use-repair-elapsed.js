"use client";

import { useEffect, useMemo, useState } from "react";

function calculateElapsed(startAt, endAt = null) {
  if (!startAt) return 0;

  const start = new Date(startAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : Date.now();

  if (Number.isNaN(start) || Number.isNaN(end)) return 0;

  return Math.max(0, Math.floor((end - start) / 1000));
}

export function useRepairElapsed(startAt, endAt = null) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startAt || endAt) return undefined;

    const timer = setInterval(() => setElapsed(calculateElapsed(startAt)), 1000);
    return () => clearInterval(timer);
  }, [endAt, startAt]);

  const completedElapsed = useMemo(
    () => (endAt ? calculateElapsed(startAt, endAt) : 0),
    [endAt, startAt]
  );

  return endAt ? completedElapsed : elapsed;
}
