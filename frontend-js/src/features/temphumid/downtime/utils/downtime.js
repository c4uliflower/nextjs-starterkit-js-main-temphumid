import { validateDowntimeSensorLineName } from "@/features/temphumid/shared/utils/api";
import { formatAbsolute, formatTimer } from "@/utils/time";

export const DOWNTIME_REASONS = [
  { id: "offline", label: "Sensor Offline / No Data" },
  { id: "loose-conn", label: "Loose Connection" },
  { id: "hw-damage", label: "Hardware Damage" },
  { id: "calibration", label: "Calibration Drift" },
  { id: "power", label: "Power Issue" },
  { id: "firmware", label: "Firmware / Software Error" },
  { id: "env", label: "Environmental Interference" },
  { id: "other", label: "Other" },
];

export const REASON_SELECT_OPTIONS = [
  { value: "", label: "Select reason..." },
  ...DOWNTIME_REASONS.map((reason) => ({ value: reason.id, label: reason.label })),
];

export const SYMPTOM_LABELS = {
  breach: "Breach",
  no_data: "No Data",
  stable: "Stable",
};

export const SYMPTOM_DOT = {
  Breach: "#dc3545",
  "No Data": "#adb5bd",
  Stable: "#22c55e",
};

export const DOWNTIME_GLOBAL_STYLES = `
  @keyframes dotPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
`;

const EMPTY_FORM_DATA = {
  lineName: "",
  areaId: "",
  technicianId: "",
  reason: "",
  remarks: "",
  duration: "",
  markedDone: "",
};

export const downtimeCache = {
  active: null,
  history: null,
  pendingDone: [],
  formData: { ...EMPTY_FORM_DATA },
  symptom: "",
};

export function createDowntimeFormData(overrides = {}) {
  return {
    ...EMPTY_FORM_DATA,
    ...overrides,
  };
}

export function getDowntimeSymptomLabel(symptom) {
  return SYMPTOM_LABELS[symptom] ?? symptom ?? "";
}

export function getDowntimeSymptomColor(symptom) {
  return SYMPTOM_DOT[getDowntimeSymptomLabel(symptom)] ?? "#adb5bd";
}

export async function parseDowntimeSensorQr(rawValue) {
  let lineName = null;

  try {
    const url = new URL(rawValue);
    lineName = url.searchParams.get("line_name");
  } catch {
    lineName = rawValue;
  }

  if (!lineName?.trim()) {
    return { ok: false, error: "QR code does not contain a valid line name." };
  }

  const decoded = lineName.trim();

  try {
    const result = await validateDowntimeSensorLineName(decoded);

    if (!result.valid) {
      return {
        ok: false,
        error: result.message ?? `"${decoded}" could not be validated.`,
      };
    }

    return { ok: true, sensor: result.sensor };
  } catch (error) {
    const message = error.response?.data?.message;
    return {
      ok: false,
      error: message ?? "Could not reach the server. Please check your connection and try again.",
    };
  }
}

export function parseTechnicianQr(rawValue) {
  const technicianId = rawValue.trim();

  if (!technicianId) {
    return { ok: false, error: "QR code is empty. Please scan your employee ID QR." };
  }

  if (!/^[a-zA-Z0-9-]+$/.test(technicianId)) {
    return {
      ok: false,
      error: "Unrecognized QR format. Please scan your employee ID QR code.",
    };
  }

  return { ok: true, technicianId };
}

export function mapActiveDowntimeRecord(record) {
  return {
    id: Number(record.id),
    areaId: record.area_id,
    lineName: record.line_name,
    technicianId: record.processed_by,
    symptom: record.symptom,
    processedAt: record.processed_at,
    markedDoneAt: record.marked_done_at ?? null,
    uploadedAt: record.uploaded_at ?? null,
    status: record.status ?? "ongoing",
    durationSeconds: record.duration_seconds ?? null,
    reason: record.maintenance_reason ?? "",
    remarks: record.remarks ?? "",
  };
}

