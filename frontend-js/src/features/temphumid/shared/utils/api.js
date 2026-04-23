import axios from "@/lib/axios";
import { API_BASE } from "@/utils/floors";

export async function fetchSensorStatusByFloor(floor, options = {}) {
  const response = await axios.get(`${API_BASE}/sensors/status`, {
    params: { floor },
    signal: options.signal,
  });

  return response.data?.data ?? [];
}

export async function fetchBatchSensorLimits(areaIds) {
  const response = await axios.get(`${API_BASE}/sensors/limits/batch-show`, {
    params: { areaIds },
    paramsSerializer: (params) =>
      (params.areaIds ?? []).map((id) => `areaIds[]=${encodeURIComponent(id)}`).join("&"),
  });

  return response.data?.data ?? {};
}

export async function saveBatchSensorLimits(payload) {
  const response = await axios.post(`${API_BASE}/sensors/limits/batch`, payload);
  return response.data?.data ?? null;
}

export async function saveBatchSensorStatuses(payload) {
  const response = await axios.post(`${API_BASE}/sensors/status/batch`, payload);
  return response.data?.data ?? null;
}

export async function fetchFacilitiesAlerts(params = {}, options = {}) {
  const response = await axios.get(`${API_BASE}/facilities/alerts`, {
    params,
    paramsSerializer: Array.isArray(params.status)
      ? (query) =>
          (query.status ?? [])
            .map((status) => `status[]=${encodeURIComponent(status)}`)
            .join("&")
      : undefined,
    signal: options.signal,
  });

  return response.data?.data ?? [];
}

export async function createFacilitiesAlert(payload) {
  const response = await axios.post(`${API_BASE}/facilities/alerts`, payload);
  return response.data?.data ?? null;
}

export async function acknowledgeFacilitiesAlert(alertId) {
  const response = await axios.patch(`${API_BASE}/facilities/alerts/${alertId}/acknowledge`);
  return response.data?.data ?? null;
}

export async function verifyFacilitiesAlert(alertId, payload) {
  const response = await axios.patch(`${API_BASE}/facilities/alerts/${alertId}/verify`, payload);
  return response.data?.data ?? null;
}

export async function scheduleFacilitiesAlert(alertId, payload) {
  const response = await axios.patch(`${API_BASE}/facilities/alerts/${alertId}/schedule`, payload);
  return response.data?.data ?? null;
}

export async function unscheduleFacilitiesAlert(alertId) {
  const response = await axios.patch(`${API_BASE}/facilities/alerts/${alertId}/unschedule`);
  return response.data?.data ?? null;
}

export async function escalateFacilitiesAlert(alertId, payload) {
  const response = await axios.patch(`${API_BASE}/facilities/alerts/${alertId}/escalate`, payload);
  return response.data?.data ?? null;
}

export async function processFacilitiesVerifying() {
  const response = await axios.post(`${API_BASE}/facilities/alerts/process-verifying`);
  return response.data?.data ?? [];
}

export async function processFacilitiesReadings() {
  const response = await axios.post(`${API_BASE}/facilities/alerts/process-readings`);
  return response.data?.data ?? [];
}

export async function fetchFacilitiesBreachEvents(alertId, page = 1) {
  const response = await axios.get(`${API_BASE}/facilities/alerts/${alertId}/breach-events`, {
    params: { page },
  });

  return {
    data: response.data?.data ?? [],
    meta: response.data?.meta ?? null,
  };
}

export async function fetchDowntimeActive(options = {}) {
  const response = await axios.get(`${API_BASE}/downtime/active`, {
    signal: options.signal,
  });
  return response.data?.data ?? [];
}

export async function fetchDowntimeHistory(options = {}) {
  const response = await axios.get(`${API_BASE}/downtime/history`, {
    signal: options.signal,
  });
  return response.data?.data ?? [];
}

export async function validateDowntimeSensorLineName(lineName) {
  const response = await axios.post(`${API_BASE}/downtime/validate-sensor`, {
    line_name: lineName,
  });
  return response.data ?? {};
}

export async function startDowntime(payload) {
  const response = await axios.post(`${API_BASE}/downtime/start`, payload);
  return response.data?.data ?? null;
}

export async function markDowntimeDone(id, payload) {
  const response = await axios.post(`${API_BASE}/downtime/mark-done/${id}`, payload);
  return response.data?.data ?? null;
}

export async function uploadDowntimeRecords(ids) {
  const response = await axios.post(`${API_BASE}/downtime/upload`, { ids });
  return response.data?.data ?? null;
}
