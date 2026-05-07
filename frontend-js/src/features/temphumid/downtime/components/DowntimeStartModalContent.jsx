"use client";

import { useState } from "react";

import { StepBar } from "@/features/temphumid/downtime/components/DowntimeAtoms";
import {
  DowntimeConfirmStartStep,
  DowntimeSensorScanStep,
  DowntimeTechnicianScanStep,
} from "@/features/temphumid/downtime/components/DowntimeStartSteps";
import {
  getDowntimeSymptomLabel,
  parseDowntimeSensorQr,
  parseTechnicianQr,
} from "@/features/temphumid/downtime/utils/downtime";
import { startDowntime } from "@/features/temphumid/shared/utils/api";

export function StartDowntimeContent({ onQueued, onClose }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [scanError1, setScanError1] = useState(null);
  const [scanError2, setScanError2] = useState(null);
  const [sensorInfo, setSensorInfo] = useState(null);
  const [techInfo, setTechInfo] = useState(null);

  const reset = () => {
    setStep(1);
    setSaving(false);
    setApiError(null);
    setScanError1(null);
    setScanError2(null);
    setSensorInfo(null);
    setTechInfo(null);
  };

  const handleQueue = async () => {
    setSaving(true);
    setApiError(null);

    try {
      const symptomLabel = getDowntimeSymptomLabel(sensorInfo.status);
      const record = await startDowntime({
        area_id: sensorInfo.areaId,
        line_name: sensorInfo.lineName,
        processed_by: techInfo.technicianId,
        source_alert_id: sensorInfo.sourceAlertId ?? null,
        symptom: symptomLabel,
      });

      onQueued({
        id: record.id,
        sensorInfo,
        techInfo,
        processedAt: record.processed_at,
        symptomLabel,
      });

      reset();
      onClose();
    } catch (error) {
      setApiError(error.response?.data?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSensorScan = async (rawValue) => {
    setScanError1(null);
    setSaving(true);

    try {
      const result = await parseDowntimeSensorQr(rawValue);
      if (!result.ok) {
        setScanError1(result.error);
        return;
      }

      setSensorInfo(result.sensor);
      setStep(2);
    } finally {
      setSaving(false);
    }
  };

  const handleTechScan = (rawValue) => {
    setScanError2(null);
    const result = parseTechnicianQr(rawValue);

    if (!result.ok) {
      setScanError2(result.error);
      return;
    }

    setTechInfo({ technicianId: result.technicianId });
    setStep(3);
  };

  const symptomLabel = sensorInfo ? getDowntimeSymptomLabel(sensorInfo.status) : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <StepBar step={step} total={3} />

      {step === 1 && (
        <DowntimeSensorScanStep
          onError={(message) => setScanError1(message)}
          onScan={handleSensorScan}
          saving={saving}
          scanError={scanError1}
        />
      )}

      {step === 2 && sensorInfo && (
        <DowntimeTechnicianScanStep
          onBack={() => setStep(1)}
          onClearSensor={() => {
            setSensorInfo(null);
            setScanError1(null);
            setStep(1);
          }}
          onError={(message) => setScanError2(message)}
          onScan={handleTechScan}
          scanError={scanError2}
          sensorInfo={sensorInfo}
        />
      )}

      {step === 3 && sensorInfo && techInfo && (
        <DowntimeConfirmStartStep
          apiError={apiError}
          onBack={() => setStep(2)}
          onClearSensor={() => {
            setSensorInfo(null);
            setScanError1(null);
            setStep(1);
          }}
          onClearTech={() => {
            setTechInfo(null);
            setScanError2(null);
            setStep(2);
          }}
          onConfirm={handleQueue}
          saving={saving}
          sensorInfo={sensorInfo}
          symptomLabel={symptomLabel}
          techInfo={techInfo}
        />
      )}
    </div>
  );
}


