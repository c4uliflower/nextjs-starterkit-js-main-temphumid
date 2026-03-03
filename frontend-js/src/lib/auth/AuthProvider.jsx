"use client";
import { useMemo, useState, useEffect, useCallback } from "react";
import { TOKEN_KEY } from "../constants";
import { setSession, isValidToken } from "./AuthSession";
import { AuthContext } from "./AuthContext";
import axios from "@/lib/axios";

function isRecord(value) {
  return typeof value === "object" && value !== null;
}
function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
function isMenuGroupArray(value) {
  if (!Array.isArray(value)) return false;

  return value.every((group) => {
    if (!isRecord(group)) return false;
    if (typeof group.label !== "string") return false;
    if (!Array.isArray(group.items)) return false;

    return true;
  });
}
function normalizeRole(value) {
  if (!isRecord(value)) {
    return null;
  }

  return {
    id: Number(value.id ?? 0),
    key: String(value.key ?? ""),
    name: String(value.name ?? ""),
    description: typeof value.description === "string" ? value.description : null,
  };
}
function normalizeAuthPayload(payload) {
  if (!isRecord(payload)) {
    throw new Error("Invalid auth payload.");
  }

  const payloadData = isRecord(payload.data) ? payload.data : payload;
  const legacyUser = payloadData;
  const profile = isRecord(payloadData.profile) ? payloadData.profile : legacyUser;
  const roles = Array.isArray(payloadData.roles)
    ? payloadData.roles.map((entry) => normalizeRole(entry)).filter((entry) => entry !== null)
    : [];

  return {
    profile,
    roles,
    permissions: isStringArray(payloadData.permissions) ? payloadData.permissions : [],
    sidebar: isMenuGroupArray(payloadData.sidebar) ? payloadData.sidebar : [],
  };
}
export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    loading: true,
  });
  const checkUserSession = useCallback(async () => {
    try {
      const accessToken = localStorage.getItem(TOKEN_KEY);

      if (accessToken && isValidToken(accessToken)) {
        setSession(accessToken);
        const res = await axios.get("/api/auth/user");
        const normalizedUser = normalizeAuthPayload(res.data);

        setState({
          user: {
            data: normalizedUser,
            accessToken,
          },
          loading: false,
        });

        return true;
      } else {
        setState({ user: null, loading: false });

        return false;
      }
    } catch (error) {
      console.error(error);
      setState({ user: null, loading: false });

      return false;
    }
  }, []);

  useEffect(() => {
    checkUserSession();
  }, []);
  // ----------------------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      await axios.post("/api/auth/logout");
    } catch (error) {
      console.error("Logout API error:", error);
    }

    await setSession(null);
    setState({ user: null, loading: false });
    const ssoLogin =
      process.env.NEXT_PUBLIC_MAT_GALLERY ?? process.env.NEXT_PUBLIC_MAT_GALLERY_URL ?? "";

    window.location.href = ssoLogin;
  }, []);
  const checkAuthenticated = state.user ? "authenticated" : "unauthenticated";
  const status = state.loading ? "loading" : checkAuthenticated;
  const permissions = useMemo(
    () => state.user?.data.permissions ?? [],
    [state.user?.data.permissions],
  );
  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const hasPermission = useCallback(
    (permission) => {
      if (!permission) {
        return true;
      }

      return permissionSet.has(permission);
    },
    [permissionSet],
  );
  const memoizedValue = useMemo(
    () => ({
      user: state.user
        ? {
            ...state.user,
          }
        : null,
      checkUserSession,
      loading: status === "loading",
      authenticated: status === "authenticated",
      unauthenticated: status === "unauthenticated",
      permissions,
      hasPermission,
      logout,
    }),
    [checkUserSession, hasPermission, logout, permissions, state.user, status],
  );

  return <AuthContext.Provider value={memoizedValue}>{children}</AuthContext.Provider>;
}
