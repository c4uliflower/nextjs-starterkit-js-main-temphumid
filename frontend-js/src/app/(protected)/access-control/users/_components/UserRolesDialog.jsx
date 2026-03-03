"use client";
import { useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomModal } from "@/components/custom/CustomModal";
import { syncUserRoles } from "@/features/access-control/api";

export function UserRolesDialog({ user, roles, onClose, onSaved }) {
  const [selectedRoleIds, setSelectedRoleIds] = useState(new Set());
  const [saving, setSaving] = useState(false);

  // Sync selected roles when user changes (dialog opens)
  useEffect(() => {
    if (user) {
      setSelectedRoleIds(new Set(user.assigned_roles.map((r) => r.id)));
    }
  }, [user]);

  const handleToggle = (roleId, checked) => {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev);

      if (checked) {
        next.add(roleId);
      } else {
        next.delete(roleId);
      }

      return next;
    });
  };
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      await syncUserRoles(user.employee_no, Array.from(selectedRoleIds));
      onSaved();
      onClose();
      toast.success("Role assignments updated successfully.");
    } catch {
      toast.error("Unable to update role assignments.");
    } finally {
      setSaving(false);
    }
  };

  const dirty = useMemo(() => {
    if (!user) return false;
    const original = new Set(user.assigned_roles.map((r) => r.id));

    if (original.size !== selectedRoleIds.size) return true;

    for (const id of selectedRoleIds) {
      if (!original.has(id)) return true;
    }

    return false;
  }, [user, selectedRoleIds]);

  return (
    <CustomModal
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Edit Roles"
      description={user ? `${user.full_name} (${user.employee_no})` : ""}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !dirty}>
            <Save className="size-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {roles.map((role) => (
          <label
            key={role.id}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-border/70 px-3 py-2.5 transition-colors hover:bg-accent/40"
          >
            <Checkbox
              checked={selectedRoleIds.has(role.id)}
              onCheckedChange={(next) => handleToggle(role.id, next === true)}
            />
            <span className="text-sm font-medium">{role.name}</span>
            {role.is_default && (
              <Badge variant="secondary" className="ml-auto text-[10px]">
                Default
              </Badge>
            )}
          </label>
        ))}
      </div>
    </CustomModal>
  );
}
