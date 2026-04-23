import { Button } from "@/components/ui/button";

import { ConfirmedChip } from "@/features/temphumid/downtime/components/DowntimeAtoms";
import { DowntimeQrScanner } from "@/features/temphumid/downtime/components/DowntimeQrScanner";
import { getDowntimeSymptomColor } from "@/features/temphumid/downtime/utils/downtime";

export function DowntimeSensorScanStep({ onError, onScan, saving, scanError }) {
  return (
    <>
      <DowntimeQrScanner
        label="Point camera at the QR code on the sensor or its location label."
        onScan={onScan}
        onError={onError}
      />
      {saving && <p className="text-center text-sm text-muted-foreground">Validating sensor...</p>}
      {scanError && (
        <p className="text-sm text-destructive" style={{ marginTop: 4 }}>
          {scanError}
        </p>
      )}
    </>
  );
}

export function DowntimeTechnicianScanStep({
  onBack,
  onClearSensor,
  onError,
  onScan,
  scanError,
  sensorInfo,
}) {
  return (
    <>
      <ConfirmedChip
        label={sensorInfo.lineName}
        sub={`${sensorInfo.areaId} \u00B7 ${sensorInfo.plant}${sensorInfo.floor}`}
        color="#fff"
        bg="#435ebe"
        onClear={onClearSensor}
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

export function DowntimeConfirmStartStep({
  apiError,
  onBack,
  onClearSensor,
  onClearTech,
  onConfirm,
  saving,
  sensorInfo,
  symptomLabel,
  techInfo,
}) {
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <ConfirmedChip
          label={sensorInfo.lineName}
          sub={`${sensorInfo.areaId} \u00B7 ${sensorInfo.plant}${sensorInfo.floor}`}
          color="#fff"
          bg="#435ebe"
          onClear={onClearSensor}
        />
        <ConfirmedChip
          label={`Operator ID: ${techInfo.technicianId}`}
          color="#fff"
          bg="#435ebe"
          onClear={onClearTech}
        />
        <ConfirmedChip
          label={`Symptom: ${symptomLabel}`}
          color="#fff"
          bg={getDowntimeSymptomColor(symptomLabel)}
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
          {saving ? "Starting..." : "Queue for Maintenance"}
        </Button>
      </div>
    </>
  );
}


