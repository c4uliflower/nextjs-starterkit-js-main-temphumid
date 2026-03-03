"use client";
import { useMemo, useState } from "react";
import axios from "axios";
import {
  Edit3,
  EllipsisVertical,
  FolderTree,
  GitBranch,
  Link2,
  Network,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { CustomModal } from "@/components/custom/CustomModal";
import { DashboardCard } from "@/components/custom/DashboardCard";
import { EmptyState } from "@/components/custom/EmptyState";
import { MessageBox } from "@/components/custom/MessageBox";
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
import { deleteMenu } from "@/features/access-control/api";
import {
  buildManagedMenuTree,
  filterManagedMenuTree,
  flattenManagedMenuTree,
} from "@/features/access-control/menu-management-utils";
import { useMenus } from "@/features/access-control/hooks";
import { useAuthContext } from "@/lib/auth/AuthHook";
import { MenuFormDialog } from "./_components/MenuFormDialog";
import { MenuLinkDialog } from "./_components/MenuLinkDialog";

const EMPTY_MENUS = [];
const EMPTY_PARENT_OPTIONS = [];

function getApiErrorMessage(error, fallback) {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const message = error.response?.data?.message;

  return typeof message === "string" && message.trim() !== "" ? message : fallback;
}

function typeBadgeVariant(type) {
  if (type === "group") return "secondary";
  if (type === "header") return "info";

  return "outline";
}

export default function MenuManagementPage() {
  const { hasPermission } = useAuthContext();
  const canManageMenus = hasPermission("manage_roles");
  const { data, error, isLoading, mutate } = useMenus(canManageMenus);
  const menus = data?.menus ?? EMPTY_MENUS;
  const parentOptions = data?.parent_options ?? EMPTY_PARENT_OPTIONS;
  const summary = data?.summary ?? {
    total: 0,
    active: 0,
    linked: 0,
    actionable: 0,
  };
  const [search, setSearch] = useState("");
  const [formTarget, setFormTarget] = useState(null);
  const [linkTarget, setLinkTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const tree = useMemo(() => buildManagedMenuTree(menus), [menus]);
  const searchTerm = search.trim().toLowerCase();
  const matchIds = useMemo(() => {
    if (searchTerm === "") return null;
    const ids = new Set();

    for (const menu of menus) {
      const haystack =
        `${menu.title} ${menu.label} ${menu.path ?? ""} ${menu.permission_key ?? ""} ${menu.type}`.toLowerCase();

      if (haystack.includes(searchTerm)) {
        ids.add(menu.id);
      }
    }

    return ids;
  }, [menus, searchTerm]);
  const displayTree = useMemo(() => {
    if (!matchIds) return tree;

    return filterManagedMenuTree(tree, matchIds);
  }, [tree, matchIds]);
  const rows = useMemo(() => flattenManagedMenuTree(displayTree), [displayTree]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      await deleteMenu(deleteTarget.id);
      await mutate();
      setDeleteTarget(null);
      toast.success("Menu deleted successfully.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Unable to delete menu."));
    } finally {
      setDeleting(false);
    }
  };
  if (!canManageMenus) {
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
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight">Menu Management</h1>
            <p className="text-sm text-muted-foreground">
              Build navigation structure, link hierarchy, and control menu visibility.
            </p>
          </div>
          <Button onClick={() => setFormTarget({ mode: "new", parentId: null })}>
            <Plus className="size-4" />
            New Menu
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            value={isLoading ? "—" : String(summary.total)}
            label="Total Menus"
            icon={Network}
            variant="primary"
            className="shadow-sm"
          />
          <DashboardCard
            value={isLoading ? "—" : String(summary.active)}
            label="Active"
            icon={FolderTree}
            variant="success"
            className="shadow-sm"
          />
          <DashboardCard
            value={isLoading ? "—" : String(summary.linked)}
            label="Linked Nodes"
            icon={Link2}
            variant="info"
            className="shadow-sm"
          />
          <DashboardCard
            value={isLoading ? "—" : String(summary.actionable)}
            label="Actionable Items"
            icon={GitBranch}
            variant="secondary"
            className="shadow-sm"
          />
        </div>
      </div>

      {error && <MessageBox variant="error">Unable to load menu management data.</MessageBox>}

      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Menu Registry</CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${menus.length} menu records`}
              </CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, path, permission..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-1 p-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="size-6 rounded-md" />
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-5 w-14" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="ml-auto h-5 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Menu</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-center">Order</TableHead>
                    <TableHead>Route / Permission</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Links</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <EmptyState
                          icon={Network}
                          title={
                            searchTerm ? "No menus match your search" : "No menus available yet"
                          }
                          description={
                            searchTerm
                              ? "Try adjusting your search terms."
                              : "Create your first menu to build navigation."
                          }
                          actionLabel={searchTerm ? undefined : "Create First Menu"}
                          onAction={
                            searchTerm
                              ? undefined
                              : () => setFormTarget({ mode: "new", parentId: null })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )}

                  {rows.map((row) => (
                    <TableRow key={row.menu.id}>
                      <TableCell className="pl-6">
                        <div
                          className="flex items-center gap-2"
                          style={{ paddingLeft: `${row.depth * 20}px` }}
                        >
                          <div className="flex size-6 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground">
                            {row.hasChildren ? (
                              <GitBranch className="size-3.5" />
                            ) : (
                              <FolderTree className="size-3.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{row.menu.title}</p>
                            {row.menu.label !== row.menu.title && (
                              <p className="truncate text-xs text-muted-foreground">
                                {row.menu.label}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant={typeBadgeVariant(row.menu.type)} size="sm">
                          {row.menu.type}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center">
                        <span className="font-mono text-xs text-muted-foreground">{row.menu.display_order}</span>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-mono text-xs text-muted-foreground">
                            {row.menu.path ?? "\u2014"}
                          </p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {row.menu.permission_key ?? "\u2014"}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge variant={row.menu.is_active ? "success" : "outline"}>
                          {row.menu.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Badge variant="secondary" size="sm">
                            R {row.menu.role_links_count}
                          </Badge>
                          <Badge variant="info" size="sm">
                            U {row.menu.user_overrides_count}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-xs">
                              <EllipsisVertical className="size-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setFormTarget({ mode: "edit", menu: row.menu })}
                            >
                              <Edit3 />
                              Edit Menu
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                setFormTarget({
                                  mode: "new",
                                  parentId: row.menu.id,
                                })
                              }
                              disabled={row.menu.type === "item"}
                            >
                              <Plus />
                              Add Child Menu
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLinkTarget(row.menu)}>
                              <Link2 />
                              Link / Move
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(row.menu)}
                            >
                              <Trash2 />
                              Delete Menu
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <MenuFormDialog
        target={formTarget}
        menus={menus}
        parentOptions={parentOptions}
        onClose={() => setFormTarget(null)}
        onSaved={() => mutate()}
      />

      <MenuLinkDialog
        menu={linkTarget}
        menus={menus}
        parentOptions={parentOptions}
        onClose={() => setLinkTarget(null)}
        onSaved={() => mutate()}
      />

      <CustomModal
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Menu"
        description={
          deleteTarget ? `Delete "${deleteTarget.title}" and its linked descendants?` : ""
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
        {deleteTarget && (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>This action removes the selected menu and all descendants from the hierarchy.</p>
            <p>
              Current impact:{" "}
              <span className="font-medium text-foreground">{deleteTarget.descendant_count}</span>{" "}
              descendant menus. This menu currently carries{" "}
              <span className="font-medium text-foreground">{deleteTarget.role_links_count}</span>{" "}
              role links and{" "}
              <span className="font-medium text-foreground">
                {deleteTarget.user_overrides_count}
              </span>{" "}
              user overrides.
            </p>
            <p>
              Refresh authenticated sessions after major menu tree updates so sidebar changes are
              immediately reflected.
            </p>
          </div>
        )}
      </CustomModal>
    </div>
  );
}
