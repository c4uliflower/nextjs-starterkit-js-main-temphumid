"use client";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Edit3,
  EllipsisVertical,
  Layers,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { MessageBox } from "@/components/custom/MessageBox";
import { CustomModal } from "@/components/custom/CustomModal";
import { DashboardCard } from "@/components/custom/DashboardCard";
import { EmptyState } from "@/components/custom/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthContext } from "@/lib/auth/AuthHook";
import { deleteRule } from "@/features/access-control/api";
import { useRules } from "@/features/access-control/hooks";
import { RuleFormDialog } from "./_components/RuleFormDialog";

export default function RoleAssignmentRulesPage() {
  const { hasPermission } = useAuthContext();
  const canManageRoles = hasPermission("manage_roles");
  const { data, error, isLoading, mutate } = useRules(canManageRoles);
  const roles = data?.roles ?? [];
  const rules = data?.rules ?? [];
  const fields = data?.fields ?? [];
  const fieldValues = data?.field_values ?? {};
  const [formTarget, setFormTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const summary = useMemo(() => {
    const total = rules.length;
    const totalConditions = rules.reduce(
      (sum, r) => sum + r.groups.reduce((gs, g) => gs + g.conditions.length, 0),
      0,
    );
    const uniqueRoles = new Set(rules.map((r) => r.role_id)).size;
    const totalGroups = rules.reduce((sum, r) => sum + r.groups.length, 0);

    return { total, totalConditions, uniqueRoles, totalGroups };
  }, [rules]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      await deleteRule(deleteTarget.id);
      await mutate();
      setDeleteTarget(null);
      toast.success("Rule deleted successfully.");
    } catch {
      toast.error("Unable to delete rule.");
    } finally {
      setDeleting(false);
    }
  };
  if (!canManageRoles) {
    return (
      <div className="space-y-4 p-6">
        <MessageBox variant="error" title="Insufficient permission">
          You need <code>manage_roles</code> permission to access this page.
        </MessageBox>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight">Role Assignment Rules</h1>
            <p className="text-sm text-muted-foreground">
              Automatic role assignment based on employee attributes.
            </p>
          </div>
          <Button onClick={() => setFormTarget("new")}>
            <Plus className="size-4" />
            New Rule
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            value={isLoading ? "—" : String(summary.total)}
            label="Total Rules"
            icon={Workflow}
            variant="primary"
            className="shadow-sm"
          />
          <DashboardCard
            value={isLoading ? "—" : String(summary.uniqueRoles)}
            label="Target Roles"
            icon={Shield}
            variant="success"
            className="shadow-sm"
          />
          <DashboardCard
            value={isLoading ? "—" : String(summary.totalGroups)}
            label="Condition Groups"
            icon={Layers}
            variant="info"
            className="shadow-sm"
          />
          <DashboardCard
            value={isLoading ? "—" : String(summary.totalConditions)}
            label="Total Conditions"
            icon={ShieldCheck}
            variant="secondary"
            className="shadow-sm"
          />
        </div>
      </div>

      {error && <MessageBox variant="error">Unable to load role assignment rules.</MessageBox>}

      {/* Rule list */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Rules</CardTitle>
          <CardDescription>
            {isLoading
              ? "Loading..."
              : rules.length === 0
                ? "No rules configured yet"
                : `${rules.length} rule${rules.length !== 1 ? "s" : ""} configured`}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading && (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border/70 p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-md" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Separator className="my-3" />
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full rounded-md" />
                    <Skeleton className="h-10 w-full rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {rules.length === 0 && !isLoading && (
            <EmptyState
              icon={Workflow}
              title="No rules configured"
              description="Create your first rule to automatically assign roles based on department, section, or position."
              actionLabel="Create First Rule"
              onAction={() => setFormTarget("new")}
            />
          )}

          {rules.map((rule, index) => (
            <div
              key={rule.id}
              className="group rounded-lg border border-border/70 transition-colors hover:border-border"
            >
              {/* Rule header */}
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/8 text-sm font-bold tabular-nums text-primary">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-3.5 text-primary" />
                      <span className="text-sm font-semibold">
                        {rule.role_name ?? rule.role_key ?? "Unknown role"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Badge variant="outline" size="sm">
                        Priority {rule.priority}
                      </Badge>
                      <Badge variant="secondary" size="sm">
                        {rule.groups.length} group
                        {rule.groups.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                    >
                      <EllipsisVertical className="size-4" />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setFormTarget(rule)}>
                      <Edit3 />
                      Edit Rule
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(rule)}>
                      <Trash2 />
                      Delete Rule
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Separator />

              {/* Collapsible condition groups */}
              <Accordion
                type="multiple"
                defaultValue={rule.groups.map((g, gi) => String(g.id ?? `${rule.id}:${gi}`))}
                className="px-4 py-3"
              >
                {rule.groups.map((group, gi) => (
                  <AccordionItem
                    key={group.id ?? `${rule.id}:${gi}`}
                    value={String(group.id ?? `${rule.id}:${gi}`)}
                    className="rounded-md border border-border/50 bg-muted/20 last:border-b"
                  >
                    <AccordionTrigger className="px-3 py-1.5 hover:no-underline">
                      <span className="text-xs font-medium text-muted-foreground">
                        Group {gi + 1}
                        <span className="ml-1.5 text-muted-foreground/60">
                          &middot; {group.conditions.length} condition
                          {group.conditions.length !== 1 ? "s" : ""}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                      <div className="divide-y divide-border/40 border-t border-border/50">
                        {group.conditions.map((c, ci) => (
                          <div
                            key={c.id ?? `${rule.id}:${gi}:${ci}`}
                            className="flex items-center gap-3 px-3 py-2"
                          >
                            {ci === 0 ? (
                              <Badge variant="outline" size="sm" className="shrink-0">
                                IF
                              </Badge>
                            ) : (
                              <Badge
                                variant={c.condition_operator === "OR" ? "info" : "secondary"}
                                size="sm"
                                className="shrink-0"
                              >
                                {c.condition_operator}
                              </Badge>
                            )}
                            <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                              {c.match_field}
                            </span>
                            <span className="text-xs text-muted-foreground">=</span>
                            <span className="text-sm font-medium">{c.match_value}</span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Info notice */}
      {rules.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="size-4" />
          <AlertTitle>Evaluation order</AlertTitle>
          <AlertDescription>
            Rules are evaluated by priority (lowest first). The first matching rule assigns the
            role. Users with explicit role assignments bypass this engine entirely.
          </AlertDescription>
        </Alert>
      )}

      <RuleFormDialog
        target={formTarget}
        roles={roles}
        fields={fields}
        fieldValues={fieldValues}
        defaultRoleId={roles[0]?.id ?? 0}
        onClose={() => setFormTarget(null)}
        onSaved={() => mutate()}
      />

      {/* Delete confirmation */}
      <CustomModal
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Rule"
        description={
          deleteTarget
            ? `Delete the rule targeting "${deleteTarget.role_name ?? deleteTarget.role_key}"?`
            : ""
        }
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              <Trash2 className="size-4" />
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          This action cannot be undone. The assignment rule will be permanently removed.
        </p>
      </CustomModal>
    </div>
  );
}
