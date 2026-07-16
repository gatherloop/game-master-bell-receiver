/**
 * Staff passcode, entered once and kept locally so re-subscribing (or a
 * reload) doesn't ask again (PRD-v2 §8 open question 2: store after first
 * entry).
 */
const STORAGE_KEY = "gmb-receiver-passcode";

export function getStoredPasscode(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setStoredPasscode(passcode: string): void {
  localStorage.setItem(STORAGE_KEY, passcode);
}

export function clearStoredPasscode(): void {
  localStorage.removeItem(STORAGE_KEY);
}
