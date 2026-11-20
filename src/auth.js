export const API = 'https://batloung-farm-production.up.railway.app/api';
export const API_ROOT = API.replace(/\/api$/, '/');

const USERS_KEY = 'batloung_users_v1';
const SESSION_KEY = 'batloung_session_v2';
const LOCK_KEY = 'batloung_lock_v1';

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const rnd = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const norm = (s) => String(s || '').trim().toLowerCase();
export const normCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function digest(secret, salt) {
  if (globalThis.crypto && crypto.subtle) {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 120000 }, key, 256);
    return hex(bits);
  }
  let h = 5381;
  const s = salt + secret;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return 'x' + (h >>> 0).toString(16);
}

function makeCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const r = crypto.getRandomValues(new Uint8Array(12));
  const c = [...r].map((x) => A[x % A.length]).join('');
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}

/* ---------- validation ---------- */
export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e).trim());
export const isUsername = (u) => /^[a-zA-Z0-9._-]{3,20}$/.test(String(u).trim());
export const passwordOk = (p) => p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
export function strength(p) {
  const rules = [p.length >= 8, /[a-z]/.test(p) && /[A-Z]/.test(p), /\d/.test(p), /[^A-Za-z0-9]/.test(p)];
  let score = rules.filter(Boolean).length;
  if (p.length < 8) score = Math.min(score, 1);
  if (!p) score = 0;
  return { score, rules, label: ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'][score] };
}

/* ---------- accounts ---------- */
const users = () => read(USERS_KEY, []);
const pub = (u) => ({ id: u.id, name: u.name, username: u.username, email: u.email, role: u.role, created: u.created });
export const hasUsers = () => users().length > 0;
export const usernameTaken = (u) => users().some((x) => x.username === norm(u));
export const emailTaken = (e) => users().some((x) => x.email === norm(e));

/* ---------- lockout (pauses after 5 wrong tries, then 30s, 60s, 2m... up to 5m) ---------- */
const lockState = () => read(LOCK_KEY, {});
export const lockedUntil = (id) => { const s = lockState()[norm(id)]; return s && s.until > Date.now() ? s.until : 0; };
function fail(id) {
  const all = lockState();
  const k = norm(id);
  const s = all[k] || { n: 0, level: 0, until: 0 };
  s.n += 1;
  if (s.n >= 5) { s.level += 1; s.n = 0; s.until = Date.now() + Math.min(300, 30 * 2 ** (s.level - 1)) * 1000; }
  all[k] = s;
  write(LOCK_KEY, all);
  return s;
}
function clearLock(id) { const all = lockState(); delete all[norm(id)]; write(LOCK_KEY, all); }

/* ---------- session ---------- */
export function startSession(session, remember) {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify({ id: session.id }));
}
export function getSession() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY)); } catch { s = null; }
  if (!s) return null;
  const u = users().find((x) => x.id === s.id);
  return u ? pub(u) : null;
}
export function endSession() { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); }

/* ---------- actions ---------- */
export async function signUp({ name, username, email, password }) {
  try {
    const list = users();
    if (list.some((x) => x.username === norm(username))) return { ok: false, error: 'That username is taken.' };
    if (list.some((x) => x.email === norm(email))) return { ok: false, error: 'An account with that email already exists.' };
    const salt = rnd(16), rcSalt = rnd(16), code = makeCode();
    const user = {
      id: rnd(8), name: name.trim().replace(/\s+/g, ' '), username: norm(username), email: norm(email),
      role: list.length ? 'Staff' : 'Administrator', salt, hash: await digest(password, salt),
      rcSalt, rcHash: await digest(normCode(code), rcSalt), created: Date.now(),
    };
    write(USERS_KEY, [...list, user]);
    return { ok: true, session: pub(user), recoveryCode: code };
  } catch {
    return { ok: false, error: 'Your browser blocked saving the account. Turn off private mode and try again.' };
  }
}

export async function logIn(id, password, remember) {
  const key = norm(id);
  const until = lockedUntil(key);
  if (until) return { ok: false, error: 'Too many wrong attempts. Sign-in is paused.', lockUntil: until };
  const u = users().find((x) => x.username === key || x.email === key);
  let good = false;
  if (u) good = (await digest(password, u.salt)) === u.hash;
  else await digest(password, 'none');
  if (!good) {
    const s = fail(key);
    if (s.until > Date.now()) return { ok: false, error: 'Too many wrong attempts. Sign-in is paused.', lockUntil: s.until };
    const left = 5 - s.n;
    return { ok: false, error: `Wrong username or password. ${left} attempt${left === 1 ? '' : 's'} left.` };
  }
  clearLock(key);
  const session = pub(u);
  startSession(session, remember);
  return { ok: true, session };
}

export async function resetPassword({ id, code, password }) {
  const key = norm(id);
  const lk = 'reset:' + key;
  const until = lockedUntil(lk);
  if (until) return { ok: false, error: 'Too many attempts. Wait a little and try again.' };
  const list = users();
  const u = list.find((x) => x.username === key || x.email === key);
  const good = u && (await digest(normCode(code), u.rcSalt)) === u.rcHash;
  if (!good) { fail(lk); return { ok: false, error: 'That username or recovery code is not right.' }; }
  if (!passwordOk(password)) return { ok: false, error: 'Use 8+ characters with a letter and a number.' };
  clearLock(lk);
  u.salt = rnd(16);
  u.hash = await digest(password, u.salt);
  write(USERS_KEY, list);
  clearLock(u.username);
  clearLock(u.email);
  return { ok: true };
}

export async function changePassword(id, current, next) {
  const list = users();
  const u = list.find((x) => x.id === id);
  if (!u || (await digest(current, u.salt)) !== u.hash) return { ok: false, error: 'Your current password is not right.' };
  if (!passwordOk(next)) return { ok: false, error: 'Use 8+ characters with a letter and a number.' };
  u.salt = rnd(16);
  u.hash = await digest(next, u.salt);
  write(USERS_KEY, list);
  return { ok: true };
}

export function updateName(id, name) {
  const list = users();
  const u = list.find((x) => x.id === id);
  const clean = String(name).trim().replace(/\s+/g, ' ');
  if (!u) return { ok: false, error: 'Account not found.' };
  if (clean.length < 2) return { ok: false, error: 'Enter your full name.' };
  u.name = clean;
  write(USERS_KEY, list);
  return { ok: true };
}

export async function regenerateRecovery(id, password) {
  const list = users();
  const u = list.find((x) => x.id === id);
  if (!u || (await digest(password, u.salt)) !== u.hash) return { ok: false, error: 'Your password is not right.' };
  const code = makeCode();
  u.rcSalt = rnd(16);
  u.rcHash = await digest(normCode(code), u.rcSalt);
  write(USERS_KEY, list);
  return { ok: true, code };
}

export async function deleteAccount(id, password) {
  const list = users();
  const u = list.find((x) => x.id === id);
  if (!u || (await digest(password, u.salt)) !== u.hash) return { ok: false, error: 'Your password is not right.' };
  write(USERS_KEY, list.filter((x) => x.id !== id));
  endSession();
  return { ok: true };
}