export function mapDowntimeHistoryRecord(record) {
  return {
    id: Number(record.id),
    areaId: record.area_id,
    lineName: record.line_name,
    technicianId: record.processed_by,
    symptom: record.symptom,
    reason: record.maintenance_reason,
    remarks: record.remarks,
    processedAt: record.processed_at,
    markedDoneAt: record.marked_done_at,
    markedDoneBy: record.marked_done_by,
    uploadedAt: record.uploaded_at,
    uploadedBy: record.uploaded_by,
    durationSeconds: record.duration_seconds,
    status: record.status,
  };
}

export function isSameDowntimeHistory(previous = [], next = []) {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;

  for (let index = 0; index < previous.length; index += 1) {
    const left = previous[index];
    const right = next[index];

    if (
      left.id !== right.id ||
      left.areaId !== right.areaId ||
      left.lineName !== right.lineName ||
      left.technicianId !== right.technicianId ||
      left.symptom !== right.symptom ||
      left.reason !== right.reason ||
      left.remarks !== right.remarks ||
      left.processedAt !== right.processedAt ||
      left.markedDoneAt !== right.markedDoneAt ||
      left.markedDoneBy !== right.markedDoneBy ||
      left.uploadedAt !== right.uploadedAt ||
      left.uploadedBy !== right.uploadedBy ||
      left.durationSeconds !== right.durationSeconds ||
      left.status !== right.status
    ) {
      return false;
    }
  }

  return true;
}

export function mergeActiveDowntimeRecords(previousRecords, incomingRecords) {
  const previousMap = new Map(previousRecords.map((record) => [Number(record.id), record]));
  const merged = incomingRecords.map(
    (record) => previousMap.get(Number(record.id)) ?? record
  );

  previousRecords.forEach((record) => {
    const alreadyMerged = merged.some((item) => Number(item.id) === Number(record.id));
    if (record.markedDoneAt && !record.uploadedAt && !alreadyMerged) {
      merged.push(record);
    }
  });

  return Array.from(
    new Map(
      merged.map((record) => [
        Number(record.id),
        { ...record, id: Number(record.id) },
      ])
    ).values()
  );
}

export function buildQueuedDowntimeFormData(sensorInfo, technicianId) {
  return createDowntimeFormData({
    lineName: sensorInfo?.lineName ?? "",
    areaId: sensorInfo?.areaId ?? "",
    technicianId: technicianId ?? "",
  });
}

export function buildQueuedDowntimeRecord({
  id,
  processedAt,
  sensorInfo,
  symptomLabel,
  techInfo,
}) {
  return {
    id: Number(id),
    areaId: sensorInfo.areaId,
    lineName: sensorInfo.lineName,
    technicianId: techInfo.technicianId,
    symptom: symptomLabel,
    processedAt,
    markedDoneAt: null,
    uploadedAt: null,
    status: "ongoing",
    durationSeconds: null,
    reason: "",
    remarks: "",
  };
}

export function getDowntimeStats(stopLineList, pendingDone, maintenanceHistory) {
  return {
    activeCount: stopLineList.length,
    breachCount: maintenanceHistory.filter((record) => record.symptom === "Breach").length,
    noDataCount: maintenanceHistory.filter((record) => record.symptom === "No Data").length,
    pendingCount: pendingDone.length,
    uploadedCount: maintenanceHistory.length,
  };
}

export function buildDowntimeHeaderSummary(stats) {
  return `${stats.activeCount} Active \u00B7 ${stats.pendingCount} Pending Upload \u00B7 ${stats.uploadedCount} Uploaded`;
}

export function buildSelectedDowntimeFormData(record) {
  return createDowntimeFormData({
    lineName: record?.lineName ?? "",
    areaId: record?.areaId ?? "",
    technicianId: record?.technicianId ?? "",
    reason: record?.reason ?? "",
    remarks: record?.remarks ?? "",
    duration:
      record?.durationSeconds != null ? formatTimer(record.durationSeconds) : "",
    markedDone: record?.markedDoneAt ? formatAbsolute(record.markedDoneAt) : "",
  });
}

