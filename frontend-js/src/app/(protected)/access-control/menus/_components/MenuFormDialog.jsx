"use client";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { CustomModal } from "@/components/custom/CustomModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { createMenu, updateMenu } from "@/features/access-control/api";
import {
  buildManagedMenuTree,
  collectDescendantMenuIds,
} from "@/features/access-control/menu-management-utils";
const ROOT_PARENT = "__root__";
const MENU_TYPE_OPTIONS = [
  {
    value: "header",
    label: "Header",
    description: "Top-level section label for the sidebar.",
  },
  {
    value: "group",
    label: "Group",
    description: "Collapsible parent node with icon.",
  },
  {
    value: "item",
    label: "Item",
    description: "Clickable route with path and permission.",
  },
];
const EMPTY_DRAFT = {
  parent_id: null,
  type: "item",
  title: "",
  icon: "",
  path: "",
  permission_key: "",
  display_order: 0,
  is_active: true,
};

function normalizeOptional(value) {
  if (!value) return null;
  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}
function normalizePath(value) {
  const normalized = normalizeOptional(value);

  if (!normalized) return null;

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}
function getApiErrorMessage(error, fallback) {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const message = error.response?.data?.message;

  return typeof message === "string" && message.trim() !== "" ? message : fallback;
}
export function MenuFormDialog({ target, menus, parentOptions, onClose, onSaved }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const isEditing = target?.mode === "edit";
  const editingMenu = target?.mode === "edit" ? target.menu : null;

  useEffect(() => {
    if (target === null) return;

    if (target.mode === "new") {
      setDraft({
        ...EMPTY_DRAFT,
        parent_id: target.parentId,
        type: target.parentId === null ? "header" : "item",
      });

      return;
    }

    setDraft({
      parent_id: target.menu.parent_id,
      type: target.menu.type,
      title: target.menu.title,
      icon: target.menu.icon ?? "",
      path: target.menu.path ?? "",
      permission_key: target.menu.permission_key ?? "",
      display_order: target.menu.display_order,
      is_active: target.menu.is_active,
    });
  }, [target]);
  const blockedParentIds = useMemo(() => {
    if (!editingMenu) {
      return new Set();
    }

    const tree = buildManagedMenuTree(menus);
    const descendants = collectDescendantMenuIds(editingMenu.id, tree);

    return new Set([editingMenu.id, ...descendants]);
  }, [editingMenu, menus]);
  const availableParentOptions = useMemo(() => {
    return [...parentOptions]
      .filter((option) => !blockedParentIds.has(option.id))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [blockedParentIds, parentOptions]);
  const showItemFields = draft.type === "item";
  const parentDisabled = draft.type === "header";

  const handleSave = async () => {
    const title = draft.title.trim();

    if (title === "") {
      toast.warning("Menu title is required.");

      return;
    }

    const payload = {
      parent_id: draft.type === "header" ? null : draft.parent_id,
      type: draft.type,
      title,
      icon: draft.type === "header" ? null : normalizeOptional(draft.icon),
      path: showItemFields ? normalizePath(draft.path) : null,
      permission_key: showItemFields ? normalizeOptional(draft.permission_key) : null,
      display_order: Number.isFinite(draft.display_order) ? Math.max(0, draft.display_order) : 0,
      is_active: draft.is_active,
    };

    setSaving(true);

    try {
      if (isEditing && editingMenu) {
        await updateMenu(editingMenu.id, payload);
        toast.success("Menu updated successfully.");
      } else {
        await createMenu(payload);
        toast.success("Menu created successfully.");
      }

      onSaved();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to save menu."));
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
      title={isEditing ? "Edit Menu" : "Create Menu"}
      description={
        isEditing
          ? `Editing "${editingMenu?.title}"`
          : "Create a new menu node and link it into the tree."
      }
      size="lg"
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
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Type
          </label>
          <Select
            value={draft.type}
            onValueChange={(value) => {
              const nextType = value;

              setDraft((prev) => ({
                ...prev,
                type: nextType,
                parent_id: nextType === "header" ? null : prev.parent_id,
                icon: nextType === "header" ? null : prev.icon,
                path: nextType === "item" ? prev.path : null,
                permission_key: nextType === "item" ? prev.permission_key : null,
              }));
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {MENU_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {MENU_TYPE_OPTIONS.find((option) => option.value === draft.type)?.description}
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Parent
          </label>
          <Select
            value={draft.parent_id === null ? ROOT_PARENT : String(draft.parent_id)}
            onValueChange={(value) => {
              setDraft((prev) => ({
                ...prev,
                parent_id: value === ROOT_PARENT ? null : Number(value),
              }));
            }}
            disabled={parentDisabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" className="max-h-72">
              <SelectItem value={ROOT_PARENT}>No parent (root)</SelectItem>
              {availableParentOptions.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {parentDisabled
              ? "Header menus are always top-level."
              : "Choose where this menu should be linked."}
          </p>
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Title
          </label>
          <Input
            value={draft.title}
            onChange={(event) => {
              const value = event.target.value;

              setDraft((prev) => ({
                ...prev,
                title: value,
              }));
            }}
            placeholder="Menu title"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Icon
          </label>
          <Input
            value={draft.icon ?? ""}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                icon: event.target.value,
              }));
            }}
            placeholder="ShieldCheck"
            disabled={draft.type === "header"}
          />
          <p className="text-xs text-muted-foreground">
            Use a Lucide icon name that exists in the sidebar icon map.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Display Order
          </label>
          <Input
            type="number"
            min={0}
            value={String(draft.display_order)}
            onChange={(event) => {
              const nextValue = Number.parseInt(event.target.value, 10);

              setDraft((prev) => ({
                ...prev,
                display_order: Number.isNaN(nextValue) ? 0 : Math.max(0, nextValue),
              }));
            }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Route Path
          </label>
          <Input
            value={draft.path ?? ""}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                path: event.target.value,
              }));
            }}
            placeholder="/access-control/menus"
            disabled={!showItemFields}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Permission Key
          </label>
          <Input
            value={draft.permission_key ?? ""}
            onChange={(event) => {
              setDraft((prev) => ({
                ...prev,
                permission_key: event.target.value,
              }));
            }}
            placeholder="manage_roles"
            className="font-mono text-xs"
            disabled={!showItemFields}
          />
        </div>

        <div className="md:col-span-2">
          <div className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">
                Inactive menus are hidden from role assignment and sidebar rendering.
              </p>
            </div>
            <Switch
              variant="success"
              checked={draft.is_active}
              onCheckedChange={(checked) => {
                setDraft((prev) => ({
                  ...prev,
                  is_active: checked,
                }));
              }}
            />
          </div>
        </div>
      </div>
    </CustomModal>
  );
}
