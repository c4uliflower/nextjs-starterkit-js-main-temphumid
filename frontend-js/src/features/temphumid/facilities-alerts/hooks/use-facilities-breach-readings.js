"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchFacilitiesBreachEvents } from "@/features/temphumid/shared/utils/api";

export function useFacilitiesBreachReadings(alertId) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [page, setPage] = useState(1);

  const fetchPage = useCallback(
    async (targetPage) => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchFacilitiesBreachEvents(alertId, targetPage);
        setRows(result.data);
        setMeta(result.meta);
        setPage(targetPage);
      } catch (err) {
        setError(err.response?.data?.message ?? "Failed to load breach history.");
      } finally {
        setLoading(false);
      }
    },
    [alertId]
  );

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  return {
    error,
    fetchPage,
    loading,
    meta,
    page,
    rows,
  };
}

