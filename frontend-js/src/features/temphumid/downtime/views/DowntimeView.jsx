"use client";

import { CustomModal } from "@/components/custom/CustomModal";
import { DashboardCard } from "@/components/custom/DashboardCard";
import { Button } from "@/components/ui/button";
import { ActivitySquare, CheckCheck, TriangleAlert, Upload, Wrench } from "lucide-react";

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
    breachCount,
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
    noDataCount,
    openMarkDone,
    openStartModal,
    openUploadModal,
    pageLoading,
    pendingCount,
    pendingDone,
    selectedHistory,
    setSelectedHistory,
    stats,
    startOpen,
    stopLineList,
    symptom,
    uploadOpen,
    uploadedCount,
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
            <h1 className="text-2xl font-bold text-foreground">Manage Sensor IOT Maintenance</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {headerSummary}
              {stats.pendingCount > 0 && (
                <span style={{ marginLeft: 10, fontWeight: 700, color: "#b45309" }}>
                  {"\u00B7"} {stats.pendingCount} Awaiting Upload
                </span>
              )}
            </p>
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
            Upload Maintenance{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
        </div>

        <div style={{ padding: "0 24px 16px", flexShrink: 0 }}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              value={String(uploadedCount)}
              label="Uploaded"
              icon={CheckCheck}
              variant="success"
            />
            <DashboardCard
              value={String(stopLineList.length)}
              label="Active Maintenance"
              icon={Wrench}
              variant="warning"
            />
            <DashboardCard
              value={String(noDataCount)}
              label="No Data"
              icon={ActivitySquare}
              variant="secondary"
            />
            <DashboardCard
              value={String(breachCount)}
              label="Breach"
              icon={TriangleAlert}
              variant="destructive"
            />
          </div>
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
            <StopLineListPanel
              records={stopLineList}
              onRowClick={openMarkDone}
              onStartDowntime={openStartModal}
            />

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              <DowntimeFormPanel formData={formData} symptom={symptom} />
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
        description="Scan 1: Sensor QR -> Scan 2: Operator QR -> Confirm"
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




