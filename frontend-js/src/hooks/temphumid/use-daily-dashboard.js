"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import axios from "@/lib/axios";
import {
  DAILY_SENSOR_MAP,
  DAILY_FLOOR_SLUGS,
  DAILY_SENSOR_LOCATION_MAP,
  DAILY_CHART_COLORS,
  DAILY_LIMIT_UL_COLOR,
  DAILY_LIMIT_LL_COLOR,
  getDefault24hRange,
  toISODate,
  avg,
  formatDailyLabel,
  formatDailyExcelDatetime,
  filterSundays,
  buildDailyDatasets,
  buildMonthlyDatasets,
  buildDailyHintText,
  buildDailyChartSubtitle,
  exportDailyReadingsToExcel,
} from "@/utils/daily";

const API_BASE = "/api/temphumid";

// Module-level caches — persist across navigations
let summaryCache = null;
let statusCache = {};

export function useDailyDashboard() {
  const [summaryLoading, setSummaryLoading] = useState(!summaryCache);
  const [statusReady, setStatusReady] = useState(Object.keys(statusCache).length > 0);

  // Filter state
  const [selLocationValues, setSelLocationValues] = useState([]);
  const [selSensorValues, setSelSensorValues] = useState([]);
  const [range, setRange] = useState(getDefault24hRange());

  // Chart state
  const [labels, setLabels] = useState([]);
  const [tempDS, setTempDS] = useState([]);
  const [humidDS, setHumidDS] = useState([]);
  const [limitProfiles, setLimitProfiles] = useState([]);
  const [chartKey, setChartKey] = useState(0);
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [noData, setNoData] = useState(false);
  const [resolution, setResolution] = useState("raw");

  // View state
  const [chartView, setChartView] = useState("daily");
  const [includeSundays, setIncludeSundays] = useState(true);
  const [chartReady, setChartReady] = useState(
    typeof window !== "undefined" && !!window.Chart
  );
  const [exporting, setExporting] = useState(false);

  // Refs
  const rawDataRef = useRef(null);
  const allTimesRef = useRef(null);

  // Load Chart.js
  useEffect(() => {
    if (window.Chart) {
      setChartReady(true);
      return;
    }
    const load = (src) =>
      new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
    (async () => {
      try {
        await load(
          "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"
        );
        await load(
          "https://cdnjs.cloudflare.com/ajax/libs/hammer.js/2.0.8/hammer.min.js"
        );
        await load(
          "https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-zoom/2.0.1/chartjs-plugin-zoom.min.js"
        );
        setChartReady(true);
      } catch (err) {
        console.error("Failed to load Chart.js:", err);
      }
    })();
  }, []);

  // Fetch sensor statuses once on mount
  useEffect(() => {
    if (Object.keys(statusCache).length > 0) return;
    Promise.all(
      DAILY_FLOOR_SLUGS.map((slug) =>
        axios
          .get(`${API_BASE}/sensors/status`, { params: { floor: slug } })
          .then((res) => res.data.data)
          .catch(() => [])
      )
    ).then((results) => {
      results.flat().forEach((d) => {
        statusCache[d.areaId] = d.status;
      });
      setStatusReady(true);
    });
  }, []);

  // Derived selections
  const ALL_SENSORS = Object.values(DAILY_SENSOR_MAP)
    .flat()
    .filter((s) => statusCache[s.id] !== "Inactive");

  const ALL_LOCATIONS = Object.keys(DAILY_SENSOR_MAP).filter((loc) =>
    DAILY_SENSOR_MAP[loc].some((s) => statusCache[s.id] !== "Inactive")
  );

  const selSensors = ALL_SENSORS.filter((s) =>
    selSensorValues.includes(s.id)
  );
  const selLocations = selLocationValues;

  const sensorOptionsList =
    selLocationValues.length > 0
      ? selLocationValues
          .flatMap((loc) => DAILY_SENSOR_MAP[loc] ?? [])
          .filter((s) => statusCache[s.id] !== "Inactive")
      : ALL_SENSORS;

  const locationOptionsList =
    selSensorValues.length > 0
      ? ALL_LOCATIONS.filter((loc) =>
          selSensorValues.some((id) => DAILY_SENSOR_LOCATION_MAP[id] === loc)
        )
      : ALL_LOCATIONS;

  const sensorsToFetch =
    selSensors.length > 0
      ? selSensors
      : selLocations
          .flatMap((loc) => DAILY_SENSOR_MAP[loc] ?? [])
          .filter((s) => statusCache[s.id] !== "Inactive");

  const canApply = sensorsToFetch.length > 0 && range?.from && range?.to;

  // Filter handlers
  const handleLocationChange = (newLocValues) => {
    setSelLocationValues(newLocValues);
    if (newLocValues.length > 0) {
      const validIds = newLocValues
        .flatMap((loc) => DAILY_SENSOR_MAP[loc] ?? [])
        .map((s) => s.id);
      setSelSensorValues((prev) =>
        prev.filter((id) => validIds.includes(id))
      );
    }
    setApplied(false);
    setApiError(null);
    setNoData(false);
  };

  const handleSensorChange = (newSensorIds) => {
    setSelSensorValues(newSensorIds);
    if (newSensorIds.length > 0) {
      const relevantLocs = [
        ...new Set(newSensorIds.map((id) => DAILY_SENSOR_LOCATION_MAP[id])),
      ];
      setSelLocationValues((prev) =>
        prev.length === 0 ? prev : prev.filter((loc) => relevantLocs.includes(loc))
      );
    }
    setApplied(false);
    setApiError(null);
    setNoData(false);
  };

  const handleRangeChange = (newRange) => {
    setRange(newRange ?? getDefault24hRange());
    setApplied(false);
    setApiError(null);
    setNoData(false);
  };

  // View toggle handler
  const handleViewToggle = (view) => {
    if (view === chartView || !rawDataRef.current) return;
    const { labels: l, tempDS: t, humidDS: h } =
      view === "monthly"
        ? buildMonthlyDatasets(rawDataRef.current)
        : buildDailyDatasets(rawDataRef.current, resolution);
    setLabels(l);
    setTempDS(t);
    setHumidDS(h);
    setChartView(view);
    setChartKey((k) => k + 1);
  };

  // Sunday toggle handler
  const handleSundayToggle = (e) => {
    const checked = e.target.checked;
    setIncludeSundays(checked);

    if (!allTimesRef.current || !rawDataRef.current) return;

    const filteredTimes = filterSundays(allTimesRef.current, checked);
    const updatedData = { ...rawDataRef.current, sortedTimes: filteredTimes };
    rawDataRef.current = updatedData;

    const { labels: l, tempDS: t, humidDS: h } =
      chartView === "monthly"
        ? buildMonthlyDatasets(updatedData)
        : buildDailyDatasets(updatedData, resolution);

    setLabels(l);
    setTempDS(t);
    setHumidDS(h);
    setChartKey((k) => k + 1);
  };

  // Export handler
  const handleExport = async () => {
    if (!rawDataRef.current || !applied) return;
    setExporting(true);
    try {
      await exportDailyReadingsToExcel({
        rawData: rawDataRef.current,
        limitProfiles,
        rangeFrom: range.from,
        rangeTo: range.to,
      });
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  // Apply handler
  const handleApply = async () => {
    if (!canApply) return;
    setLoading(true);
    setApiError(null);
    setNoData(false);

    try {
      const areaIds = sensorsToFetch.map((s) => s.id);
      const from = toISODate(range.from);
      const to = toISODate(range.to);

      const res = await axios.get(
        `${API_BASE}/sensors/readings/history/batch`,
        {
          params: { areaIds, from, to },
          paramsSerializer: (params) => {
            const parts = [];
            (params.areaIds ?? []).forEach((id) => {
              parts.push(`areaIds[]=${encodeURIComponent(id)}`);
            });
            parts.push(`from=${params.from}`);
            parts.push(`to=${params.to}`);
            return parts.join("&");
          },
        }
      );

      const batchData = res.data.data;
      const serverRes = res.data.meta?.resolution ?? "raw";

      const allTimes = new Set();
      Object.values(batchData).forEach(({ readings }) => {
        readings.forEach((r) => allTimes.add(r.dayTime));
      });

      const allSorted = [...allTimes].sort();
      allTimesRef.current = allSorted;

      const sortedTimes = filterSundays(allSorted, includeSundays);

      if (sortedTimes.length === 0) {
        setNoData(true);
        setApplied(true);
        setLoading(false);
        return;
      }

      const perSensor = [];
      sensorsToFetch.forEach((sensor, i) => {
        const entry = batchData[sensor.id];
        if (!entry) return;
        const readingMap = {};
        entry.readings.forEach((r) => {
          readingMap[r.dayTime] = r;
        });
        perSensor.push({
          readingMap,
          color: DAILY_CHART_COLORS[i % DAILY_CHART_COLORS.length],
          label: entry.lineName || sensor.name,
        });
      });

      const locationLimitMap = {};
      sensorsToFetch.forEach((sensor) => {
        const entry = batchData[sensor.id];
        if (!entry?.limits) return;
        const loc = DAILY_SENSOR_LOCATION_MAP[sensor.id];
        if (!locationLimitMap[loc]) {
          locationLimitMap[loc] = { ...entry.limits, location: loc };
        } else {
          locationLimitMap[loc].tempUL = Math.max(
            locationLimitMap[loc].tempUL,
            entry.limits.tempUL
          );
          locationLimitMap[loc].tempLL = Math.min(
            locationLimitMap[loc].tempLL,
            entry.limits.tempLL
          );
          locationLimitMap[loc].humidUL = Math.max(
            locationLimitMap[loc].humidUL,
            entry.limits.humidUL
          );
          locationLimitMap[loc].humidLL = Math.min(
            locationLimitMap[loc].humidLL,
            entry.limits.humidLL
          );
        }
      });

      rawDataRef.current = { sortedTimes, perSensor };

      const { labels: l, tempDS: t, humidDS: h } = buildDailyDatasets(
        rawDataRef.current,
        serverRes
      );
      setResolution(serverRes);
      setLimitProfiles(Object.values(locationLimitMap));
      setLabels(l);
      setTempDS(t);
      setHumidDS(h);
      setChartView("daily");
      setChartKey((k) => k + 1);
      setApplied(true);
    } catch (err) {
      console.error("Failed to fetch batch history:", err);
      setApiError(
        err.response?.data?.message ??
          "Failed to fetch sensor data. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Clear handler
  const handleClear = () => {
    setSelLocationValues([]);
    setSelSensorValues([]);
    setRange(getDefault24hRange());
    setTempDS([]);
    setHumidDS([]);
    setLabels([]);
    setLimitProfiles([]);
    setApplied(false);
    setApiError(null);
    setNoData(false);
    setChartView("daily");
    setResolution("raw");
    setIncludeSundays(false);
    rawDataRef.current = null;
    allTimesRef.current = null;
  };

  // Computed hint text
  const hintText = buildDailyHintText(
    selSensors,
    selLocations,
    sensorsToFetch
  );

  // Computed chart subtitle
  const chartSubtitle = (metric) =>
    buildDailyChartSubtitle(chartView, resolution, metric);

  return {
    // State
    apiError,
    applied,
    canApply,
    chartKey,
    chartReady,
    chartSubtitle,
    chartView,
    exporting,
    hintText,
    humidDS,
    includeSundays,
    labels,
    limitProfiles,
    loading,
    locationOptionsList,
    noData,
    range,
    rawDataRef,
    selLocationValues,
    selSensorValues,
    sensorOptionsList,
    tempDS,

    // Handlers
    handleApply,
    handleClear,
    handleLocationChange,
    handleRangeChange,
    handleSensorChange,
    handleSundayToggle,
    handleViewToggle,

    // Setters
    setExporting,
  };
}
