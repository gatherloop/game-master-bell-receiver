/** Thrown when the call API rejects or fails a subscription request. */
export class ApiError extends Error {
  public readonly status?: number;

  constructor(message: string, options?: { status?: number; cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.status = options?.status;
  }
}

function apiUrl(path: string): string {
  return `${import.meta.env.VITE_API_URL}${path}`;
}

/** GET /vapid-key — the public half of the API's VAPID keypair (FR-A7). */
export async function fetchVapidPublicKey(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/vapid-key"));
  } catch (error) {
    throw new ApiError("Tidak bisa menghubungi server", { cause: error });
  }

  if (!response.ok) {
    throw new ApiError(`Gagal mengambil kunci VAPID (${response.status})`, {
      status: response.status,
    });
  }

  const data = (await response.json()) as { publicKey: string };
  return data.publicKey;
}

/** POST /subscriptions — registers this device's PushSubscription (FR-R1). */
export async function registerSubscription(
  subscription: PushSubscriptionJSON,
  passcode: string,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/subscriptions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription, passcode }),
    });
  } catch (error) {
    throw new ApiError("Tidak bisa menghubungi server", { cause: error });
  }

  if (response.status === 401) {
    throw new ApiError("Passcode salah", { status: 401 });
  }
  if (!response.ok) {
    throw new ApiError(`Gagal mendaftarkan langganan (${response.status})`, {
      status: response.status,
    });
  }
}

/** DELETE /subscriptions — removes this device's PushSubscription (FR-R4). */
export async function deleteSubscription(endpoint: string, passcode: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/subscriptions"), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint, passcode }),
    });
  } catch (error) {
    throw new ApiError("Tidak bisa menghubungi server", { cause: error });
  }

  if (response.status === 401) {
    throw new ApiError("Passcode salah", { status: 401 });
  }
  // 404 means the API already has no record of this endpoint — unsubscribe is idempotent.
  if (!response.ok && response.status !== 404) {
    throw new ApiError(`Gagal berhenti berlangganan (${response.status})`, {
      status: response.status,
    });
  }
}
