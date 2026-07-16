import { ApiError, deleteSubscription, fetchVapidPublicKey, registerSubscription } from "./lib/api";
import { getExistingSubscription, isPushSupported, subscribeToPush } from "./lib/push";
import { clearStoredPasscode, getStoredPasscode, setStoredPasscode } from "./lib/passcode";

type Status =
  | "checking"
  | "unsupported"
  | "permission-denied"
  | "not-subscribed"
  | "subscribing"
  | "subscribed"
  | "unsubscribing";

interface State {
  status: Status;
  error: string | null;
  /** Which action to resume once the passcode form (shown when non-null) is submitted. */
  passcodePromptFor: "subscribe" | "unsubscribe" | null;
}

const STATUS_LABELS: Record<Status, string> = {
  checking: "Memeriksa status…",
  unsupported: "Perangkat/browser ini tidak mendukung notifikasi push",
  "permission-denied": "Izin notifikasi ditolak",
  "not-subscribed": "Belum berlangganan",
  subscribing: "Sedang berlangganan…",
  subscribed: "Berlangganan",
  unsubscribing: "Sedang berhenti berlangganan…",
};

export async function startApp(
  registrationPromise: Promise<ServiceWorkerRegistration | undefined>,
): Promise<void> {
  const app = document.getElementById("app");
  if (!app) {
    throw new Error("App element not found");
  }

  renderScreen(app, { status: "checking", error: null, passcodePromptFor: null });

  const registration = await registrationPromise;
  if (!registration || !isPushSupported()) {
    renderScreen(app, { status: "unsupported", error: null, passcodePromptFor: null });
    return;
  }

  // Wait for an *active* worker — pushManager.subscribe() needs one, and
  // register() alone can resolve while the worker is still installing.
  const readyRegistration = await navigator.serviceWorker.ready;
  runApp(app, readyRegistration);
}

function runApp(app: HTMLElement, registration: ServiceWorkerRegistration): void {
  let state: State = { status: "checking", error: null, passcodePromptFor: null };

  function setState(patch: Partial<State>): void {
    state = { ...state, ...patch };
    renderScreen(app, state);
    attachHandlers();
  }

  function attachHandlers(): void {
    document
      .getElementById("subscribe-btn")
      ?.addEventListener("click", () => void handleSubscribeClick());
    document
      .getElementById("unsubscribe-btn")
      ?.addEventListener("click", () => void handleUnsubscribeClick());
    document.getElementById("passcode-form")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.getElementById("passcode-input") as HTMLInputElement | null;
      const value = input?.value.trim() ?? "";
      if (value.length > 0) {
        void handlePasscodeSubmit(value);
      }
    });
    document.getElementById("passcode-cancel")?.addEventListener("click", () => {
      setState({ passcodePromptFor: null, error: null });
    });
  }

  async function handleSubscribeClick(): Promise<void> {
    setState({ error: null });

    if (Notification.permission === "denied") {
      setState({ status: "permission-denied" });
      return;
    }
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState({ status: "permission-denied" });
        return;
      }
      if (permission !== "granted") {
        setState({ error: "Izin notifikasi diperlukan untuk berlangganan." });
        return;
      }
    }

    const passcode = getStoredPasscode();
    if (!passcode) {
      setState({ passcodePromptFor: "subscribe" });
      return;
    }
    await subscribe(passcode);
  }

  async function handleUnsubscribeClick(): Promise<void> {
    setState({ error: null });
    const passcode = getStoredPasscode();
    if (!passcode) {
      setState({ passcodePromptFor: "unsubscribe" });
      return;
    }
    await unsubscribe(passcode);
  }

  async function handlePasscodeSubmit(passcode: string): Promise<void> {
    const action = state.passcodePromptFor;
    setState({ passcodePromptFor: null });
    if (action === "subscribe") {
      await subscribe(passcode);
    } else if (action === "unsubscribe") {
      await unsubscribe(passcode);
    }
  }

  async function subscribe(passcode: string): Promise<void> {
    setState({ status: "subscribing", error: null });
    let pushSubscription: PushSubscription | undefined;
    try {
      const vapidPublicKey = await fetchVapidPublicKey();
      pushSubscription = await subscribeToPush(registration, vapidPublicKey);
      await registerSubscription(pushSubscription.toJSON(), passcode);
      setStoredPasscode(passcode);
      setState({ status: "subscribed" });
    } catch (error) {
      await pushSubscription?.unsubscribe();
      const wrongPasscode = error instanceof ApiError && error.status === 401;
      if (wrongPasscode) {
        clearStoredPasscode();
      }
      setState({
        status: "not-subscribed",
        error: error instanceof Error ? error.message : "Gagal berlangganan",
        passcodePromptFor: wrongPasscode ? "subscribe" : null,
      });
    }
  }

  async function unsubscribe(passcode: string): Promise<void> {
    setState({ status: "unsubscribing", error: null });
    try {
      const current = await getExistingSubscription(registration);
      if (current) {
        await deleteSubscription(current.endpoint, passcode);
        await current.unsubscribe();
      }
      setState({ status: "not-subscribed" });
    } catch (error) {
      const wrongPasscode = error instanceof ApiError && error.status === 401;
      setState({
        status: "subscribed",
        error: error instanceof Error ? error.message : "Gagal berhenti berlangganan",
        passcodePromptFor: wrongPasscode ? "unsubscribe" : null,
      });
    }
  }

  void (async () => {
    if (Notification.permission === "denied") {
      setState({ status: "permission-denied" });
      return;
    }
    // A PushSubscription found here means an earlier subscribe() completed
    // (that's the only place one is created), so it was also registered
    // with the API at the time — good enough for R2's status screen.
    const existing = await getExistingSubscription(registration);
    setState({ status: existing ? "subscribed" : "not-subscribed" });
  })();
}

function renderScreen(app: HTMLElement, state: State): void {
  let actionHtml = "";
  if (state.status === "not-subscribed" || state.status === "permission-denied") {
    const label = state.status === "permission-denied" ? "Coba Lagi" : "Berlangganan";
    actionHtml = `<button id="subscribe-btn" class="btn btn-primary" type="button">${label}</button>`;
  } else if (state.status === "subscribed") {
    actionHtml = `<button id="unsubscribe-btn" class="btn btn-secondary" type="button">Berhenti Berlangganan</button>`;
  }

  const errorHtml = state.error ? `<p class="status-error">${state.error}</p>` : "";

  let passcodeHtml = "";
  if (state.passcodePromptFor !== null) {
    passcodeHtml = `
      <form id="passcode-form" class="passcode-form">
        <label for="passcode-input">Masukkan passcode staf</label>
        <input
          id="passcode-input"
          name="passcode"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          required
          autofocus
        />
        <div class="passcode-actions">
          <button type="submit" class="btn btn-primary">Lanjutkan</button>
          <button type="button" id="passcode-cancel" class="btn btn-ghost">Batal</button>
        </div>
      </form>
    `;
  }

  app.innerHTML = `
    <main class="screen">
      <img class="logo" src="${import.meta.env.BASE_URL}favicon.svg" alt="" />
      <h1>Bell Penerima Game Master</h1>
      <p class="subtitle">
        Aplikasi ini menampilkan notifikasi saat ada panggilan game master dari meja pelanggan.
      </p>
      <div class="status-card">
        <p class="status-label">Status</p>
        <p class="status-value">${STATUS_LABELS[state.status]}</p>
        ${errorHtml}
        ${actionHtml}
      </div>
      ${passcodeHtml}
    </main>
  `;
}
