"use client";
import { createContext } from "react";

/** @type {import("react").Context<import("./types").AuthContextValue | undefined>} */
export const AuthContext = createContext(undefined);
export const AuthConsumer = AuthContext.Consumer;
