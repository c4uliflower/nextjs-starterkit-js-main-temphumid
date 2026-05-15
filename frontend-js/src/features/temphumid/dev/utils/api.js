import axios from "@/lib/axios";
import { API_BASE } from "@/utils/floors";

export async function simulateDevSensorReading(payload) {
  const response = await axios.post(`${API_BASE}/dev/simulate-reading`, {
    processAlerts: true,
    ...payload,
  });

  return response.data?.data ?? null;
}
