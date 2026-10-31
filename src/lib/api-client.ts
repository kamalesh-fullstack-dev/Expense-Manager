"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

// Loads JSON and keeps the last good result on screen while refetching. A stale
// response is dropped, so a slow earlier search can never replace a newer one.
export function useApiData<T>(url: string, initial: T) {
  const router = useRouter();
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key: string; data: T; failed: boolean }>({ key: "", data: initial, failed: false });
  const key = `${url}#${version}`;

  useEffect(() => {
    let cancelled = false;

    fetch(url)
      .then((response) => {
        if (response.status === 401) {
          router.replace("/login");
        }

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        return response.json() as Promise<T>;
      })
      .then((data) => {
        if (!cancelled) setState({ key, data, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState((current) => ({ ...current, key, failed: true }));
      });

    return () => {
      cancelled = true;
    };
  }, [url, key, router]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return { data: state.data, loading: state.key !== key, failed: state.failed, reload };
}

const noItems: never[] = [];

export function useApiList<T>(url: string) {
  const { data, ...rest } = useApiData<T[]>(url, noItems);

  return { items: data, ...rest };
}

// Sends a change and returns the server's error message, or null on success.
export async function sendJson(url: string, method: "POST" | "PUT" | "DELETE", body?: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (response.ok) return null;

    const data = await response.json().catch(() => null);
    return typeof data?.error === "string" ? data.error : "Something went wrong. Please try again.";
  } catch {
    return "Could not reach the server. Check your connection and try again.";
  }
}
