"use client";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  LayoutList,
  Search,
  Shield,
  ShieldCheck,
  Users,
  Users2,
} from "lucide-react";
import { MessageBox } from "@/components/custom/MessageBox";
import { DashboardCard } from "@/components/custom/DashboardCard";
import { EmptyState } from "@/components/custom/EmptyState";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useUsers } from "@/features/access-control/hooks";
import { UserRolesDialog } from "./_components/UserRolesDialog";
import { UserOverridesDialog } from "./_components/UserOverridesDialog";
const PAGE_SIZE_OPTIONS = [5, 10, 15, 25];

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}
export default function UserAccessPage() {
  const { hasPermission } = useAuthContext();
  const canManageRoles = hasPermission("manage_roles");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [rolesTarget, setRolesTarget] = useState(null);
  const [overridesTarget, setOverridesTarget] = useState(null);
  const { data, error, isLoading, mutate } = useUsers(searchTerm, page, perPage, canManageRoles);
  const users = data?.items ?? [];
  const roles = data?.roles ?? [];
  const menus = data?.menus ?? [];
  const pagination = data?.pagination ?? {
    current_page: 1,
    last_page: 1,
    per_page: perPage,
    total: 0,
  };
  const stats = useMemo(() => {
    const withRoles = users.filter((u) => u.effective_roles.length > 0).length;
    const withOverrides = users.filter((u) => u.override_count > 0).length;
    const uniqueRoles = new Set(users.flatMap((u) => u.effective_roles.map((r) => r.id))).size;

    return { withRoles, withOverrides, uniqueRoles };
  }, [users]);

  const applySearch = () => {
    const term = searchInput.trim();

    setSearchTerm(term);
    setPage(1);
  };
  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.last_page) return;
    setPage(nextPage);
  };
  const handlePerPageChange = (value) => {
    setPerPage(Number(value));
    setPage(1);
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

  const from = pagination.total === 0 ? 0 : (pagination.current_page - 1) * pagination.per_page + 1;
  const to = Math.min(pagination.current_page * pagination.per_page, pagination.total);

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight">User Access</h1>
          <p className="text-sm text-muted-foreground">
            Assign explicit roles and additive menu overrides per user.
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard
            value={isLoading ? "—" : String(pagination.total)}
            label="Total Users"
            icon={Users2}
            variant="primary"
            className="shadow-sm"
          />
          <DashboardCard
            value={isLoading ? "—" : String(stats.withRoles)}
            label="With Roles"
            icon={ShieldCheck}
            variant="success"
            className="shadow-sm"
          />
          <DashboardCard
            value={isLoading ? "—" : String(stats.uniqueRoles)}
            label="Unique Roles"
            icon={Shield}
            variant="info"
            className="shadow-sm"
          />
          <DashboardCard
            value={isLoading ? "—" : String(stats.withOverrides)}
            label="With Overrides"
            icon={LayoutList}
            variant="secondary"
            className="shadow-sm"
          />
        </div>
      </div>

      {error && <MessageBox variant="error">Unable to load user access data.</MessageBox>}

      {/* Main content card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Users</CardTitle>
              <CardDescription>
                {isLoading ? "Loading..." : `${pagination.total} users found`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applySearch();
                  }}
                  placeholder="Search name, employee no, dept..."
                  className="w-64 pl-9"
                />
              </div>
              <Button size="sm" onClick={applySearch}>
                Search
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-1 p-6">
              {Array.from({ length: perPage }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="size-9 shrink-0 rounded-full" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="ml-8 h-4 w-24" />
                  <Skeleton className="ml-auto h-5 w-16" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">User</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Effective Roles</TableHead>
                    <TableHead className="text-center">Overrides</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-0">
                        <EmptyState
                          icon={Users}
                          title="No users found"
                          description={
                            searchTerm
                              ? "No users match your search criteria. Try different terms."
                              : "No users are available in the system."
                          }
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {users.map((user) => (
                    <TableRow key={user.employee_no}>
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-3">
                          <Avatar size="default">
                            <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                              {getInitials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{user.full_name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {user.employee_no}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{user.department}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.section} &middot; {user.position}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.effective_roles.length === 0 && (
                            <Badge variant="outline" className="text-muted-foreground">
                              No Role
                            </Badge>
                          )}
                          {user.effective_roles.map((role) => (
                            <Badge key={`${user.employee_no}:${role.id}`} variant="secondary">
                              {role.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {user.override_count > 0 ? (
                          <Badge variant="info" size="sm">
                            {user.override_count}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
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
                            <DropdownMenuItem onClick={() => setRolesTarget(user)}>
                              <ShieldCheck />
                              Edit Roles
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setOverridesTarget(user)}>
                              <LayoutList />
                              Edit Menu Overrides
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Footer: pagination + per-page selector */}
              <div className="flex items-center justify-between border-t px-6 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Rows per page</span>
                  <Select value={String(perPage)} onValueChange={handlePerPageChange}>
                    <SelectTrigger size="sm" className="h-7 w-16 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {pagination.total > 0
                      ? `${from}\u2013${to} of ${pagination.total}`
                      : "0 results"}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => handlePageChange(pagination.current_page - 1)}
                      disabled={pagination.current_page <= 1}
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() => handlePageChange(pagination.current_page + 1)}
                      disabled={pagination.current_page >= pagination.last_page}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <UserRolesDialog
        user={rolesTarget}
        roles={roles}
        onClose={() => setRolesTarget(null)}
        onSaved={() => mutate()}
      />

      <UserOverridesDialog
        user={overridesTarget}
        menus={menus}
        onClose={() => setOverridesTarget(null)}
        onSaved={() => mutate()}
      />
    </div>
  );
}
