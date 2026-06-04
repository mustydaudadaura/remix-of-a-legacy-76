import { useEffect, useState, useCallback } from "react";

const TOKEN_KEY = "parent_token";
const PARENT_KEY = "parent_info";

export interface ParentInfo { id: string; full_name: string; school_id: string }

export function getParentToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function getParentInfo(): ParentInfo | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PARENT_KEY);
  return raw ? (JSON.parse(raw) as ParentInfo) : null;
}
export function setParentSession(token: string, parent: ParentInfo) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PARENT_KEY, JSON.stringify(parent));
}
export function clearParentSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PARENT_KEY);
}

export function useParentAuth() {
  const [parent, setParent] = useState<ParentInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setParent(getParentInfo());
    setToken(getParentToken());
    setReady(true);
  }, []);

  const signOut = useCallback(() => {
    clearParentSession();
    setParent(null);
    setToken(null);
  }, []);

  return { parent, token, ready, signOut };
}
