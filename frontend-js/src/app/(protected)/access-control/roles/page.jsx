"use client";
import { useMemo, useState } from "react";
import {
  Edit3,
  EllipsisVertical,
  LayoutList,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { MessageBox } from "@/components/custom/MessageBox";
import { CustomModal } from "@/components/custom/CustomModal";
import { DashboardCard } from "@/components/custom/DashboardCard";
import { EmptyState } from "@/components/custom/EmptyState";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthContext } from "@/lib/auth/AuthHook";
import { deleteRole } from "@/features/access-control/api";
import { useRoles } from "@/features/access-control/hooks";
import { RoleFormDialog } from "./_components/RoleFormDialog";
import { RoleMenusDialog } from "./_components/RoleMenusDialog";

export default function RoleManagementPage() {
  const { hasPermission } = useAuthContext();
  const canManageRoles = hasPermission("manage_roles");
  const { data, error, isLoading, mutate } = useRoles(canManageRoles);
  const roles = data?.roles ?? [];
  const menus = data?.menus ?? [];
  const [search, setSearch] = useState("");
  const [formTarget, setFormTarget] = useState(null);
  const [menusTarget, setMenusTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const summary = useMemo(() => {
    const total = roles.length;
    const active = roles.filter((r) => r.is_active).length;
    const defaultCount = roles.filter((r) => r.is_default).length;
    const totalUsers = roles.reduce((sum, r) => sum + r.users_count, 0);

    return { total, active, defaultCount, totalUsers };
  }, [roles]);
  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return roles;

    return roles.filter((r) => {
      const haystack = `${r.name} ${r.key} ${r.description ?? ""}`.toLowerCase();

      return haystack.includes(term);
    });
  }, [roles, search]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      await deleteRole(deleteTarget.id);
      await mutate();
      setDeleteTarget(null);
      toast.success("Role deleted successfully.");
    } catch {
      toast.error("Role cannot be deleted while assigned or used by active rules.");
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
            <h1 className="text-xl font-bold tracking-tight">Role Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage reusable roles and assign menu scope that drives navigation.
            </p>
          </div>
          <Button onClick={() => setFormTarget("new")}>
            <Plus className="size-4" />
            New Role
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            value={isLoading ? "—" : String(summary.total)}
            label="Total Roles"
            icon={Shield}
            variant="primary"
            className="shadow-sm"
          />
          <DashboardCard
            value={isLoading ? "—" : String(summary.active)}
            label="Active"
            icon={ShieldCheck}
            variant="success"
            className="shadow-sm"
          />
          <DashboardCard
            value={isLoading ? "—" : String(summary.defaultCount)}
            label="Default Roles"
            icon={LayoutList}
            variant="info"
            className="shadow-sm"
          />
          <DashboardCard
            value={isLoading ? "—" : String(summary.totalUsers)}
            label="Users Assigned"
            icon={Users}
            variant="secondary"
            className="shadow-sm"
          />
        </div>
      </div>

      {error && <MessageBox variant="error">Unable to load role management data.</MessageBox>}

      {/* Roles table card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Role Registry</CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${filteredRoles.length} of ${roles.length} roles`}
              </CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, key..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-1 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="h-5 w-36" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-10" />
                  <Skeleton className="ml-auto h-5 w-12" />
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Menus</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="p-0">
                      <EmptyState
                        icon={Shield}
                        title={
                          search.trim() ? "No roles match your search" : "No roles created yet"
                        }
                        description={
                          search.trim()
                            ? "Try adjusting your search terms."
                            : "Create your first role to get started."
                        }
                        actionLabel={search.trim() ? undefined : "Create First Role"}
                        onAction={search.trim() ? undefined : () => setFormTarget("new")}
                      />
                    </TableCell>
                  </TableRow>
                )}
                {filteredRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
                          <Shield className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{role.name}</p>
                            {role.is_default && (
                              <Badge variant="info" size="sm">
                                Default
                              </Badge>
                            )}
                          </div>
                          <p className="font-mono text-xs text-muted-foreground">{role.key}</p>
                        </div>
                      </div>
                      {role.description && (
                        <p className="mt-0.5 ml-11 max-w-md text-xs text-muted-foreground">
                          {role.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={role.is_active ? "success" : "outline"}>
                        {role.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{role.menu_ids.length}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{role.users_count}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-xs">
                            <EllipsisVertical className="size-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setFormTarget(role)}>
                            <Edit3 />
                            Edit Role
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setMenusTarget(role)}>
                            <LayoutList />
                            Edit Menu Scope
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(role)}
                          >
                            <Trash2 />
                            Delete Role
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RoleFormDialog
        target={formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={() => mutate()}
      />

      <RoleMenusDialog
        role={menusTarget}
        menus={menus}
        onClose={() => setMenusTarget(null)}
        onSaved={() => mutate()}
      />

      {/* Delete confirmation dialog */}
      <CustomModal
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Role"
        description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.name}"?` : ""}
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
          This action cannot be undone. The role will be permanently removed. Roles that are
          currently assigned to users or referenced by active rules cannot be deleted.
        </p>
      </CustomModal>
    </div>
  );
}
