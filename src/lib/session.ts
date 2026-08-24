import { CODE_LENGTH, CORRECT_CODE, sanitize } from "./passcode-machine";

/**
 * What survives a refresh, and where.
 *
 * `sessionStorage`, not `localStorage`: this is scoped to the one tab and goes
 * away when it closes. A real passcode should not be written to disk at all —
 * a production build would keep an in-progress entry in memory and accept that
 * a refresh loses it, or hold it server-side against a short-lived token. The
 * trade is made here because losing four digits to a stray refresh is the
 * worse failure for a demo, and the "registered" passcode has to live
 * somewhere without a backend.
 */
const DRAFT_KEY = "passcode:draft";
const REGISTERED_KEY = "passcode:registered";

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

export function readRegisteredCode(): string {
  const raw = store()?.getItem(REGISTERED_KEY);
  const code = raw ? sanitize(raw) : "";
  return code.length === CODE_LENGTH ? code : CORRECT_CODE;
}

export function writeRegisteredCode(code: string) {
  store()?.setItem(REGISTERED_KEY, code);
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
