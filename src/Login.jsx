import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FaAppleAlt, FaCheck, FaCopy, FaEnvelope, FaExclamationTriangle, FaEye, FaEyeSlash, FaKey, FaLock, FaUser } from 'react-icons/fa';
import * as auth from './auth';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const RULES = ['8+ characters', 'Upper and lower case', 'A number', 'A symbol'];

export function PasswordInput({ value, onChange, placeholder, autoComplete, onKeyUp, autoFocus, invalid }) {
  const [show, setShow] = useState(false);
  return (
    <div className={'lg-field' + (invalid ? ' bad' : '')}>
      <FaLock />
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        autoComplete={autoComplete} onKeyUp={onKeyUp} autoFocus={autoFocus} />
      <button type="button" className="lg-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <FaEyeSlash /> : <FaEye />}</button>
    </div>
  );
}

export function Strength({ value }) {
  if (!value) return null;
  const s = auth.strength(value);
  return (
    <div className="lg-str" data-s={s.score}>
      <div className="bars">{[1, 2, 3, 4].map((n) => <i key={n} className={n <= s.score ? 'on' : ''} />)}</div>
      <span>{s.label}</span>
      <ul>{RULES.map((r, i) => <li key={r} className={s.rules[i] ? 'ok' : ''}>{r}</li>)}</ul>
    </div>
  );
}

/* Animated loading screen. Also wakes the server so the first page loads fast. */
export function Splash({ name, onDone }) {
  const MSG = ['Securing your session…', 'Waking up the farm server…', 'Loading vendors and sales…', 'Almost ready…'];
  const [step, setStep] = useState(0);
  useEffect(() => {
    let off = false;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, MSG.length - 1)), 650);
    const ping = axios.get(auth.API_ROOT, { timeout: 7000 }).catch(() => {});
    Promise.all([ping, wait(2200)]).then(() => { if (!off) onDone(); });
    return () => { off = true; clearInterval(t); };
  }, []); // eslint-disable-line
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="sp-box">
        <div className="sp-logo"><i className="sp-ring r2" /><i className="sp-ring" /><span className="sp-core"><FaAppleAlt /></span></div>
        <div className="sp-title">Batloung Farm</div>
        {name && <div className="sp-hello">Welcome, {name.split(' ')[0]}</div>}
        <div className="sp-bar"><i /></div>
        <div className="sp-msg" key={step}>{MSG[step]}</div>
      </div>
    </div>
  );
}

