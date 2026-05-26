"use client";

import { CustomModal } from "@/components/custom/CustomModal";
import { Button } from "@/components/ui/button";
import { TriangleAlert, Upload, Wrench } from "lucide-react";

import {
  HistoryDetailContent,
  DowntimeFormPanel,
  MaintenanceHistoryPanel,
  StopLineListPanel,
} from "@/features/temphumid/downtime/components/DowntimePanels";
import {
  MarkDoneContent,
  StartDowntimeContent,
  UploadDowntimeContent,
} from "@/features/temphumid/downtime/components/DowntimeModals";
import { useDowntimeDashboard } from "@/features/temphumid/downtime/hooks/use-downtime-dashboard";
import { LoadingOverlay } from "@/components/ui/loadingoverlay";
import { DOWNTIME_GLOBAL_STYLES } from "@/features/temphumid/downtime/utils/downtime";

export default function DowntimeView() {
  const {
    activeError,
    activeRecord,
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
    maintenanceHistory,
    markDoneOpen,
    openMarkDone,
    openStartModal,
    openUploadModal,
    pageLoading,
    pendingCount,
    pendingDone,
    selectedHistory,
    setSelectedHistory,
    startOpen,
    stopLineList,
    uploadOpen,
  } = useDowntimeDashboard();

  return (
    <>
      <style>{DOWNTIME_GLOBAL_STYLES}</style>

      {pageLoading && (
        <LoadingOverlay
          title="Loading maintenance history"
          subtitle="Fetching active and history records..."
        />
      )}

      <div className="flex h-full flex-col overflow-hidden" style={{ minHeight: 0 }}>
        <div className="bg-background" style={{ flexShrink: 0, padding: "16px 24px 12px" }}>
          <div
            className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
            style={{
              borderBottom: "1px solid var(--border)",
              paddingBottom: 14,
            }}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">IoT Sensor Maintenance</h1>
                <span
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    color: "var(--muted-foreground)",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 9px",
                  }}
                >
                  {stopLineList.length} active
                </span>
                <span
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 999,
                    color: "var(--muted-foreground)",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "3px 9px",
                  }}
                >
                  {pendingCount} ready to upload
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{headerSummary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="default"
                variant="outline"
                style={{ cursor: "pointer" }}
                onClick={openStartModal}
              >
                <Wrench size={16} style={{ marginRight: 6 }} />
                Start Maintenance
              </Button>
              <Button
                type="button"
                size="default"
                variant="default"
                style={{ cursor: "pointer" }}
                disabled={pendingCount === 0}
                onClick={openUploadModal}
              >
                <Upload size={16} style={{ marginRight: 6 }} />
                Upload Maintenance Record{pendingCount > 0 ? ` (${pendingCount})` : ""}
              </Button>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 24px 24px" }}>
          {activeError && (
            <div
              style={{
                marginBottom: 12,
                padding: "10px 14px",
                borderRadius: 8,
                background: "color-mix(in oklch, var(--destructive) 10%, var(--card))",
                border: "1px solid color-mix(in oklch, var(--destructive) 35%, var(--border))",
                fontSize: 13,
                color: "var(--destructive)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <TriangleAlert size={14} style={{ flexShrink: 0 }} />
              {activeError}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
            <StopLineListPanel
              records={stopLineList}
              onRowClick={openMarkDone}
              onStartDowntime={openStartModal}
              showStartButton={false}
            />

            <div>
              <DowntimeFormPanel formData={formData} />
            </div>

            {historyError && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "color-mix(in oklch, var(--destructive) 10%, var(--card))",
                  border: "1px solid color-mix(in oklch, var(--destructive) 35%, var(--border))",
                  fontSize: 13,
                  color: "var(--destructive)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <TriangleAlert size={14} style={{ flexShrink: 0 }} />
                {historyError}
              </div>
            )}

            <MaintenanceHistoryPanel
              history={maintenanceHistory}
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
        title="Start Maintenance"
        description="Scan 1: Sensor QR -> Scan 2: Operator QR -> Confirm queue entry"
        size="sm"
      >
        <StartDowntimeContent onQueued={handleQueued} onClose={closeStartModal} />
      </CustomModal>

      <CustomModal
        open={markDoneOpen}
        onOpenChange={(open) => {
          if (!open) closeMarkDoneModal();
        }}
        title="Mark as Done"
        description={activeRecord ? `${activeRecord.lineName} \u00B7 ${activeRecord.areaId}` : ""}
        size="sm"
      >
        {activeRecord && (
          <MarkDoneContent record={activeRecord} onDone={handleDone} onClose={closeMarkDoneModal} />
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
        <UploadDowntimeContent
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
        title="Maintenance Record"
        description={
          selectedHistory ? `${selectedHistory.lineName} \u00B7 ${selectedHistory.areaId}` : ""
        }
        size="sm"
      >
        <HistoryDetailContent record={selectedHistory} />
      </CustomModal>
    </>
  );
}
