"use client";
import { useEffect, useState } from "react";
import { CirclePlus, GripVertical, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/custom/Combobox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { CustomModal } from "@/components/custom/CustomModal";
import { createRule, updateRule } from "@/features/access-control/api";
const MATCH_FIELDS = ["DEPARTMENT", "SECTION", "POSITION", "DIVISION"];

function buildEmptyDraft(roleId) {
  return {
    role_id: roleId,
    priority: 50,
    groups: [
      {
        sort_order: 1,
        conditions: [
          {
            match_field: "DEPARTMENT",
            match_value: "",
            sort_order: 1,
            condition_operator: "AND",
          },
        ],
      },
    ],
  };
}
function cloneRuleAsDraft(rule) {
  return {
    role_id: rule.role_id,
    priority: rule.priority,
    groups: rule.groups.map((group, gi) => ({
      sort_order: group.sort_order || gi + 1,
      conditions: group.conditions.map((c, ci) => ({
        match_field: c.match_field,
        match_value: c.match_value,
        sort_order: c.sort_order || ci + 1,
        condition_operator: c.condition_operator ?? "AND",
      })),
    })),
  };
}
export function RuleFormDialog({
  target,
  roles,
  fields,
  fieldValues,
  defaultRoleId,
  onClose,
  onSaved,
}) {
  const [draft, setDraft] = useState(buildEmptyDraft(0));
  const [saving, setSaving] = useState(false);
  const isEditing = target !== null && target !== "new";
  const availableFields = fields.length > 0 ? fields : [...MATCH_FIELDS];
  const defaultMatchField = availableFields[0] ?? "DEPARTMENT";
  const getFieldValues = (matchField) => fieldValues[matchField] ?? [];

  useEffect(() => {
    if (target === null) return;

    if (target === "new") {
      setDraft(buildEmptyDraft(defaultRoleId));
    } else {
      setDraft(cloneRuleAsDraft(target));
    }
  }, [target, defaultRoleId]);

  // --- Group / condition mutators ---
  const addGroup = () => {
    setDraft((prev) => ({
      ...prev,
      groups: [
        ...prev.groups,
        {
          sort_order: prev.groups.length + 1,
          conditions: [
            {
              match_field: defaultMatchField,
              match_value: "",
              sort_order: 1,
              condition_operator: "AND",
            },
          ],
        },
      ],
    }));
  };
  const removeGroup = (gi) => {
    setDraft((prev) => {
      if (prev.groups.length <= 1) return prev;
      const next = prev.groups.filter((_, i) => i !== gi);

      return {
        ...prev,
        groups: next.map((g, i) => ({ ...g, sort_order: i + 1 })),
      };
    });
  };
  const addCondition = (gi) => {
    setDraft((prev) => ({
      ...prev,
      groups: prev.groups.map((g, i) =>
        i !== gi
          ? g
          : {
              ...g,
              conditions: [
                ...g.conditions,
                {
                  match_field: defaultMatchField,
                  match_value: "",
                  sort_order: g.conditions.length + 1,
                  condition_operator: "AND",
                },
              ],
            },
      ),
    }));
  };
  const removeCondition = (gi, ci) => {
    setDraft((prev) => ({
      ...prev,
      groups: prev.groups.map((g, i) => {
        if (i !== gi || g.conditions.length <= 1) return g;
        const next = g.conditions.filter((_, j) => j !== ci);

        return {
          ...g,
          conditions: next.map((c, j) => ({ ...c, sort_order: j + 1 })),
        };
      }),
    }));
  };
  const updateConditionField = (gi, ci, value) => {
    setDraft((prev) => ({
      ...prev,
      groups: prev.groups.map((g, i) =>
        i !== gi
          ? g
          : {
              ...g,
              conditions: g.conditions.map((c, j) =>
                j !== ci ? c : { ...c, match_field: value, match_value: "" },
              ),
            },
      ),
    }));
  };
  const updateConditionValue = (gi, ci, value) => {
    setDraft((prev) => ({
      ...prev,
      groups: prev.groups.map((g, i) =>
        i !== gi
          ? g
          : {
              ...g,
              conditions: g.conditions.map((c, j) => (j !== ci ? c : { ...c, match_value: value })),
            },
      ),
    }));
  };
  const updateConditionOperator = (gi, ci, value) => {
    setDraft((prev) => ({
      ...prev,
      groups: prev.groups.map((g, i) =>
        i !== gi
          ? g
          : {
              ...g,
              conditions: g.conditions.map((c, j) =>
                j !== ci ? c : { ...c, condition_operator: value },
              ),
            },
      ),
    }));
  };
  // --- Validation & save ---
  const handleSave = async () => {
    if (!draft.role_id) {
      toast.warning("Target role is required.");

      return;
    }
    for (const group of draft.groups) {
      for (const condition of group.conditions) {
        if (!condition.match_value.trim()) {
          toast.warning("Condition values cannot be empty.");

          return;
        }
      }
    }

    const payload = {
      role_id: draft.role_id,
      priority: Number.isFinite(draft.priority) ? draft.priority : 1,
      groups: draft.groups.map((g, gi) => ({
        sort_order: gi + 1,
        conditions: g.conditions.map((c, ci) => ({
          match_field: c.match_field,
          match_value: c.match_value.trim(),
          sort_order: ci + 1,
          condition_operator: ci === 0 ? "AND" : c.condition_operator,
        })),
      })),
    };

    if (payload.priority < 1 || payload.priority > 100) {
      toast.warning("Priority must be between 1 and 100.");

      return;
    }

    setSaving(true);

    try {
      if (isEditing) {
        await updateRule(target.id, payload);
        toast.success("Rule updated successfully.");
      } else {
        await createRule(payload);
        toast.success("Rule created successfully.");
      }

      onSaved();
      onClose();
    } catch {
      toast.error("Unable to save rule. Verify role and condition values.");
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
      title={isEditing ? "Edit Rule" : "Create Rule"}
      description="Define groups and conditions used for automatic role assignment."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4" />
            {saving ? "Saving..." : isEditing ? "Update Rule" : "Create Rule"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Header fields */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-1">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Target Role
            </label>
            <Select
              value={draft.role_id ? String(draft.role_id) : ""}
              onValueChange={(v) => setDraft((prev) => ({ ...prev, role_id: Number(v) }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={String(role.id)}>
                    {role.name}
                    {role.is_default ? " (Default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Priority
            </label>
            <Input
              type="number"
              value={String(draft.priority)}
              min={1}
              max={100}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  priority: Number(e.target.value) || 1,
                }))
              }
            />
          </div>
        </div>

        <Separator />

        {/* Condition groups */}
        <div className="space-y-3">
          {draft.groups.map((group, gi) => (
            <div
              key={`group:${gi}`}
              className="rounded-lg border border-border/70 bg-accent/20 p-3"
            >
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="size-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Group {gi + 1}</p>
                  <Badge variant="secondary" className="text-[10px]">
                    {group.conditions.length} condition
                    {group.conditions.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => removeGroup(gi)}
                  title="Remove group"
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </div>

              <div className="space-y-2">
                {group.conditions.map((condition, ci) => {
                  const values = getFieldValues(condition.match_field);
                  const hasCurrentValue = condition.match_value.trim() !== "";
                  const hasCustomValue = hasCurrentValue && !values.includes(condition.match_value);
                  const valueOptions = [
                    ...values.map((value) => ({
                      value,
                      label: value,
                    })),
                    ...(hasCustomValue
                      ? [
                          {
                            value: condition.match_value,
                            label: condition.match_value,
                          },
                        ]
                      : []),
                  ];

                  return (
                    <div
                      key={`c:${gi}:${ci}`}
                      className="grid gap-2 rounded-md border border-border/70 bg-background p-2 sm:grid-cols-[88px_1fr_1.3fr_auto]"
                    >
                      {ci === 0 ? (
                        <div className="flex h-10 items-center justify-center rounded-md border border-dashed border-border/70 text-xs font-semibold text-muted-foreground">
                          IF
                        </div>
                      ) : (
                        <Select
                          value={condition.condition_operator}
                          onValueChange={(v) => updateConditionOperator(gi, ci, v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AND">AND</SelectItem>
                            <SelectItem value="OR">OR</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      <Select
                        value={condition.match_field}
                        onValueChange={(v) => updateConditionField(gi, ci, v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Field" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFields.map((field) => (
                            <SelectItem key={field} value={field}>
                              {field}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Combobox
                        options={valueOptions}
                        value={hasCurrentValue ? condition.match_value : ""}
                        onValueChange={(v) => updateConditionValue(gi, ci, v)}
                        placeholder="Select match value"
                        searchPlaceholder={`Search ${condition.match_field.toLowerCase()}...`}
                        emptyMessage="No values found."
                      />

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeCondition(gi, ci)}
                        title="Remove condition"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => addCondition(gi)}
              >
                <CirclePlus className="size-4" />
                Add Condition
              </Button>
            </div>
          ))}

          <Button variant="outline" onClick={addGroup}>
            <CirclePlus className="size-4" />
            Add Group
          </Button>
        </div>
      </div>
    </CustomModal>
  );
}
