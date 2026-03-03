"use client";
import { useEffect, useMemo, useState } from "react";
import { Save, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomModal } from "@/components/custom/CustomModal";
import { syncUserOverrides } from "@/features/access-control/api";
import {
  buildFilteredTree,
  buildMenuTree,
  getDescendantIds,
} from "@/features/access-control/utils";
import { MenuTreeView } from "./MenuTreeView";

export function UserOverridesDialog({ user, menus, onClose, onSaved }) {
  const [selectedMenuIds, setSelectedMenuIds] = useState(new Set());
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const tree = useMemo(() => buildMenuTree(menus), [menus]);
  const nodeMap = useMemo(() => {
    const map = new Map();

    const walk = (nodes) => {
      for (const node of nodes) {
        map.set(node.menu.id, node);
        walk(node.children);
      }
    };

    walk(tree);

    return map;
  }, [tree]);

  // Sync selected overrides when user changes (dialog opens)
  useEffect(() => {
    if (user) {
      setSelectedMenuIds(new Set(user.override_menu_ids));
      setFilter("");
    }
  }, [user]);

  const handleToggle = (menuId, checked) => {
    setSelectedMenuIds((prev) => {
      const next = new Set(prev);

      if (checked) {
        // Add the menu itself
        next.add(menuId);
      } else {
        // Remove the menu itself
        next.delete(menuId);

        // Auto-deselect all descendants (children unreachable without parent)
        for (const descendantId of getDescendantIds(menuId, nodeMap)) {
          next.delete(descendantId);
        }
      }

      return next;
    });
  };
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      await syncUserOverrides(user.employee_no, Array.from(selectedMenuIds));
      onSaved();
      onClose();
      toast.success("Menu overrides updated successfully.");
    } catch {
      toast.error("Unable to update menu overrides.");
    } finally {
      setSaving(false);
    }
  };

  const filterTrimmed = filter.trim().toLowerCase();
  const matchIds = useMemo(() => {
    if (!filterTrimmed) return null;
    const ids = new Set();

    for (const menu of menus) {
      const haystack = `${menu.title} ${menu.label} ${menu.permission_key ?? ""}`.toLowerCase();

      if (haystack.includes(filterTrimmed)) ids.add(menu.id);
    }

    return ids;
  }, [filterTrimmed, menus]);
  const displayTree = useMemo(() => {
    if (!matchIds) return tree;

    return buildFilteredTree(tree, matchIds);
  }, [tree, matchIds]);

  return (
    <CustomModal
      open={user !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Edit Menu Overrides"
      description={user ? `${user.full_name} (${user.employee_no})` : ""}
      size="lg"
      footer={
        <>
          <Badge variant="info" className="mr-auto">
            {selectedMenuIds.size} selected
          </Badge>
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
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter menus..."
            className="pl-9"
          />
        </div>

        <div className="max-h-[60vh] overflow-x-hidden overflow-y-auto rounded-md border border-border/70 p-2">
          {displayTree.length === 0 && filterTrimmed ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No menus match your filter.
            </p>
          ) : (
            <MenuTreeView
              tree={displayTree}
              selectedIds={selectedMenuIds}
              onToggle={handleToggle}
              highlightIds={matchIds ?? undefined}
            />
          )}
        </div>
      </div>
    </CustomModal>
  );
}
