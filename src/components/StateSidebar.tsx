"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  CODE_LENGTH,
  STATUS_LABEL,
  type PasscodeState,
} from "@/lib/passcode-machine";
import {
  KEY_MAP,
  SCENARIOS,
  SCENARIO_GROUPS,
  type Scenario,
} from "@/lib/scenarios";

interface Props {
  state: PasscodeState;
  activeId: string | null;
  playingId: string | null;
  onSelect: (scenario: Scenario) => void;
  collapsed: boolean;
  onToggle: () => void;
  /** On narrow screens the panel floats over the stage instead of beside it. */
  overlay: boolean;
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--muted)",
  margin: "0 0 8px",
  paddingLeft: 10,
};

export function StateSidebar({
  state,
  activeId,
  playingId,
  onSelect,
  collapsed,
  onToggle,
  overlay,
}: Props) {
  const reduced = useReducedMotion() ?? false;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="ring-focus"
        aria-label="Show state panel"
        aria-expanded={false}
        style={{
          position: "fixed",
          left: 16,
          top: 16,
          zIndex: 20,
          width: 32,
          height: 32,
          display: "grid",
          placeItems: "center",
          borderRadius: 8,
          border: "1px solid var(--border)",
          background: "var(--background)",
          color: "var(--muted)",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        ›
      </button>
    );
  }

  const panel = (
    <motion.aside
      initial={
        overlay ? { x: reduced ? 0 : "-100%", opacity: reduced ? 0 : 1 } : false
      }
      animate={{ x: 0, opacity: 1 }}
      transition={
        reduced
          ? { duration: 0.12 }
          : { type: "spring", stiffness: 520, damping: 44 }
      }
      style={{
        // Never let the panel swallow a 320px viewport at 200% zoom.
        width: "min(268px, 86vw)",
        flexShrink: 0,
        height: "100%",
        overflowY: "auto",
        background: "var(--panel)",
        borderRight: "1px solid var(--border)",
        padding: "20px 14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        ...(overlay
          ? {
              position: "fixed" as const,
              left: 0,
              top: 0,
              height: "100dvh",
              zIndex: 30,
              boxShadow: "0 0 40px rgba(0,0,0,0.10)",
            }
          : null),
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          paddingLeft: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Square frame with the crop pulled up: the portrait is taller
              than it is wide, so centring the box would cut off the face. */}
          <Image
            src="/logo.png"
            alt=""
            aria-hidden="true"
            width={34}
            height={34}
            priority
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: 8,
              border: "1px solid var(--border)",
              objectFit: "cover",
              objectPosition: "50% 22%",
              background: "var(--background)",
            }}
          />
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-color-1)",
                letterSpacing: "-0.01em",
              }}
            >
              Passcode
            </h1>
            <p
              style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}
            >
              State machine
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="ring-focus"
          aria-label="Hide state panel"
          title="Hide panel to compare against Figma"
          style={{
            width: 24,
            height: 24,
            display: "grid",
            placeItems: "center",
            borderRadius: 6,
            border: "1px solid transparent",
            background: "transparent",
            color: "var(--muted)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ‹
        </button>
      </header>

      {SCENARIO_GROUPS.filter((g) => g !== "Interactions").map((group) => (
        <section key={group}>
          <h2 style={LABEL_STYLE}>{group}</h2>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {SCENARIOS.filter((s) => s.group === group).map((scenario) => {
              const isActive = scenario.id === activeId;
              return (
                <li key={scenario.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(scenario)}
                    className="ring-focus sidebar-item"
                    data-active={isActive}
                    aria-current={isActive ? "true" : undefined}
                    style={{
                      position: "relative",
                      width: "100%",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "7px 10px",
                      borderRadius: 8,
                      border: "1px solid transparent",
                      background: "transparent",
                      color: isActive
                        ? "var(--text-color-1)"
                        : "var(--muted)",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="sidebar-active"
                        transition={
                          reduced
                            ? { duration: 0 }
                            : { type: "spring", stiffness: 500, damping: 40 }
                        }
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 8,
                          background: "var(--background)",
                          border: "1px solid var(--border)",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                        }}
                      />
                    )}
                    <span
                      aria-hidden="true"
                      style={{
                        position: "relative",
                        width: 5,
                        height: 5,
                        // Sits on the label's first line, not the block's middle.
                        marginTop: 6,
                        borderRadius: 999,
                        flexShrink: 0,
                        background: isActive
                          ? "var(--highlight)"
                          : "var(--border)",
                        transition: "background 160ms",
                      }}
                    />
                    <span
                      style={{
                        position: "relative",
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        minWidth: 0,
                      }}
                    >
                      {scenario.label}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 400,
                          lineHeight: 1.35,
                          color: "var(--muted)",
                        }}
                      >
                        {scenario.subtitle}
                      </span>
                    </span>
                    {scenario.inFigma && (
                      <span
                        title="This frame exists in the Figma file"
                        style={{
                          position: "relative",
                          marginTop: 3,
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: "0.06em",
                          color: isActive ? "var(--highlight)" : "var(--border)",
                        }}
                      >
                        FIG
                      </span>
                    )}
                    {playingId === scenario.id && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: "relative",
                          marginTop: 2,
                          fontSize: 10,
                          color: "var(--highlight)",
                        }}
                      >
                        ▸
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section>
        <h2 style={LABEL_STYLE}>Keyboard</h2>
        <dl
          style={{
            margin: 0,
            padding: "0 10px",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            columnGap: 10,
            rowGap: 6,
            fontSize: 11.5,
          }}
        >
          {KEY_MAP.map((row) => (
            <div key={row.keys} style={{ display: "contents" }}>
              <dt
                style={{
                  color: "var(--text-color-1)",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {row.keys}
              </dt>
              <dd style={{ margin: 0, color: "var(--muted)" }}>{row.does}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* The blurb lives in a fixed slot rather than under the selected row:
          expanding inline shifts every item below it, so the state you meant
          to click next moves out from under the cursor. */}
      <section style={{ marginTop: "auto", paddingTop: 16 }}>
        <div
          style={{
            minHeight: 34,
            padding: "0 10px",
            display: "flex",
            alignItems: "flex-end",
          }}
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.p
              key={activeId ?? "none"}
              initial={{ opacity: 0, y: reduced ? 0 : 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -3 }}
              transition={{ duration: reduced ? 0 : 0.14 }}
              style={{
                margin: 0,
                fontSize: 11.5,
                lineHeight: 1.45,
                color: "var(--muted)",
              }}
            >
              {SCENARIOS.find((s) => s.id === activeId)?.blurb ?? ""}
            </motion.p>
          </AnimatePresence>
        </div>
      </section>

      <LiveReadout state={state} />
    </motion.aside>
  );

  if (!overlay) return panel;

  return (
    <>
      <motion.div
        onClick={onToggle}
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduced ? 0 : 0.18 }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 25,
          background: "rgba(20,20,20,0.18)",
        }}
      />
      {panel}
    </>
  );
}

/** A small inspector so the machine's actual state is never a guess. */
function LiveReadout({ state }: { state: PasscodeState }) {
  const cells = Array.from(
    { length: CODE_LENGTH },
    (_, i) => state.code[i] ?? "·",
  );

  return (
    <section>
      <h2 style={LABEL_STYLE}>Live</h2>
      <div
        style={{
          margin: "0 10px",
          padding: "10px 12px",
          borderRadius: 10,
          background: "var(--background)",
          border: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          fontSize: 11.5,
        }}
      >
        <Row label="status">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              color: "var(--text-color-1)",
              fontWeight: 500,
            }}
          >
            <motion.span
              key={state.status}
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 600, damping: 30 }}
              style={{
                width: 5,
                height: 5,
                borderRadius: 999,
                background:
                  state.status === "error"
                    ? "var(--error)"
                    : "var(--highlight)",
              }}
            />
            {STATUS_LABEL[state.status]}
          </span>
        </Row>
        <Row label="buffer">
          <span
            style={{
              fontVariantNumeric: "tabular-nums",
              letterSpacing: "0.24em",
              color: "var(--text-color-1)",
            }}
          >
            {cells.join("")}
          </span>
        </Row>
        <Row label="attempts">
          <span style={{ color: "var(--text-color-1)" }}>{state.attempts}</span>
        </Row>
      </div>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      {children}
    </div>
  );
}
