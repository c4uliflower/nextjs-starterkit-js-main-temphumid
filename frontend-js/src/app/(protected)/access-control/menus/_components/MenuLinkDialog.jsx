"use client";
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link2, Save } from "lucide-react";
import { toast } from "sonner";
import { CustomModal } from "@/components/custom/CustomModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { linkMenu } from "@/features/access-control/api";
import {
  buildManagedMenuTree,
  collectDescendantMenuIds,
} from "@/features/access-control/menu-management-utils";
const ROOT_PARENT = "__root__";

function getApiErrorMessage(error, fallback) {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const message = error.response?.data?.message;

  return typeof message === "string" && message.trim() !== "" ? message : fallback;
}
export function MenuLinkDialog({ menu, menus, parentOptions, onClose, onSaved }) {
  const [parentId, setParentId] = useState(null);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!menu) return;
    setParentId(menu.parent_id);
    setDisplayOrder(menu.display_order);
  }, [menu]);
  const blockedParentIds = useMemo(() => {
    if (!menu) {
      return new Set();
    }

    const tree = buildManagedMenuTree(menus);
    const descendants = collectDescendantMenuIds(menu.id, tree);

    return new Set([menu.id, ...descendants]);
  }, [menu, menus]);
  const availableParentOptions = useMemo(() => {
    return [...parentOptions]
      .filter((option) => !blockedParentIds.has(option.id))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [blockedParentIds, parentOptions]);
  const parentSelectionDisabled = menu?.type === "header";

  const handleSave = async () => {
    if (!menu) return;
    setSaving(true);

    try {
      await linkMenu(menu.id, {
        parent_id: parentSelectionDisabled ? null : parentId,
        display_order: Math.max(0, displayOrder),
      });
      toast.success("Menu link updated successfully.");
      onSaved();
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to link menu."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CustomModal
      open={menu !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Link Menu"
      description={menu ? `Move "${menu.title}" to a new parent and sort order.` : ""}
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
        <div className="flex items-center gap-2 rounded-md border border-border/70 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
          <Link2 className="size-4 text-primary" />
          Linking updates the tree hierarchy immediately after save.
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Parent
          </label>
          <Select
            value={parentId === null ? ROOT_PARENT : String(parentId)}
            onValueChange={(value) => {
              setParentId(value === ROOT_PARENT ? null : Number(value));
            }}
            disabled={parentSelectionDisabled}
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
          {parentSelectionDisabled && (
            <Badge variant="outline" size="sm">
              Header menus stay at root level.
            </Badge>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Display Order
          </label>
          <Input
            type="number"
            min={0}
            value={String(displayOrder)}
            onChange={(event) => {
              const nextValue = Number.parseInt(event.target.value, 10);

              setDisplayOrder(Number.isNaN(nextValue) ? 0 : Math.max(0, nextValue));
            }}
          />
        </div>
      </div>
    </CustomModal>
  );
}
