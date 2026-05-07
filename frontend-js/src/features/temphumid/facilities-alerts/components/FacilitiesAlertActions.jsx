import {
  FacilitiesScheduleForm,
  FacilitiesVerifyForm,
} from "@/features/temphumid/facilities-alerts/components/FacilitiesActionForms";
import {
  FacilitiesScheduledOpenActions,
  FacilitiesUnscheduledOpenActions,
  FacilitiesVerifyingAlertState,
} from "@/features/temphumid/facilities-alerts/components/FacilitiesAlertStateViews";

export function FacilitiesAlertActions({
  activeForm,
  alert,
  alertState,
  acting,
  onCloseForm,
  onConflict,
  onOpenRepair,
  onOpenSchedule,
  onOpenVerify,
  onResolve,
  onUnschedule,
}) {
  if (alertState.isOpen) {
    if (activeForm === "verify") {
      return (
        <FacilitiesVerifyForm
          alertId={alert.id}
          lockedActionType={alertState.isScheduled ? alert.actionType : null}
          initialActionType={!alertState.isScheduled ? alert.actionType ?? "" : ""}
          initialActionRemarks={alert.actionRemarks ?? ""}
          onConflict={onConflict}
          onSubmit={(updatedAlert) => {
            onCloseForm();
            onResolve(updatedAlert);
          }}
          onCancel={onCloseForm}
        />
      );
    }

    if (activeForm === "schedule") {
      return (
        <FacilitiesScheduleForm
          alertId={alert.id}
          actionType="maintenance"
          onSubmit={(updatedAlert) => {
            onCloseForm();
            onResolve(updatedAlert);
          }}
          onCancel={onCloseForm}
        />
      );
    }

    if (activeForm === "repair") {
      return (
        <FacilitiesScheduleForm
          alertId={alert.id}
          actionType="repair"
          onSubmit={(updatedAlert) => {
            onCloseForm();
            onResolve(updatedAlert);
          }}
          onCancel={onCloseForm}
        />
      );
    }

    if (alertState.isScheduled) {
      return (
        <FacilitiesScheduledOpenActions
          alert={alert}
          acting={acting}
          onOpenVerify={onOpenVerify}
          onUnschedule={onUnschedule}
        />
      );
    }

    return (
      <FacilitiesUnscheduledOpenActions
        alert={alert}
        acting={acting}
        onOpenRepair={onOpenRepair}
        onOpenSchedule={onOpenSchedule}
        onOpenVerify={onOpenVerify}
      />
    );
  }

  if (alertState.isVerifying) {
    return <FacilitiesVerifyingAlertState alert={alert} />;
  }

  return null;
}

