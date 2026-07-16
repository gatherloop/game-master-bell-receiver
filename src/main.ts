import "./style.css";
import { registerServiceWorker } from "./registerServiceWorker";
import { startApp } from "./app";

void startApp(registerServiceWorker());
