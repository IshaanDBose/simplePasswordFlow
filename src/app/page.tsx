"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PasscodeFlow } from "@/components/PasscodeFlow";
import { StateSidebar } from "@/components/StateSidebar";
import { Toast } from "@/components/Toast";
import { usePasscode } from "@/hooks/usePasscode";
import { MOBILE_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { SCENARIOS, type Scenario } from "@/lib/scenarios";

export default function Home() {
  const {
    state,
    inputRef,
    handlers,
    play,
    playingId,
    focusField,
    reset,
    retry,
    startCreate,
    cancelCreate,
    toast,
    dismissToast,
  } = usePasscode();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const [collapsed, setCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* On a phone the panel would leave nothing for the stage, so it starts
     closed and opens over the top. Crossing the breakpoint either way resets
     it to the sensible default for that size — adjusted during render rather
     than in an effect, so there is no extra pass with the wrong layout. */
  const [wasMobile, setWasMobile] = useState(isMobile);
  if (wasMobile !== isMobile) {
    setWasMobile(isMobile);
    setCollapsed(isMobile);
  }

  /*
   * The highlighted panel item follows the machine, not the click. Selecting a
   * scenario highlights it; typing by hand moves the highlight to whichever
   * scenario describes the state you have arrived at. The panel reads as an
   * inspector rather than a menu.
   */
  const activeId = useMemo(() => {
    if (playingId) return playingId;
    if (
      selectedId &&
      SCENARIOS.find((s) => s.id === selectedId)?.settlesOn === state.status
    ) {
      return selectedId;
    }
    return (
      SCENARIOS.find((s) => s.group === "States" && s.settlesOn === state.status)
        ?.id ?? null
    );
  }, [playingId, selectedId, state.status]);

  const onSelect = useCallback(
    (scenario: Scenario) => {
      setSelectedId(scenario.id);
      play(scenario);
      // The panel is covering the thing it just triggered — get out of the way.
      if (isMobile) setCollapsed(true);
    },
    [play, isMobile],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "\\" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden" }}>
      <StateSidebar
        state={state}
        activeId={activeId}
        playingId={playingId}
        onSelect={onSelect}
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        overlay={isMobile}
      />

      <main
        onPointerDown={(e) => {
          // Clicking anywhere on the stage puts focus back on the field, the
          // way tapping a passcode screen should.
          if ((e.target as HTMLElement).closest("button")) return;
          focusField();
        }}
        style={{
          flex: 1,
          position: "relative",
          background: "var(--background)",
          minWidth: 0,
        }}
      >
        <PasscodeFlow
          state={state}
          inputRef={inputRef}
          handlers={handlers}
          onReset={reset}
          onRetry={retry}
          onStartCreate={startCreate}
          onCancelCreate={cancelCreate}
        />
      </main>

      <Toast message={toast} onDismiss={dismissToast} />
    </div>
  );
}
