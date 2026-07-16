import "./style.css";
import { registerServiceWorker } from "./registerServiceWorker";

function render(): void {
  const app = document.getElementById("app");
  if (!app) {
    throw new Error("App element not found");
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
        <p class="status-value">Belum berlangganan</p>
      </div>
    </main>
  `;
}

render();
void registerServiceWorker();
