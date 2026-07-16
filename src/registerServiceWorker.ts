export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator)) {
    return undefined;
  }

  const swUrl = `${import.meta.env.BASE_URL}sw.js`;
  // type: "module" lets sw.js `import` ./notification.js directly (R3).
  return navigator.serviceWorker.register(swUrl, { type: "module" });
}
