import { useState, useEffect, useCallback } from "react";
import { api } from "../services/api";

type PushState = "unsupported" | "denied" | "subscribed" | "unsubscribed" | "loading";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications() {
  const [state, setState] = useState<PushState>("loading");
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      setRegistration(reg);
      return reg.pushManager.getSubscription();
    }).then((sub) => {
      if (Notification.permission === "denied") { setState("denied"); return; }
      setState(sub ? "subscribed" : "unsubscribed");
    }).catch(() => setState("unsupported"));
  }, []);

  const subscribe = useCallback(async () => {
    if (!registration) return;
    setState("loading");
    try {
      const { data: vapidPublicKey } = await api.settings.getVapidPublicKey();
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey).buffer as ArrayBuffer,
      });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api.settings.savePushSubscription(json.endpoint, json.keys);
      setState("subscribed");
    } catch (err) {
      if (Notification.permission === "denied") setState("denied");
      else setState("unsubscribed");
      throw err;
    }
  }, [registration]);

  const unsubscribe = useCallback(async () => {
    if (!registration) return;
    setState("loading");
    try {
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await api.settings.deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("unsubscribed");
    } catch {
      setState("subscribed");
    }
  }, [registration]);

  return { state, subscribe, unsubscribe };
}
