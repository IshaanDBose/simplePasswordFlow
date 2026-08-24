"use client";

import { AnimatePresence, motion } from "motion/react";
import { CODE_LENGTH } from "@/lib/passcode-machine";

export const CELL_W = 84;
export const CELL_H = 128;
export const OUTER_RADIUS = 16;

export type Palette = "default" | "disabled" | "error" | "success";

const PALETTES: Record<Palette, { bg: string; border: string; ink: string }> = {
  default: {
    bg: "var(--fill)",
    border: "var(--border)",
    ink: "var(--text-color-1)",
  },
  disabled: {
    bg: "var(--fill-disabled)",
    border: "var(--border-disabled)",
    ink: "var(--text-color-disabled)",
  },
  error: {
    bg: "var(--error-fill)",
    border: "var(--error-border)",
    ink: "var(--error)",
  },
  success: {
    bg: "#f2f9f5",
    border: "#bfe0ce",
    ink: "var(--highlight)",
  },
};

/**
 * Cells butt up against each other and share their 1px dividers, exactly as
 * the Figma group does: cell 0 carries the left edge and left radii, cell 3
 * the right edge and right radii, and each divider is drawn once.
 */
function edges(index: number): React.CSSProperties {
  // Widths only — borderColor is animated, so the `border` shorthand is
  // avoided here to keep it from clobbering the animated longhand.
  const style: React.CSSProperties = {
    borderStyle: "solid",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  };
  if (index === 0) {
    style.borderLeftWidth = 1;
    style.borderRightWidth = 1;
    style.borderRadius = `${OUTER_RADIUS}px 0 0 ${OUTER_RADIUS}px`;
  } else if (index === CODE_LENGTH - 1) {
    style.borderLeftWidth = 1;
    style.borderRightWidth = 1;
    style.borderRadius = `0 ${OUTER_RADIUS}px ${OUTER_RADIUS}px 0`;
  } else if (index === 1) {
    style.borderRightWidth = 1;
  }
  return style;
}

const ENTER = {
  type: "spring" as const,
  stiffness: 520,
  damping: 30,
  mass: 0.7,
};

interface Props {
  index: number;
  digit: string | null;
  palette: Palette;
  /** Paste fills left to right rather than all at once. */
  enterDelay: number;
  showCaret: boolean;
  reduced: boolean;
}

export function PasscodeCell({
  index,
  digit,
  palette,
  enterDelay,
  showCaret,
  reduced,
}: Props) {
  const tone = PALETTES[palette];

  return (
    <motion.div
      data-cell={index}
      style={{
        position: "relative",
        boxSizing: "border-box",
        width: CELL_W,
        height: CELL_H,
        overflow: "hidden",
        ...edges(index),
      }}
      animate={{
        backgroundColor: tone.bg,
        borderColor: tone.border,
        color: tone.ink,
      }}
      transition={{
        duration: reduced ? 0 : 0.22,
        ease: "easeOut",
        delay: reduced ? 0 : index * 0.035,
      }}
    >
      {/*
        Exactly one child is always mounted — an empty placeholder stands in
        for a blank cell. Conditionally mounting instead lets a key that
        reappears mid-exit revive the outgoing element rather than replace it,
        which strands stale digits on screen.
      */}
      <AnimatePresence initial={false}>
        <motion.span
          key={digit ?? "empty"}
          // Transform and opacity only. A blur read nicely but left the filter
          // track unresolved when a digit was replaced mid-entry, which kept
          // AnimatePresence from ever unmounting the outgoing span.
          initial={
            reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.72 }
          }
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          // Exit runs on a fixed tween, never a spring: a spring settles by
          // approaching rest, and if it is interrupted before it gets there
          // AnimatePresence never hears that it is safe to unmount, leaving
          // invisible digits behind in the DOM for screen readers to find.
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0.1 } }
              : {
                  opacity: 0,
                  y: 10,
                  scale: 0.82,
                  transition: { duration: 0.16, ease: "easeIn" },
                }
          }
          transition={
            reduced ? { duration: 0.12 } : { ...ENTER, delay: enterDelay }
          }
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            // Figma sits the digits ~2px below the cell's geometric centre
            // (baseline at y=79 in a 128px cell). Padding nudges the centred
            // line box down to match without touching `transform`, which the
            // enter/exit animation owns.
            paddingTop: 4,
            fontSize: 36,
            fontWeight: 500,
            lineHeight: "normal",
            color: "inherit",
            userSelect: "none",
          }}
        >
          {digit}
        </motion.span>
      </AnimatePresence>

      {showCaret && digit === null && (
        <span
          className="caret"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 2,
            height: 40,
            marginLeft: -1,
            marginTop: -18, // rides with the digits' 2px optical offset
            borderRadius: 1,
            background: "var(--text-color-1)",
          }}
        />
      )}
    </motion.div>
  );
}
