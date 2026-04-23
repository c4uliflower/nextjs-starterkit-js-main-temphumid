"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { FLOORS } from "@/utils/floors";
import { ALL_SENSORS, DEFAULT_LIMITS } from "@/features/temphumid/sensor-limits/utils/sensors";
import {
  fetchBatchSensorLimits,
  fetchSensorStatusByFloor,
  saveBatchSensorLimits,
} from "@/features/temphumid/shared/utils/api";
import { sharedStatusCache } from "@/features/temphumid/sensor-status/hooks/use-sensor-status-manager";

// Copied from the current temp/humid limits route page as an additive scaffold.

let limitsCache = {};

export function useSensorLimitsManager() {
  const [draft, setDraft] = useState({});
  const [original, setOriginal] = useState({});
  const [errors, setErrors] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading] = useState(Object.keys(limitsCache).length === 0);
  const [sensorStatuses, setSensorStatuses] = useState(() => ({ ...sharedStatusCache }));
  const [openFloor, setOpenFloor] = useState("p1f1");
  const originalRef = useRef({});

  useEffect(() => {
    const fetchAll = async () => {
      if (Object.keys(limitsCache).length > 0) {
        const restored = JSON.parse(JSON.stringify(limitsCache));
        originalRef.current = JSON.parse(JSON.stringify(limitsCache));
        setOriginal(restored);
        setDraft(JSON.parse(JSON.stringify(limitsCache)));
        setActiveId((previous) => previous ?? ALL_SENSORS[0]?.id ?? null);
        setLoading(false);
        return;
      }

      try {
        const byAreaId = await fetchBatchSensorLimits(
          ALL_SENSORS.map((sensor) => sensor.areaId)
        );
        const fetched = Object.fromEntries(
          ALL_SENSORS.map((sensor) => [
            sensor.id,
            byAreaId[sensor.areaId] ?? { ...DEFAULT_LIMITS },
          ])
        );

        limitsCache = JSON.parse(JSON.stringify(fetched));
        originalRef.current = JSON.parse(JSON.stringify(fetched));
        setOriginal(JSON.parse(JSON.stringify(fetched)));
        setDraft(JSON.parse(JSON.stringify(fetched)));
        setActiveId(ALL_SENSORS[0]?.id ?? null);
      } catch (error) {
        const fallback = Object.fromEntries(
          ALL_SENSORS.map((sensor) => [sensor.id, { ...DEFAULT_LIMITS }])
        );
        limitsCache = JSON.parse(JSON.stringify(fallback));
        originalRef.current = JSON.parse(JSON.stringify(fallback));
        setOriginal(JSON.parse(JSON.stringify(fallback)));
        setDraft(JSON.parse(JSON.stringify(fallback)));
        setActiveId(ALL_SENSORS[0]?.id ?? null);
        console.error("SensorLimitsView: failed to fetch limits", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  useEffect(() => {
    Promise.allSettled(
      FLOORS.map((floor) => fetchSensorStatusByFloor(floor.slug))
    )
      .then((results) => {
        const byAreaId = {};
        results.forEach((result) => {
          if (result.status === "fulfilled") {
            result.value.forEach((sensor) => {
              byAreaId[sensor.areaId] = sensor.status;
            });
          }
        });
        setSensorStatuses(byAreaId);
      })
      .catch((error) => {
        console.error("SensorLimitsView: failed to fetch statuses", error);
      });
  }, []);

  const handleSetField = (sensorId, key, value) => {
    setDraft((previous) => ({
      ...previous,
      [sensorId]: { ...previous[sensorId], [key]: value },
    }));
    setErrors((previous) => {
      const next = { ...previous };
      delete next[`${sensorId}.${key}`];
      return next;
    });
    setApiError(null);
  };

  const handleApplyToGroup = (activeSensor, groupSensors) => {
    const source = draft[activeSensor.id];

    setDraft((previous) => {
      const next = { ...previous };
      groupSensors.forEach(({ id }) => {
        next[id] = { ...source };
      });
      return next;
    });

    setErrors((previous) => {
      const next = { ...previous };
      groupSensors.forEach(({ id }) => {
        ["tempUL", "tempLL", "humidUL", "humidLL"].forEach((key) => {
          delete next[`${id}.${key}`];
        });
      });
      return next;
    });
  };

  const validate = () => {
    const nextErrors = {};
    const parsed = {};

    for (const { id } of ALL_SENSORS) {
      const row = draft[id];
      parsed[id] = {};

      for (const key of ["tempUL", "tempLL", "humidUL", "humidLL"]) {
        const num = parseFloat(row?.[key]);
        if (Number.isNaN(num)) {
          nextErrors[`${id}.${key}`] = "Required";
          continue;
        }
        parsed[id][key] = num;
      }

      if (
        !nextErrors[`${id}.tempLL`] &&
        !nextErrors[`${id}.tempUL`] &&
        parsed[id].tempLL >= parsed[id].tempUL
      ) {
        nextErrors[`${id}.tempLL`] = "LL must be < UL";
      }
      if (
        !nextErrors[`${id}.humidLL`] &&
        !nextErrors[`${id}.humidUL`] &&
        parsed[id].humidLL >= parsed[id].humidUL
      ) {
        nextErrors[`${id}.humidLL`] = "LL must be < UL";
      }
    }

    return { errors: nextErrors, parsed };
  };

  const getChangedIds = (parsed) =>
    Object.keys(parsed).filter((id) => {
      const orig = originalRef.current[id];
      const curr = parsed[id];
      if (!orig || !curr) return false;
      return ["tempUL", "tempLL", "humidUL", "humidLL"].some(
        (key) => parseFloat(orig[key]) !== parseFloat(curr[key])
      );
    });

  const isChanged = (id) => {
    const orig = original[id];
    const curr = draft[id];
    if (!orig || !curr) return false;
    return ["tempUL", "tempLL", "humidUL", "humidLL"].some(
      (key) => parseFloat(orig[key]) !== parseFloat(curr[key])
    );
  };

  const hasRowError = (id) =>
    ["tempUL", "tempLL", "humidUL", "humidLL"].some(
      (key) => errors[`${id}.${key}`]
    );

  const handleSave = async () => {
    const { errors: nextErrors, parsed } = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const changed = getChangedIds(parsed);
    if (changed.length === 0) return;

    setSaving(true);
    setApiError(null);

    try {
      const payload = {
        sensors: changed.map((id) => {
          const sensor = ALL_SENSORS.find((item) => item.id === id);
          return { areaId: sensor.areaId, ...parsed[id] };
        }),
      };

      await saveBatchSensorLimits(payload);

      const updatedOriginal = { ...originalRef.current };
      changed.forEach((id) => {
        updatedOriginal[id] = { ...parsed[id] };
        limitsCache[id] = { ...parsed[id] };
      });

      originalRef.current = updatedOriginal;
      setOriginal(JSON.parse(JSON.stringify(updatedOriginal)));
    } catch (error) {
      setApiError(error.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraft(JSON.parse(JSON.stringify(original)));
    setErrors({});
    setApiError(null);
  };

  const changedCount = ALL_SENSORS.filter((sensor) => isChanged(sensor.id)).length;
  const errorCount = ALL_SENSORS.filter((sensor) => hasRowError(sensor.id)).length;
  const hasChanges = changedCount > 0;

  const sensorsByFloor = useMemo(
    () =>
      FLOORS.map((floor) => ({
        floor,
        groups: (() => {
          const floorSensors = ALL_SENSORS.filter(
            (sensor) => sensor.floorSlug === floor.slug
          );
          const groupNames = [...new Set(floorSensors.map((sensor) => sensor.group))];
          return groupNames.map((group) => ({
            group,
            sensors: floorSensors.filter((sensor) => sensor.group === group),
          }));
        })(),
      })).filter(({ groups }) => groups.some((group) => group.sensors.length > 0)),
    []
  );

  const activeSensor = ALL_SENSORS.find((sensor) => sensor.id === activeId) ?? null;

  return {
    activeId,
    activeSensor,
    apiError,
    changedCount,
    draft,
    errorCount,
    errors,
    handleApplyToGroup,
    handleDiscard,
    handleSave,
    handleSetField,
    hasChanges,
    hasRowError,
    isChanged,
    loading,
    openFloor,
    saving,
    sensorStatuses,
    sensorsByFloor,
    setActiveId,
    setOpenFloor,
  };
}



