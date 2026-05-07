"use client";

import { useEffect, useState } from "react";

import { FLOORS, P1F1_EXCLUDED_AREA_IDS, WH_AREA_IDS } from "@/utils/floors";
import {
  fetchSensorStatusByFloor,
  saveBatchSensorStatuses,
} from "@/features/temphumid/shared/utils/api";

// Copied from the current temp/humid status route page as an additive scaffold.

let statusCacheByFloor = {};
export let sharedStatusCache = {};

export function useSensorStatusManager() {
  const [sensors, setSensors] = useState({});
  const [original, setOriginal] = useState({});
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState({});
  const [apiError, setApiError] = useState({});
  const [loading, setLoading] = useState(Object.keys(statusCacheByFloor).length === 0);
  const [openFloors, setOpenFloors] = useState(FLOORS.map((floor) => floor.slug));

  useEffect(() => {
    const fetchAll = async () => {
      if (Object.keys(statusCacheByFloor).length > 0) {
        const cachedOriginal = {};
        const cachedDraft = {};

        for (const floor of FLOORS) {
          const floorSensors = statusCacheByFloor[floor.slug] ?? [];
          const byAreaId = Object.fromEntries(
            floorSensors.map((sensor) => [sensor.areaId, sensor.status])
          );
          cachedOriginal[floor.slug] = byAreaId;
          cachedDraft[floor.slug] = { ...byAreaId };
        }

        setSensors({ ...statusCacheByFloor });
        setOriginal(cachedOriginal);
        setDraft(cachedDraft);
        setLoading(false);
        return;
      }

      try {
        const results = await Promise.allSettled(
          FLOORS.map((floor) =>
            fetchSensorStatusByFloor(floor.slug).then((data) => ({
              slug: floor.slug,
              data,
            }))
          )
        );

        const newSensors = {};
        const newOriginal = {};
        const newDraft = {};

        for (const result of results) {
          if (result.status !== "fulfilled") continue;

          const { slug, data } = result.value;
          const filtered =
            slug === "p2f1"
              ? data.filter((sensor) => !WH_AREA_IDS.has(sensor.areaId))
              : slug === "p1f1"
                ? data.filter((sensor) => !P1F1_EXCLUDED_AREA_IDS.has(sensor.areaId))
                : data;

          const byAreaId = Object.fromEntries(
            filtered.map((sensor) => [sensor.areaId, sensor.status])
          );

          newSensors[slug] = filtered;
          newOriginal[slug] = byAreaId;
          newDraft[slug] = { ...byAreaId };

          for (const [areaId, status] of Object.entries(byAreaId)) {
            sharedStatusCache[areaId] = status;
          }
        }

        statusCacheByFloor = newSensors;
        setSensors(newSensors);
        setOriginal(newOriginal);
        setDraft(newDraft);
      } catch (error) {
        console.error("SensorStatusView: failed to fetch statuses", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const handleToggle = (floorSlug, areaId) => {
    if (saving[floorSlug]) return;

    setDraft((previous) => ({
      ...previous,
      [floorSlug]: {
        ...previous[floorSlug],
        [areaId]:
          previous[floorSlug]?.[areaId] === "Active" ? "Inactive" : "Active",
      },
    }));
    setApiError((previous) => ({ ...previous, [floorSlug]: null }));
  };

  const handleSave = async (floorSlug, changedIds) => {
    if (!changedIds.length) return;

    setSaving((previous) => ({ ...previous, [floorSlug]: true }));
    setApiError((previous) => ({ ...previous, [floorSlug]: null }));

    try {
      const payload = {
        sensors: changedIds.map((areaId) => ({
          areaId,
          status: draft[floorSlug][areaId],
        })),
      };

      await saveBatchSensorStatuses(payload);

      setOriginal((previous) => ({
        ...previous,
        [floorSlug]: {
          ...previous[floorSlug],
          ...Object.fromEntries(
            changedIds.map((id) => [id, draft[floorSlug][id]])
          ),
        },
      }));

      setSensors((previous) => ({
        ...previous,
        [floorSlug]: (previous[floorSlug] ?? []).map((sensor) =>
          changedIds.includes(sensor.areaId)
            ? { ...sensor, status: draft[floorSlug][sensor.areaId] }
            : sensor
        ),
      }));

      if (statusCacheByFloor[floorSlug]) {
        statusCacheByFloor[floorSlug] = statusCacheByFloor[floorSlug].map((sensor) =>
          changedIds.includes(sensor.areaId)
            ? { ...sensor, status: draft[floorSlug][sensor.areaId] }
            : sensor
        );
      }

      for (const areaId of changedIds) {
        sharedStatusCache[areaId] = draft[floorSlug][areaId];
      }
    } catch (error) {
      setApiError((previous) => ({
        ...previous,
        [floorSlug]: error.message ?? "Something went wrong. Please try again.",
      }));
    } finally {
      setSaving((previous) => ({ ...previous, [floorSlug]: false }));
    }
  };

  const allDraftEntries = Object.values(draft).flatMap((byAreaId) =>
    Object.values(byAreaId)
  );
  const totalCount = allDraftEntries.length;
  const totalActive = allDraftEntries.filter((status) => status === "Active").length;
  const totalInactive = totalCount - totalActive;
  const hasAnyUnsaved = FLOORS.some((floor) =>
    Object.keys(draft[floor.slug] ?? {}).some(
      (areaId) => draft[floor.slug][areaId] !== original[floor.slug]?.[areaId]
    )
  );

  return {
    apiError,
    draft,
    handleSave,
    handleToggle,
    hasAnyUnsaved,
    loading,
    openFloors,
    original,
    saving,
    sensors,
    setOpenFloors,
    totalActive,
    totalCount,
    totalInactive,
  };
}

