const KEY = "uxuri:unread-channels";
const EVENT = "uxuri:unread-change";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function write(set: Set<string>) {
  localStorage.setItem(KEY, JSON.stringify([...set]));
  window.dispatchEvent(new Event(EVENT));
}

export function getUnread(): Set<string> {
  return read();
}

export function addUnread(channelId: string) {
  const s = read();
  if (s.has(channelId)) return; // no change — skip event dispatch
  s.add(channelId);
  write(s);
}

export function removeUnread(channelId: string) {
  const s = read();
  if (!s.has(channelId)) return;
  s.delete(channelId);
  write(s);
}

export const UNREAD_EVENT = EVENT;
