"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchRepairActive,
  fetchRepairHistory,
} from "@/features/temphumid/shared/utils/api";
import {
  buildQueuedRepairFormData,
  buildQueuedRepairRecord,
  buildRepairHeaderSummary,
  buildSelectedRepairFormData,
  createRepairFormData,
  getRepairStats,
  isSameRepairHistory,
  mapActiveRepairRecord,
  mapRepairHistoryRecord,
  mergeActiveRepairRecords,
  repairCache,
} from "@/features/temphumid/repair/utils/repair";

export function useRepairDashboard() {
  const [activeRecords, setActiveRecords] = useState(repairCache.active ?? []);
  const [repairHistory, setRepairHistory] = useState(repairCache.history ?? []);
  const [pendingDone, setPendingDone] = useState(repairCache.pendingDone ?? []);
  const [pageLoading, setPageLoading] = useState(
    repairCache.active === null && repairCache.history === null
  );
  const [historyLoading, setHistoryLoading] = useState(repairCache.history === null);
  const [activeError, setActiveError] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [startOpen, setStartOpen] = useState(false);
  const [markDoneOpen, setMarkDoneOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [formData, setFormData] = useState(repairCache.formData ?? createRepairFormData());
  const [acuStatus, setAcuStatus] = useState(repairCache.acuStatus ?? "");

  useEffect(() => {
    if (repairCache.active !== null || activeRecords.length > 0) {
      repairCache.active = activeRecords;
    }
  }, [activeRecords]);

  useEffect(() => {
    if (repairCache.history !== null || repairHistory.length > 0) {
      repairCache.history = repairHistory;
    }
  }, [repairHistory]);

  useEffect(() => {
    repairCache.pendingDone = pendingDone;
  }, [pendingDone]);

  useEffect(() => {
    repairCache.formData = formData;
  }, [formData]);

  useEffect(() => {
    repairCache.acuStatus = acuStatus;
  }, [acuStatus]);

  const refreshHistory = useCallback(async (options = {}) => {
    const hasExistingHistory =
      (repairCache.history && repairCache.history.length > 0) || repairHistory.length > 0;

    if (!hasExistingHistory) setHistoryLoading(true);
    setHistoryError(null);

    try {
      const records = await fetchRepairHistory(options);
      const mapped = records.map(mapRepairHistoryRecord);

      setRepairHistory((previous) => {
        if (isSameRepairHistory(previous, mapped)) return previous;
        repairCache.history = mapped;
        return mapped;
      });
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error("Failed to fetch repair history:", error);
        setHistoryError("Failed to load history. Please refresh.");
      }
    } finally {
      if (!hasExistingHistory) setHistoryLoading(false);
    }
  }, [repairHistory.length]);

  const syncActiveRecords = useCallback(async (signal) => {
    const records = await fetchRepairActive({ signal });
    const filtered = records.filter((record) => !record.uploaded_at && record.status !== "uploaded");
    const mapped = filtered.map(mapActiveRepairRecord);

    setActiveRecords((previous) => {
      const next = mergeActiveRepairRecords(previous, mapped);
      repairCache.active = next;
      return next;
    });

    setActiveError(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let activeResolved = repairCache.active !== null;
    let historyResolved = repairCache.history !== null;

    const checkBothResolved = () => {
      if (activeResolved && historyResolved) setPageLoading(false);
    };

    const fetchActive = async () => {
      try {
        await syncActiveRecords(controller.signal);
      } catch (error) {
        if (error.response?.status !== 404 && error.name !== "CanceledError") {
          console.error("Failed to fetch active repair records:", error);
          setActiveError("Failed to load active records. Showing cached data.");
        }
      } finally {
        activeResolved = true;
        checkBothResolved();
      }
    };

    const fetchHistory = async () => {
      const hasCachedHistory = repairCache.history !== null;
      if (!hasCachedHistory) setHistoryLoading(true);

      try {
        const records = await fetchRepairHistory({ signal: controller.signal });
        const mapped = records.map(mapRepairHistoryRecord);

        setRepairHistory((previous) => {
          if (isSameRepairHistory(previous, mapped)) return previous;
          repairCache.history = mapped;
          return mapped;
        });

        setHistoryError(null);
      } catch (error) {
        if (error.response?.status !== 404 && error.name !== "CanceledError") {
          console.error("Failed to fetch repair history:", error);
          setHistoryError("Failed to load history. Showing cached data.");
        }
      } finally {
        if (!hasCachedHistory) setHistoryLoading(false);
        historyResolved = true;
        checkBothResolved();
      }
    };

    if (repairCache.active !== null) {
      setActiveRecords(repairCache.active);
      activeResolved = true;
    }

    if (repairCache.history !== null) {
      setRepairHistory(repairCache.history);
      setHistoryLoading(false);
      historyResolved = true;
    }

    checkBothResolved();
    fetchActive();
    fetchHistory();

    const poll = setInterval(async () => {
      try {
        await syncActiveRecords(controller.signal);
      } catch (error) {
        if (error.response?.status !== 404 && error.name !== "CanceledError") {
          console.error("Repair poll failed:", error);
        }
      }
    }, 30_000);

    return () => {
      clearInterval(poll);
      controller.abort();
    };
  }, [syncActiveRecords]);

  const handleQueued = useCallback(({ id, acuInfo, techInfo, processedAt }) => {
    const newRecord = buildQueuedRepairRecord({
      id,
      processedAt,
      acuInfo,
      techInfo,
    });

    setActiveRecords((previous) => {
      const next = [newRecord, ...previous.filter((record) => record.id !== newRecord.id)];
      repairCache.active = next;
      return next;
    });

    const nextFormData = buildQueuedRepairFormData(acuInfo, techInfo.technicianId);
    setFormData(nextFormData);
    setAcuStatus(acuInfo.status);

    repairCache.formData = nextFormData;
    repairCache.acuStatus = acuInfo.status;
  }, []);

  const handleDone = useCallback((id, _reason, payload) => {
    let updatedRecord = null;
    const normalizedId = Number(id);

    setActiveRecords((previous) => {
      const next = previous.map((record) => {
        if (record.id !== normalizedId) return record;

        updatedRecord = {
          ...record,
          reason: payload.reasonLabel,
          remarks: payload.remarks,
          markedDoneAt: payload.markedDoneAt,
          durationSeconds: payload.durationSeconds,
        };

        return updatedRecord;
      });

      repairCache.active = next;
      return next;
    });

    if (!updatedRecord) return;

    setPendingDone((previous) => {
      const next = [
        { ...updatedRecord },
        ...previous.filter((record) => record.id !== updatedRecord.id),
      ];
      repairCache.pendingDone = next;
      return next;
    });

    const nextFormData = buildSelectedRepairFormData(updatedRecord);
    setFormData(nextFormData);
    setAcuStatus(updatedRecord.acuStatus || "");

    repairCache.formData = nextFormData;
    repairCache.acuStatus = updatedRecord.acuStatus || "";
  }, []);

  const handleUpload = useCallback(async () => {
    const uploadedIds = new Set(pendingDone.map((record) => Number(record.id)));

    setActiveRecords((previous) => {
      const next = previous.filter((record) => !uploadedIds.has(Number(record.id)));
      repairCache.active = next;
      return next;
    });

    setPendingDone([]);
    repairCache.pendingDone = [];

    const clearedForm = createRepairFormData();
    setFormData(clearedForm);
    setAcuStatus("");

    repairCache.formData = clearedForm;
    repairCache.acuStatus = "";

    await refreshHistory();
  }, [pendingDone, refreshHistory]);

  const openMarkDone = useCallback((record) => {
    if (record.markedDoneAt) return;

    setActiveRecord(record);
    setFormData(buildSelectedRepairFormData(record));
    setAcuStatus(record.acuStatus ?? "");
    setMarkDoneOpen(true);
  }, []);

  const stats = getRepairStats(activeRecords, pendingDone, repairHistory);

  return {
    activeError,
    activeRecord,
    activeRecords,
    acuStatus,
    closeMarkDoneModal: () => {
      setMarkDoneOpen(false);
      setActiveRecord(null);
    },
    closeStartModal: () => setStartOpen(false),
    closeUploadModal: () => setUploadOpen(false),
    formData,
    handleDone,
    handleQueued,
    handleUpload,
    headerSummary: buildRepairHeaderSummary(stats),
    historyError,
    historyLoading,
    markDoneOpen,
    openMarkDone,
    openStartModal: () => setStartOpen(true),
    openUploadModal: () => setUploadOpen(true),
    pageLoading,
    pendingCount: stats.pendingCount,
    pendingDone,
    repairHistory,
    selectedHistory,
    setSelectedHistory,
    startOpen,
    stats,
    uploadOpen,
  };
}
