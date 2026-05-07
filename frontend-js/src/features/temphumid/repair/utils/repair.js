import { validateRepairAcuQr } from "@/features/temphumid/shared/utils/api";
import { formatAbsolute, formatTimer } from "@/utils/time";

export const REPAIR_REASONS = [
  { id: "cooling", label: "Cooling Issue" },
  { id: "leak", label: "Water Leak" },
  { id: "noise", label: "Abnormal Noise" },
  { id: "power", label: "Power Issue" },
  { id: "filter", label: "Filter / Airflow Issue" },
  { id: "thermostat", label: "Thermostat / Control Issue" },
  { id: "other", label: "Other" },
];

export const REPAIR_REASON_OPTIONS = [
  { value: "", label: "Select reason..." },
  ...REPAIR_REASONS.map((reason) => ({ value: reason.id, label: reason.label })),
];

export const REPAIR_STATUS_DOT = {
  Active: "#16a34a",
  Inactive: "#64748b",
};

export const REPAIR_GLOBAL_STYLES = `
  @keyframes dotPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }
`;

const EMPTY_FORM_DATA = {
  machineId: "",
  machineQr: "",
  location: "",
  description: "",
  status: "",
  technicianId: "",
  reason: "",
  remarks: "",
  duration: "",
  markedDone: "",
};

export const repairCache = {
  active: null,
  history: null,
  pendingDone: [],
  formData: { ...EMPTY_FORM_DATA },
  acuStatus: "",
};

export function createRepairFormData(overrides = {}) {
  return {
    ...EMPTY_FORM_DATA,
    ...overrides,
  };
}

export function getRepairStatusColor(status) {
  return REPAIR_STATUS_DOT[status] ?? "#64748b";
}

export async function parseRepairAcuQr(rawValue) {
  let machineQr = null;

  try {
    const url = new URL(rawValue);
    machineQr =
      url.searchParams.get("machine_qr") ??
      url.searchParams.get("MACHINE_QR") ??
      url.searchParams.get("machine_id") ??
      url.searchParams.get("MACHINE_ID") ??
      url.searchParams.get("id");
  } catch {
    machineQr = rawValue;
  }

  if (!machineQr?.trim()) {
    return { ok: false, error: "QR code does not contain a valid ACU reference." };
  }

  const decoded = machineQr.trim();

  try {
    const result = await validateRepairAcuQr(decoded);

    if (!result.valid) {
      return {
        ok: false,
        error: result.message ?? `"${decoded}" could not be validated.`,
      };
    }

    return { ok: true, acu: result.acu };
  } catch (error) {
    const message = error.response?.data?.message;
    return {
      ok: false,
      error: message ?? "Could not reach the server. Please check your connection and try again.",
    };
  }
}

export function parseRepairTechnicianQr(rawValue) {
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

export function mapActiveRepairRecord(record) {
  return {
    id: Number(record.id),
    machineId: record.machine_id,
    machineQr: record.machine_qr,
    sourceAlertId: record.source_alert_id ?? null,
    categoryName: record.category_name,
    location: record.location,
    description: record.description,
    acuStatus: record.acu_status,
    technicianId: record.processed_by,
    reason: record.repair_reason ?? "",
    remarks: record.remarks ?? "",
    processedAt: record.processed_at,
    markedDoneAt: record.marked_done_at ?? null,
    uploadedAt: record.uploaded_at ?? null,
    durationSeconds: record.duration_seconds ?? null,
    status: record.status ?? "ongoing",
  };
}

export function mapRepairHistoryRecord(record) {
  return {
    ...mapActiveRepairRecord(record),
    markedDoneBy: record.marked_done_by,
    uploadedBy: record.uploaded_by,
  };
}

export function isSameRepairHistory(previous = [], next = []) {
  if (previous === next) return true;
  if (previous.length !== next.length) return false;

  for (let index = 0; index < previous.length; index += 1) {
    const left = previous[index];
    const right = next[index];

    if (
      left.id !== right.id ||
      left.machineId !== right.machineId ||
      left.machineQr !== right.machineQr ||
      left.sourceAlertId !== right.sourceAlertId ||
      left.location !== right.location ||
      left.acuStatus !== right.acuStatus ||
      left.technicianId !== right.technicianId ||
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

export function mergeActiveRepairRecords(previousRecords, incomingRecords) {
  const previousMap = new Map(previousRecords.map((record) => [Number(record.id), record]));
  const merged = incomingRecords.map((record) => previousMap.get(Number(record.id)) ?? record);

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

export function buildQueuedRepairFormData(acuInfo, technicianId) {
  return createRepairFormData({
    machineId: acuInfo?.machineId ?? "",
    machineQr: acuInfo?.machineQr ?? "",
    location: acuInfo?.location ?? "",
    description: acuInfo?.description ?? "",
    status: acuInfo?.status ?? "",
    technicianId: technicianId ?? "",
  });
}

export function buildQueuedRepairRecord({ id, processedAt, acuInfo, techInfo }) {
  return {
    id: Number(id),
    machineId: acuInfo.machineId,
    machineQr: acuInfo.machineQr,
    sourceAlertId: acuInfo.sourceAlertId ?? null,
    categoryName: acuInfo.categoryName,
    location: acuInfo.location,
    description: acuInfo.description,
    acuStatus: acuInfo.status,
    technicianId: techInfo.technicianId,
    processedAt,
    markedDoneAt: null,
    uploadedAt: null,
    status: "ongoing",
    durationSeconds: null,
    reason: "",
    remarks: "",
  };
}

export function buildSelectedRepairFormData(record) {
  return createRepairFormData({
    machineId: record?.machineId ?? "",
    machineQr: record?.machineQr ?? "",
    location: record?.location ?? "",
    description: record?.description ?? "",
    status: record?.acuStatus ?? "",
    technicianId: record?.technicianId ?? "",
    reason: record?.reason ?? "",
    remarks: record?.remarks ?? "",
    duration: record?.durationSeconds != null ? formatTimer(record.durationSeconds) : "",
    markedDone: record?.markedDoneAt ? formatAbsolute(record.markedDoneAt) : "",
  });
}

export function getRepairStats(activeRecords, pendingDone, repairHistory) {
  return {
    activeCount: activeRecords.length,
    pendingCount: pendingDone.length,
    uploadedCount: repairHistory.length,
  };
}

export function buildRepairHeaderSummary(stats) {
  return `${stats.activeCount} Active \u00B7 ${stats.pendingCount} Pending Upload \u00B7 ${stats.uploadedCount} Uploaded`;
}
