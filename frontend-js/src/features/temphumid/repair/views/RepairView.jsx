"use client";

import { CustomModal } from "@/components/custom/CustomModal";
import { LoadingOverlay } from "@/components/ui/loadingoverlay";
import { Button } from "@/components/ui/button";
import { TriangleAlert, Upload } from "lucide-react";

import {
  RepairFormPanel,
  RepairHistoryDetailContent,
  RepairHistoryPanel,
  RepairListPanel,
} from "@/features/temphumid/repair/components/RepairPanels";
import {
  MarkRepairDoneContent,
  StartRepairContent,
  UploadRepairContent,
} from "@/features/temphumid/repair/components/RepairModals";
import { useRepairDashboard } from "@/features/temphumid/repair/hooks/use-repair-dashboard";
import { REPAIR_GLOBAL_STYLES } from "@/features/temphumid/repair/utils/repair";

export default function RepairView() {
  const {
    activeError,
    activeRecord,
    activeRecords,
    acuStatus,
    closeMarkDoneModal,
    closeStartModal,
    closeUploadModal,
    formData,
    handleDone,
    handleQueued,
    handleUpload,
    headerSummary,
    historyError,
    historyLoading,
    markDoneOpen,
    openMarkDone,
    openStartModal,
    openUploadModal,
    pageLoading,
    pendingCount,
    pendingDone,
    repairHistory,
    selectedHistory,
    setSelectedHistory,
    startOpen,
    uploadOpen,
  } = useRepairDashboard();

  return (
    <>
      <style>{REPAIR_GLOBAL_STYLES}</style>

      {pageLoading && (
        <LoadingOverlay
          title="Loading repair history"
          subtitle="Fetching active and history records..."
        />
      )}

      <div className="flex h-full flex-col overflow-hidden" style={{ minHeight: 0 }}>
        <div
          style={{
            marginTop: 10,
            padding: "12px 24px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
          className="bg-background"
        >
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manage ACU Repair</h1>
            <p className="mt-1 text-sm text-muted-foreground">{headerSummary}</p>
          </div>
          <Button
            type="button"
            size="default"
            variant="default"
            style={{ cursor: "pointer" }}
            disabled={pendingCount === 0}
            onClick={openUploadModal}
          >
            <Upload size={16} style={{ marginRight: 6 }} />
            Upload Repair Record{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "4px 24px 24px" }}>
          {activeError && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 14px",
                borderRadius: 8,
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                fontSize: 13,
                color: "#b91c1c",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <TriangleAlert size={14} style={{ flexShrink: 0 }} />
              {activeError}
            </div>
          )}

          <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
            <RepairListPanel
              records={activeRecords}
              onRowClick={openMarkDone}
              onStartRepair={openStartModal}
            />

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              <RepairFormPanel formData={formData} acuStatus={acuStatus} />
            </div>
          </div>

          {historyError && (
            <div
              style={{
                marginTop: 12,
                padding: "10px 14px",
                borderRadius: 8,
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                fontSize: 13,
                color: "#b91c1c",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <TriangleAlert size={14} style={{ flexShrink: 0 }} />
              {historyError}
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <RepairHistoryPanel
              history={repairHistory}
              loading={historyLoading}
              onViewDetails={setSelectedHistory}
            />
          </div>
        </div>
      </div>

      <CustomModal
        open={startOpen}
        onOpenChange={(open) => {
          if (!open) closeStartModal();
        }}
        title="Start Repair"
        description="Scan 1: ACU QR -> Scan 2: Operator QR -> Confirm queue entry"
        size="sm"
      >
        <StartRepairContent onQueued={handleQueued} onClose={closeStartModal} />
      </CustomModal>

      <CustomModal
        open={markDoneOpen}
        onOpenChange={(open) => {
          if (!open) closeMarkDoneModal();
        }}
        title="Mark as Done"
        description={activeRecord ? `${activeRecord.machineId} \u00B7 ${activeRecord.location}` : ""}
        size="sm"
      >
        {activeRecord && (
          <MarkRepairDoneContent
            record={activeRecord}
            onDone={handleDone}
            onClose={closeMarkDoneModal}
          />
        )}
      </CustomModal>

      <CustomModal
        open={uploadOpen}
        onOpenChange={(open) => {
          if (!open) closeUploadModal();
        }}
        title="Upload"
        description="Review records before submitting to the database."
        size="sm"
      >
        <UploadRepairContent
          pendingDone={pendingDone}
          onUpload={handleUpload}
          onClose={closeUploadModal}
        />
      </CustomModal>

      <CustomModal
        open={!!selectedHistory}
        onOpenChange={(open) => {
          if (!open) setSelectedHistory(null);
        }}
        title="Repair Record"
        description={
          selectedHistory
            ? `${selectedHistory.machineId} \u00B7 ${selectedHistory.location}`
            : ""
        }
        size="sm"
      >
        <RepairHistoryDetailContent record={selectedHistory} />
      </CustomModal>
    </>
  );
}