export default function Login({ onLogin }) {
  const [mode, setMode] = useState(() => (auth.hasUsers() ? 'login' : 'signup'));
  const [notice, setNotice] = useState(() => sessionStorage.getItem('batloung_notice') || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [lid, setLid] = useState('');
  const [lpw, setLpw] = useState('');
  const [remember, setRemember] = useState(true);
  const [caps, setCaps] = useState(false);
  const [s, setS] = useState({ name: '', username: '', email: '', pw: '', pw2: '' });
  const [tried, setTried] = useState(false);
  const [f, setF] = useState({ id: '', code: '', pw: '', pw2: '' });
  const [done, setDone] = useState(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { sessionStorage.removeItem('batloung_notice'); }, []);
  useEffect(() => { setLockUntil(auth.lockedUntil(lid)); setNow(Date.now()); }, [lid]);
  useEffect(() => {
    if (lockUntil <= Date.now()) return undefined;
    const t = setInterval(() => { const n = Date.now(); setNow(n); if (n >= lockUntil) clearInterval(t); }, 250);
    return () => clearInterval(t);
  }, [lockUntil]);
  const left = Math.max(0, Math.ceil((lockUntil - now) / 1000));

  const bump = () => { setShaking(true); setTimeout(() => setShaking(false), 450); };
  const go = (m) => { setMode(m); setErr(''); setNotice(''); setTried(false); };
  const capsCheck = (e) => setCaps(!!(e.getModifierState && e.getModifierState('CapsLock')));
  const setSv = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value }));
  const setFv = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const errs = useMemo(() => {
    const e = {};
    if (s.name.trim().length < 2) e.name = 'Enter your full name.';
    if (!auth.isUsername(s.username)) e.username = '3 to 20 letters, numbers, dots, dashes or underscores.';
    else if (auth.usernameTaken(s.username)) e.username = 'That username is taken.';
    if (!auth.isEmail(s.email)) e.email = 'Enter a valid email address.';
    else if (auth.emailTaken(s.email)) e.email = 'That email already has an account.';
    if (!auth.passwordOk(s.pw)) e.pw = 'Use 8+ characters with a letter and a number.';
    if (!s.pw2 || s.pw2 !== s.pw) e.pw2 = "Passwords don't match.";
    return e;
  }, [s]);
  const show = (k) => tried && errs[k];
  const uOk = auth.isUsername(s.username) && !auth.usernameTaken(s.username);

  const doLogin = async (e) => {
    e.preventDefault();
    if (busy || left > 0) return;
    if (!lid.trim() || !lpw) { setErr('Enter your username or email and your password.'); bump(); return; }
    setBusy(true); setErr('');
    const [res] = await Promise.all([auth.logIn(lid, lpw, remember), wait(650)]);
    if (res.ok) { onLogin(res.session); return; }
    setBusy(false); setErr(res.error); bump();
    if (res.lockUntil) { setLockUntil(res.lockUntil); setNow(Date.now()); }
  };

  const doSignup = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (Object.keys(errs).length) { setTried(true); bump(); return; }
    setBusy(true); setErr('');
    const [res] = await Promise.all([auth.signUp({ name: s.name, username: s.username, email: s.email, password: s.pw }), wait(700)]);
    setBusy(false);
    if (!res.ok) { setErr(res.error); bump(); return; }
    setDone({ session: res.session, code: res.recoveryCode });
    setSaved(false); setMode('recovery');
  };

  const doForgot = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!f.id.trim() || !f.code.trim()) { setErr('Enter your username or email and your recovery code.'); bump(); return; }
    if (!auth.passwordOk(f.pw)) { setErr('Use 8+ characters with a letter and a number.'); bump(); return; }
    if (f.pw !== f.pw2) { setErr("The new passwords don't match."); bump(); return; }
    setBusy(true); setErr('');
    const [res] = await Promise.all([auth.resetPassword({ id: f.id, code: f.code, password: f.pw }), wait(700)]);
    setBusy(false);
    if (!res.ok) { setErr(res.error); bump(); return; }
    setLid(f.id); setLpw(''); setF({ id: '', code: '', pw: '', pw2: '' });
    setErr(''); setMode('login'); setNotice('Password updated. Sign in with your new password.');
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(done.code); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setErr('Could not copy. Select the code and copy it by hand.'); }
  };
  const cont = () => { auth.startSession(done.session, true); onLogin(done.session); };

  const Btn = ({ children, working }) => (
    <button className={'lg-btn' + (busy ? ' busy' : '')} disabled={busy || left > 0}>{busy ? <><i /> {working}</> : children}</button>
  );

  return (
    <div className="login">
      <div className="lg-brand">
        <i className="blob b1" /><i className="blob b2" />
        <div className="ap-brand" style={{ padding: 0 }}><span className="logo"><FaAppleAlt /></span><span>Batloung Farm</span></div>
        <h1>Run the farm.<br /><span>Know every sale.</span></h1>
        <p>Suppliers, fruit, vendors, purchases and sales in one place, with live payments and a map of where your fruit goes.</p>
        <ul className="lg-feat">
          {['Create your account in seconds', 'Live sales and payment tracking', 'Vendor map, receipts and CSV exports', 'Auto sign-out keeps your data safe'].map((t, i) => <li key={t} style={{ '--i': i }}>{t}</li>)}
        </ul>
      </div>

      <div className="lg-side">
        <div className={'lg-card' + (shaking ? ' shake' : '')}>
          {(mode === 'login' || mode === 'signup') && (
            <div className="lg-tabs" data-pos={mode === 'signup' ? 1 : 0}>
              <i />
              <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => go('login')}>Sign in</button>
              <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => go('signup')}>Create account</button>
            </div>
          )}

          {mode === 'login' && (
            <form className="lg-pane" key="login" onSubmit={doLogin} noValidate>
              <h2>Welcome back</h2>
              <p>Sign in to manage Batloung Farm.</p>
              {notice && <div className="lg-info">{notice}</div>}
              {!auth.hasUsers() && <div className="lg-info">No accounts yet on this device. <button type="button" className="lg-link" onClick={() => go('signup')}>Create the first one</button></div>}
              <div className="lg-field"><FaUser /><input value={lid} onChange={(e) => setLid(e.target.value)} placeholder="Username or email" autoComplete="username" autoFocus /></div>
              <PasswordInput value={lpw} onChange={setLpw} placeholder="Password" autoComplete="current-password" onKeyUp={capsCheck} />
              {caps && <div className="lg-warn"><FaExclamationTriangle /> Caps Lock is on</div>}
              <div className="lg-row">
                <label><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Keep me signed in</label>
                <button type="button" className="lg-link" onClick={() => go('forgot')}>Forgot password?</button>
              </div>
              {err && <div className="lg-err" role="alert">{err}</div>}
              {left > 0 && <div className="lg-lock">Sign-in is paused for <strong>{left}s</strong> to protect this account.</div>}
              <Btn working="Signing in…">{left > 0 ? `Try again in ${left}s` : 'Sign in'}</Btn>
              <div className="lg-hint">New here? <button type="button" className="lg-link" onClick={() => go('signup')}>Create an account</button></div>
            </form>
          )}

          {mode === 'signup' && (
            <form className="lg-pane" key="signup" onSubmit={doSignup} noValidate>
              <h2>Create your account</h2>
              <p>It takes less than a minute.</p>
              {!auth.hasUsers() && <div className="lg-info">You're the first one here, so this account becomes the <strong>Administrator</strong>.</div>}
              <div className={'lg-field' + (show('name') ? ' bad' : '')}><FaUser /><input value={s.name} onChange={setSv('name')} placeholder="Full name" autoComplete="name" autoFocus /></div>
              {show('name') && <small className="lg-fe">{errs.name}</small>}
              <div className={'lg-field' + (show('username') ? ' bad' : '')}><FaUser /><input value={s.username} onChange={setSv('username')} placeholder="Username" autoComplete="username" /></div>
              {show('username') ? <small className="lg-fe">{errs.username}</small> : uOk && <small className="lg-ok"><FaCheck /> Username is available</small>}
              <div className={'lg-field' + (show('email') ? ' bad' : '')}><FaEnvelope /><input value={s.email} onChange={setSv('email')} placeholder="Email address" autoComplete="email" inputMode="email" /></div>
              {show('email') && <small className="lg-fe">{errs.email}</small>}
              <PasswordInput value={s.pw} onChange={(v) => setS((x) => ({ ...x, pw: v }))} placeholder="Password" autoComplete="new-password" onKeyUp={capsCheck} invalid={!!show('pw')} />
              <Strength value={s.pw} />
              {show('pw') && <small className="lg-fe">{errs.pw}</small>}
              <PasswordInput value={s.pw2} onChange={(v) => setS((x) => ({ ...x, pw2: v }))} placeholder="Confirm password" autoComplete="new-password" invalid={!!show('pw2')} />
              {show('pw2') && <small className="lg-fe">{errs.pw2}</small>}
              {caps && <div className="lg-warn"><FaExclamationTriangle /> Caps Lock is on</div>}
              {err && <div className="lg-err" role="alert">{err}</div>}
              <Btn working="Creating account…">Create account</Btn>
              <div className="lg-hint">Already have an account? <button type="button" className="lg-link" onClick={() => go('login')}>Sign in</button></div>
            </form>
          )}

          {mode === 'forgot' && (
            <form className="lg-pane" key="forgot" onSubmit={doForgot} noValidate>
              <h2>Reset your password</h2>
              <p>Use the recovery code you saved when you created your account.</p>
              <div className="lg-field"><FaUser /><input value={f.id} onChange={setFv('id')} placeholder="Username or email" autoFocus /></div>
              <div className="lg-field"><FaKey /><input value={f.code} onChange={setFv('code')} placeholder="Recovery code (XXXX-XXXX-XXXX)" autoCapitalize="characters" spellCheck="false" /></div>
              <PasswordInput value={f.pw} onChange={(v) => setF((x) => ({ ...x, pw: v }))} placeholder="New password" autoComplete="new-password" />
              <Strength value={f.pw} />
              <PasswordInput value={f.pw2} onChange={(v) => setF((x) => ({ ...x, pw2: v }))} placeholder="Confirm new password" autoComplete="new-password" />
              {err && <div className="lg-err" role="alert">{err}</div>}
              <Btn working="Updating…">Update password</Btn>
              <div className="lg-hint"><button type="button" className="lg-link" onClick={() => go('login')}>Back to sign in</button></div>
            </form>
          )}

          {mode === 'recovery' && done && (
            <div className="lg-pane" key="recovery">
              <h2>You're in, {done.session.name.split(' ')[0]}!</h2>
              <p>Save this recovery code. It is the only way to reset your password if you forget it, and it is shown just once.</p>
              <div className="lg-code"><code>{done.code}</code><button type="button" className="lg-copy" onClick={copy}>{copied ? <><FaCheck /> Copied</> : <><FaCopy /> Copy</>}</button></div>
              {err && <div className="lg-err" role="alert">{err}</div>}
              <label className="lg-row" style={{ justifyContent: 'flex-start', gap: '.6rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} style={{ accentColor: '#22c55e' }} /> I have saved my recovery code
              </label>
              <button className="lg-btn" disabled={!saved} onClick={cont}>Continue to Batloung Farm</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}