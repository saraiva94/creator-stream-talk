import { usePWAInstallPrompt } from "@/hooks/usePWAInstallPrompt";

/**
 * Component that triggers the PWA install notification on first mobile visit.
 * Should be mounted once at the app level.
 */
export function PWAInstallNotification() {
  usePWAInstallPrompt();
  return null;
}
