"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * A quiet line above the stage explaining something the user did not do
 * themselves — a code that arrived prefilled, or an entry restored after a
 * refresh. It is an explanation, not an alert, so it stays out of the way and
 * never blocks anything.
 */
export interface ToastMessage {
  id: number;
  text: string;
}

export function Toast({
  message,
  onDismiss,
}: {
  message: ToastMessage | null;
  onDismiss: () => void;
}) {
  const reduced = useReducedMotion() ?? false;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 40,
        padding: "0 16px",
      }}
    >
      <AnimatePresence>
        {message && (
          <motion.div
            key={message.id}
            // Announced politely: it explains state the user did not create,
            // which a screen reader user needs just as much.
            role="status"
            aria-live="polite"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduced
                ? { opacity: 0, transition: { duration: 0.12 } }
                : {
                    opacity: 0,
                    y: -6,
                    scale: 0.98,
                    transition: { duration: 0.16 },
                  }
            }
            transition={
              reduced
                ? { duration: 0.12 }
                : { type: "spring", stiffness: 480, damping: 34 }
            }
            style={{
              pointerEvents: "auto",
              display: "flex",
              alignItems: "center",
              gap: 10,
              maxWidth: "100%",
              padding: "9px 12px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--background)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--text-color-1)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                flexShrink: 0,
                background: "var(--highlight)",
              }}
            />
            <span style={{ minWidth: 0 }}>{message.text}</span>
            <button
              type="button"
              onClick={onDismiss}
              className="ring-focus"
              aria-label="Dismiss"
              style={{
                flexShrink: 0,
                marginLeft: 2,
                width: 20,
                height: 20,
                display: "grid",
                placeItems: "center",
                borderRadius: 6,
                border: 0,
                background: "transparent",
                color: "var(--muted)",
                fontSize: 14,
                lineHeight: 1,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
