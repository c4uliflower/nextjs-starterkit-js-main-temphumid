"use client";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CustomModal } from "@/components/custom/CustomModal";
import { createRole, updateRole } from "@/features/access-control/api";

function normalizeRoleKey(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_ -]/g, "")
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");
}

const EMPTY_DRAFT = {
  name: "",
  key: "",
  description: "",
  is_default: false,
  is_active: true,
};

export function RoleFormDialog({ target, onClose, onSaved }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const isEditing = target !== null && target !== "new";

  useEffect(() => {
    if (target === null) return;

    if (target === "new") {
      setDraft(EMPTY_DRAFT);
    } else {
      setDraft({
        name: target.name,
        key: target.key,
        description: target.description ?? "",
        is_default: target.is_default,
        is_active: target.is_active,
      });
    }
  }, [target]);

  const handleSave = async () => {
    const name = draft.name.trim();
    const key = normalizeRoleKey(draft.key || draft.name);

    if (!name || !key) {
      toast.warning("Role name and key are required.");

      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...draft,
        name,
        key,
        description: draft.description?.trim() || null,
      };

      if (isEditing) {
        await updateRole(target.id, payload);
        toast.success("Role updated successfully.");
      } else {
        await createRole(payload);
        toast.success("Role created successfully.");
      }

      onSaved();
      onClose();
    } catch {
      toast.error("Unable to save role. Check key/name uniqueness.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CustomModal
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={isEditing ? "Edit Role" : "Create Role"}
      description={isEditing ? `Editing "${target.name}"` : "Define a new role for the system."}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Role Name
            </label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Administrator"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Role Key
            </label>
            <Input
              value={draft.key}
              onChange={(e) => setDraft((prev) => ({ ...prev, key: e.target.value }))}
              placeholder="admin"
              className="font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Description
          </label>
          <Textarea
            rows={3}
            value={draft.description ?? ""}
            onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Role purpose and assignment scope."
          />
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Default Role</p>
              <p className="text-xs text-muted-foreground">
                Fallback when no assignment rule matches.
              </p>
            </div>
            <Switch
              checked={draft.is_default}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, is_default: checked }))}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">
                Inactive roles are excluded from assignment.
              </p>
            </div>
            <Switch
              variant="success"
              checked={draft.is_active}
              onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, is_active: checked }))}
            />
          </div>
        </div>
      </div>
    </CustomModal>
  );
}
