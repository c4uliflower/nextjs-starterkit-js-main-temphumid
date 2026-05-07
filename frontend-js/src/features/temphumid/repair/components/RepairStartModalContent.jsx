"use client";

import { useState } from "react";

import { RepairStepBar } from "@/features/temphumid/repair/components/RepairAtoms";
import {
  RepairAcuScanStep,
  RepairConfirmStartStep,
  RepairTechnicianScanStep,
} from "@/features/temphumid/repair/components/RepairStartSteps";
import {
  parseRepairAcuQr,
  parseRepairTechnicianQr,
} from "@/features/temphumid/repair/utils/repair";
import { startRepair } from "@/features/temphumid/shared/utils/api";

export function StartRepairContent({ onQueued, onClose }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [scanError1, setScanError1] = useState(null);
  const [scanError2, setScanError2] = useState(null);
  const [acuInfo, setAcuInfo] = useState(null);
  const [techInfo, setTechInfo] = useState(null);

  const reset = () => {
    setStep(1);
    setSaving(false);
    setApiError(null);
    setScanError1(null);
    setScanError2(null);
    setAcuInfo(null);
    setTechInfo(null);
  };

  const handleQueue = async () => {
    setSaving(true);
    setApiError(null);

    try {
      const record = await startRepair({
        machine_id: acuInfo.machineId,
        machine_qr: acuInfo.machineQr,
        processed_by: techInfo.technicianId,
        acu_status: acuInfo.status,
        source_alert_id: acuInfo.sourceAlertId ?? null,
      });

      onQueued({
        id: record.id,
        acuInfo,
        techInfo,
        processedAt: record.processed_at,
      });

      reset();
      onClose();
    } catch (error) {
      setApiError(error.response?.data?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAcuScan = async (rawValue) => {
    setScanError1(null);
    setSaving(true);

    try {
      const result = await parseRepairAcuQr(rawValue);
      if (!result.ok) {
        setScanError1(result.error);
        return;
      }

      setAcuInfo(result.acu);
      setStep(2);
    } finally {
      setSaving(false);
    }
  };

  const handleTechScan = (rawValue) => {
    setScanError2(null);
    const result = parseRepairTechnicianQr(rawValue);

    if (!result.ok) {
      setScanError2(result.error);
      return;
    }

    setTechInfo({ technicianId: result.technicianId });
    setStep(3);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <RepairStepBar step={step} total={3} />

      {step === 1 && (
        <RepairAcuScanStep
          onError={(message) => setScanError1(message)}
          onScan={handleAcuScan}
          saving={saving}
          scanError={scanError1}
        />
      )}

      {step === 2 && acuInfo && (
        <RepairTechnicianScanStep
          acuInfo={acuInfo}
          onBack={() => setStep(1)}
          onClearAcu={() => {
            setAcuInfo(null);
            setScanError1(null);
            setStep(1);
          }}
          onError={(message) => setScanError2(message)}
          onScan={handleTechScan}
          scanError={scanError2}
        />
      )}

      {step === 3 && acuInfo && techInfo && (
        <RepairConfirmStartStep
          acuInfo={acuInfo}
          apiError={apiError}
          onBack={() => setStep(2)}
          onClearAcu={() => {
            setAcuInfo(null);
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
          techInfo={techInfo}
        />
      )}
    </div>
  );
}
