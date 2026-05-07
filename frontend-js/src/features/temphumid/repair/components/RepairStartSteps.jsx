import { Button } from "@/components/ui/button";

import {
  RepairConfirmedChip,
} from "@/features/temphumid/repair/components/RepairAtoms";
import { DowntimeQrScanner } from "@/features/temphumid/downtime/components/DowntimeQrScanner";
import { getRepairStatusColor } from "@/features/temphumid/repair/utils/repair";

export function RepairAcuScanStep({ onError, onScan, saving, scanError }) {
  return (
    <>
      <DowntimeQrScanner
        label="Point camera at the QR code on the ACU or machine label."
        onScan={onScan}
        onError={onError}
      />
      {saving && <p className="text-center text-sm text-muted-foreground">Validating ACU...</p>}
      {scanError && (
        <p className="text-sm text-destructive" style={{ marginTop: 4 }}>
          {scanError}
        </p>
      )}
    </>
  );
}

export function RepairTechnicianScanStep({
  acuInfo,
  onBack,
  onClearAcu,
  onError,
  onScan,
  scanError,
}) {
  return (
    <>
      <RepairConfirmedChip
        label={acuInfo.machineId}
        sub={`${acuInfo.location || "No location"} \u00B7 ${acuInfo.machineQr}`}
        color="#fff"
        bg="#0f766e"
        onClear={onClearAcu}
      />
      <DowntimeQrScanner
        label="Scan the QR on your employee ID."
        onScan={onScan}
        onError={onError}
      />
      {scanError && <p className="text-sm text-destructive">{scanError}</p>}
      <Button
        type="button"
        size="default"
        variant="outline"
        className="w-full"
        style={{ cursor: "pointer" }}
        onClick={onBack}
      >
        Back
      </Button>
    </>
  );
}

export function RepairConfirmStartStep({
  acuInfo,
  apiError,
  onBack,
  onClearAcu,
  onClearTech,
  onConfirm,
  saving,
  techInfo,
}) {
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <RepairConfirmedChip
          label={acuInfo.machineId}
          sub={`${acuInfo.location || "No location"} \u00B7 ${acuInfo.description || "-"}`}
          color="#fff"
          bg="#0f766e"
          onClear={onClearAcu}
        />
        <RepairConfirmedChip
          label={`Operator ID: ${techInfo.technicianId}`}
          color="#fff"
          bg="#0f766e"
          onClear={onClearTech}
        />
        <RepairConfirmedChip
          label={`Status: ${acuInfo.status}`}
          color="#fff"
          bg={getRepairStatusColor(acuInfo.status)}
        />
      </div>
      {apiError && <p className="text-sm text-destructive">{apiError}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          type="button"
          size="default"
          variant="outline"
          className="flex-1"
          style={{ cursor: "pointer" }}
          onClick={onBack}
          disabled={saving}
        >
          Back
        </Button>
        <Button
          type="button"
          size="default"
          variant="default"
          className="flex-1"
          style={{ cursor: "pointer" }}
          onClick={onConfirm}
          disabled={saving}
        >
          {saving ? "Starting..." : "Queue for Repair"}
        </Button>
      </div>
    </>
  );
}
