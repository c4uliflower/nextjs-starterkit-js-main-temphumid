import axios from "@/lib/axios";
import { API_BASE } from "@/utils/floors";

export async function fetchSensorStatusByFloor(floor, options = {}) {
  const response = await axios.get(`${API_BASE}/sensors/status`, {
    params: { floor },
    signal: options.signal,
  });

  return response.data?.data ?? [];
}

export async function fetchDashboardSummary(options = {}) {
  const response = await axios.get(`${API_BASE}/dashboard/summary`, {
    signal: options.signal,
  });

  return response.data?.data ?? null;
}

export async function fetchCurrentReadingsByFloor(floor, options = {}) {
  const response = await axios.get(`${API_BASE}/sensors/readings/current`, {
    params: { floor },
    signal: options.signal,
  });

  return response.data?.data ?? [];
}

export async function fetchBatchSensorHistory(areaIds, from, to, options = {}) {
  const response = await axios.get(`${API_BASE}/sensors/readings/history/batch`, {
    params: { areaIds, from, to },
    paramsSerializer: (params) => {
      const parts = [];
      (params.areaIds ?? []).forEach((id) => {
        parts.push(`areaIds[]=${encodeURIComponent(id)}`);
      });
      parts.push(`from=${encodeURIComponent(params.from)}`);
      parts.push(`to=${encodeURIComponent(params.to)}`);
      return parts.join("&");
    },
    signal: options.signal,
  });

  return {
    data: response.data?.data ?? {},
    meta: response.data?.meta ?? {},
  };
}
