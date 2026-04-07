"use client";

import { toast } from "sonner";

/**
 * Shows a Sonner toast asking for confirmation before executing an action.
 * Returns a promise that resolves to true if confirmed, false if cancelled.
 */
export function confirmToast(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    toast(message, {
      duration: Infinity,
      action: {
        label: "Confirmar",
        onClick: () => resolve(true),
      },
      cancel: {
        label: "Cancelar",
        onClick: () => resolve(false),
      },
      onDismiss: () => resolve(false),
      onAutoClose: () => resolve(false),
    });
  });
}
