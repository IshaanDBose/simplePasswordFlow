import { CODE_LENGTH, sanitize } from "./passcode-machine";

/**
 * The only thing kept across a refresh is a partial entry, in `sessionStorage`
 * rather than `localStorage`, so it is scoped to the tab and dies with it.
 */
const DRAFT_KEY = "passcode:draft";

/** sessionStorage throws in private mode on some browsers, and is absent on the server. */
function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readDraft(): string {
  const raw = store()?.getItem(DRAFT_KEY);
  return raw ? sanitize(raw) : "";
}

export function writeDraft(code: string) {
  const s = store();
  if (!s) return;
  // Only a partial entry is worth keeping. Once it is complete it is either
  // in flight or already answered, and restoring it would resubmit on load.
  if (code.length > 0 && code.length < CODE_LENGTH) s.setItem(DRAFT_KEY, code);
  else s.removeItem(DRAFT_KEY);
}

export function clearDraft() {
  store()?.removeItem(DRAFT_KEY);
}

/**
 * A code handed over in the URL, as a magic link would. Read once on load and
 * then stripped from the address bar, so a shared or bookmarked URL does not
 * carry someone's passcode around with it.
 */
export function takeLinkedCode(): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("code");
  if (!raw) return "";
  const code = sanitize(raw);

  params.delete("code");
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    window.location.pathname + (query ? `?${query}` : "") + window.location.hash,
  );

  return code.length === CODE_LENGTH ? code : "";
}
