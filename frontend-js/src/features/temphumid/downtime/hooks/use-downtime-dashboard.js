"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchDowntimeActive,
  fetchDowntimeHistory,
} from "@/features/temphumid/shared/utils/api";
import {
  buildDowntimeHeaderSummary,
  buildQueuedDowntimeRecord,
  buildQueuedDowntimeFormData,
  buildSelectedDowntimeFormData,
  createDowntimeFormData,
  downtimeCache,
  getDowntimeStats,
  isSameDowntimeHistory,
  mapActiveDowntimeRecord,
  mapDowntimeHistoryRecord,
  mergeActiveDowntimeRecords,
} from "@/features/temphumid/downtime/utils/downtime";

export function useDowntimeDashboard() {
  const [stopLineList, setStopLineList] = useState(downtimeCache.active ?? []);
  const [maintenanceHistory, setMaintenanceHistory] = useState(downtimeCache.history ?? []);
  const [pendingDone, setPendingDone] = useState(downtimeCache.pendingDone ?? []);
  const [pageLoading, setPageLoading] = useState(
    downtimeCache.active === null && downtimeCache.history === null
  );
  const [historyLoading, setHistoryLoading] = useState(downtimeCache.history === null);
  const [activeError, setActiveError] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [startOpen, setStartOpen] = useState(false);
  const [markDoneOpen, setMarkDoneOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [activeRecord, setActiveRecord] = useState(null);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [formData, setFormData] = useState(
    downtimeCache.formData ?? createDowntimeFormData()
  );
  const [symptom, setSymptom] = useState(downtimeCache.symptom ?? "");

  useEffect(() => {
    if (downtimeCache.active !== null || stopLineList.length > 0) {
      downtimeCache.active = stopLineList;
    }
  }, [stopLineList]);

  useEffect(() => {
    if (downtimeCache.history !== null || maintenanceHistory.length > 0) {
      downtimeCache.history = maintenanceHistory;
    }
  }, [maintenanceHistory]);

  useEffect(() => {
    downtimeCache.pendingDone = pendingDone;
  }, [pendingDone]);

  useEffect(() => {
    downtimeCache.formData = formData;
  }, [formData]);

  useEffect(() => {
    downtimeCache.symptom = symptom;
  }, [symptom]);

  const refreshHistory = useCallback(async (options = {}) => {
    const hasExistingHistory =
      (downtimeCache.history && downtimeCache.history.length > 0) ||
      maintenanceHistory.length > 0;

    if (!hasExistingHistory) setHistoryLoading(true);
    setHistoryError(null);

    try {
      const records = await fetchDowntimeHistory(options);
      const mapped = records.map(mapDowntimeHistoryRecord);

      setMaintenanceHistory((previous) => {
        if (isSameDowntimeHistory(previous, mapped)) return previous;
        downtimeCache.history = mapped;
        return mapped;
      });
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error("Failed to fetch downtime history:", error);
        setHistoryError("Failed to load history. Please refresh.");
      }
    } finally {
      if (!hasExistingHistory) setHistoryLoading(false);
    }
  }, [maintenanceHistory.length]);

  const syncActiveRecords = useCallback(async (signal) => {
    const records = await fetchDowntimeActive({ signal });
    const filtered = records.filter((record) => !record.uploaded_at && record.status !== "uploaded");
    const mapped = filtered.map(mapActiveDowntimeRecord);

    setStopLineList((previous) => {
      const next = mergeActiveDowntimeRecords(previous, mapped);
      downtimeCache.active = next;
      return next;
    });

    setActiveError(null);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let activeResolved = downtimeCache.active !== null;
    let historyResolved = downtimeCache.history !== null;

    const checkBothResolved = () => {
      if (activeResolved && historyResolved) setPageLoading(false);
    };

    const fetchActive = async () => {
      try {
        await syncActiveRecords(controller.signal);
      } catch (error) {
        if (error.response?.status !== 404 && error.name !== "CanceledError") {
          console.error("Failed to fetch active downtime records:", error);
          setActiveError("Failed to load active records. Showing cached data.");
        }
      } finally {
        activeResolved = true;
        checkBothResolved();
      }
    };

    const fetchHistory = async () => {
      const hasCachedHistory = downtimeCache.history !== null;
      if (!hasCachedHistory) setHistoryLoading(true);

      try {
        const records = await fetchDowntimeHistory({ signal: controller.signal });
        const mapped = records.map(mapDowntimeHistoryRecord);

        setMaintenanceHistory((previous) => {
          if (isSameDowntimeHistory(previous, mapped)) return previous;
          downtimeCache.history = mapped;
          return mapped;
        });

        setHistoryError(null);
      } catch (error) {
        if (error.response?.status !== 404 && error.name !== "CanceledError") {
          console.error("Failed to fetch downtime history:", error);
          setHistoryError("Failed to load history. Showing cached data.");
        }
      } finally {
        if (!hasCachedHistory) setHistoryLoading(false);
        historyResolved = true;
        checkBothResolved();
      }
    };

    if (downtimeCache.active !== null) {
      setStopLineList(downtimeCache.active);
      activeResolved = true;
    }

    if (downtimeCache.history !== null) {
      setMaintenanceHistory(downtimeCache.history);
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
          console.error("Downtime poll failed:", error);
        }
      }
    }, 30_000);

    return () => {
      clearInterval(poll);
      controller.abort();
    };
  }, [syncActiveRecords]);

  const handleQueued = useCallback(({ id, sensorInfo, techInfo, symptomLabel, processedAt }) => {
    const newRecord = buildQueuedDowntimeRecord({
      id,
      processedAt,
      sensorInfo,
      symptomLabel,
      techInfo,
    });

    setStopLineList((previous) => {
      const next = [newRecord, ...previous.filter((record) => record.id !== newRecord.id)];
      downtimeCache.active = next;
      return next;
    });

    const nextFormData = buildQueuedDowntimeFormData(sensorInfo, techInfo.technicianId);
    setFormData(nextFormData);
    setSymptom(symptomLabel);

    downtimeCache.formData = nextFormData;
    downtimeCache.symptom = symptomLabel;
  }, []);

  const handleDone = useCallback((id, _reason, payload) => {
    let updatedRecord = null;
    const normalizedId = Number(id);

    setStopLineList((previous) => {
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

      downtimeCache.active = next;
      return next;
    });

    if (!updatedRecord) return;

    setPendingDone((previous) => {
      const next = [
        { ...updatedRecord },
        ...previous.filter((record) => record.id !== updatedRecord.id),
      ];
      downtimeCache.pendingDone = next;
      return next;
    });

    const nextFormData = buildSelectedDowntimeFormData(updatedRecord);
    setFormData(nextFormData);
    setSymptom(updatedRecord.symptom || "");

    downtimeCache.formData = nextFormData;
    downtimeCache.symptom = updatedRecord.symptom || "";
  }, []);

  const handleUpload = useCallback(async () => {
    const uploadedIds = new Set(pendingDone.map((record) => Number(record.id)));

    setStopLineList((previous) => {
      const next = previous.filter((record) => !uploadedIds.has(Number(record.id)));
      downtimeCache.active = next;
      return next;
    });

    setPendingDone([]);
    downtimeCache.pendingDone = [];

    const clearedForm = createDowntimeFormData();
    setFormData(clearedForm);
    setSymptom("");

    downtimeCache.formData = clearedForm;
    downtimeCache.symptom = "";

    await refreshHistory();
  }, [pendingDone, refreshHistory]);

  const openMarkDone = useCallback((record) => {
    if (record.markedDoneAt) return;

    setActiveRecord(record);
    setFormData(buildSelectedDowntimeFormData(record));
    setSymptom(record.symptom ?? "");
    setMarkDoneOpen(true);
  }, []);

  const stats = getDowntimeStats(stopLineList, pendingDone, maintenanceHistory);

  return {
    activeError,
    activeRecord,
    breachCount: stats.breachCount,
    headerSummary: buildDowntimeHeaderSummary(stats),
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
    historyError,
    historyLoading,
    maintenanceHistory,
    markDoneOpen,
    noDataCount: stats.noDataCount,
    openMarkDone,
    openStartModal: () => setStartOpen(true),
    openUploadModal: () => setUploadOpen(true),
    pageLoading,
    pendingCount: stats.pendingCount,
    pendingDone,
    selectedHistory,
    setSelectedHistory,
    startOpen,
    stats,
    stopLineList,
    symptom,
    uploadOpen,
    uploadedCount: stats.uploadedCount,
  };
}

