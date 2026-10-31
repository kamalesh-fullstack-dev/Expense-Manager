"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    // In development, remove any worker left behind so it cannot serve stale builds.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
      void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
      return;
    }

    // Hydration can finish after the window load event, so register straight away.
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Ignore registration failures; the app still works as a standard web app.
    });
  }, []);

  return null;
}
