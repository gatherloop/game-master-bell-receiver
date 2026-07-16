export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (!("serviceWorker" in navigator)) {
    return undefined;
  }

  const swUrl = `${import.meta.env.BASE_URL}sw.js`;
  return navigator.serviceWorker.register(swUrl);
}
