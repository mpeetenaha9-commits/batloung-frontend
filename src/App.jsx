import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { FaAppleAlt, FaBars, FaBell, FaBox, FaChartPie, FaCog, FaEdit, FaMoneyBillWave, FaPlus, FaSearch, FaShoppingCart, FaSignOutAlt, FaTimes, FaTrash, FaTruck, FaUsers } from 'react-icons/fa';
import Sales from './pages/Sales';
import Login, { Splash, Strength } from './Login';
import * as auth from './auth';
import './app.css';

const { API, API_ROOT } = auth;
const PAGE_KEY = 'batloung_page';
const IDLE_MS = 30 * 60 * 1000;
const WARN_MS = 60 * 1000;
const money = (n) => 'M ' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (v) => {
  const d = new Date(String(v).slice(0, 10) + 'T00:00:00');
  return isNaN(d) ? String(v ?? '') : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const ageOf = (d) => Math.max(0, Math.floor((Date.now() - new Date(String(d).slice(0, 10) + 'T00:00:00')) / 864e5));
const STAT = { PAID: ['Paid', 'paid'], PARTIALLY_PAID: ['Partial', 'part'], UNPAID: ['Unpaid', 'unpaid'] };

const NAV = [
  ['dashboard', 'Dashboard', FaChartPie, 'Overview'],
  ['suppliers', 'Suppliers', FaTruck, 'Master data'],
  ['fruits', 'Fruits', FaBox, 'Master data'],
  ['vendors', 'Vendors', FaUsers, 'Master data'],
  ['purchases', 'Purchases', FaShoppingCart, 'Operations'],
  ['sales', 'Sales', FaMoneyBillWave, 'Operations'],
  ['settings', 'Settings', FaCog, 'Account'],
];

const CONFIG = {
  suppliers: { title: 'Suppliers', one: 'supplier', id: 'supplier_id',
    cols: [['business_name', 'Business'], ['contact_person', 'Contact'], ['phone', 'Phone'], ['province', 'Province'], ['address', 'Address']],
    fields: [['business_name', 'Business name'], ['contact_person', 'Contact person'], ['phone', 'Phone'], ['province', 'Province', ['Gauteng', 'Western Cape', 'Free State']], ['address', 'Address']] },
  fruits: { title: 'Fruits', one: 'fruit', id: 'fruit_id',
    cols: [['fruit_name', 'Fruit'], ['description', 'Description'], ['status', 'Status']],
    fields: [['fruit_name', 'Fruit name'], ['description', 'Description'], ['status', 'Status', ['available', 'unavailable']]] },
  vendors: { title: 'Vendors', one: 'vendor', id: 'vendor_id',
    cols: [['vendor_name', 'Vendor'], ['phone_number', 'Phone'], ['location', 'Location'], ['registration_date', 'Registered']],
    fields: [['vendor_name', 'Vendor name'], ['phone_number', 'Phone number'], ['location', 'Location (town or city)']] },
  purchases: { title: 'Purchases', one: 'purchase', id: 'purchase_id', readOnly: true,
    cols: [['supplier_id', 'Supplier ID'], ['purchase_date', 'Date'], ['total_amount', 'Total']], fields: [] },
};

const cell = (k, v) => {
  if (v == null || v === '') return '—';
  if (/date/.test(k)) return fmtDate(v);
  if (k === 'total_amount') return money(v);
  if (k === 'status') return <span className={'ap-badge ' + (String(v).toLowerCase() === 'available' ? 'ok' : 'off')}>{v}</span>;
  return String(v);
};

function useOutside(ref, fn) {
  useEffect(() => {
    const h = (e) => ref.current && !ref.current.contains(e.target) && fn();
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, fn]);
}

/* ---------- Generic list page ---------- */
function Manage({ kind, toast }) {
  const cfg = CONFIG[kind];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ k: cfg.id, dir: 'desc' });
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await axios.get(`${API}/${kind}`); setItems(r.data.data || []); setError(''); }
    catch { setItems([]); setError(`Could not load ${cfg.title.toLowerCase()}. Check your connection and try again.`); }
    setLoading(false);
  }, [kind]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = items.filter((it) => !s || Object.values(it).some((v) => String(v).toLowerCase().includes(s)));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const x = a[sort.k], y = b[sort.k], nx = Number(x), ny = Number(y);
      return dir * (x !== '' && y !== '' && !isNaN(nx) && !isNaN(ny) ? nx - ny : String(x ?? '').localeCompare(String(y ?? '')));
    });
  }, [items, q, sort]);

  const blank = () => Object.fromEntries(cfg.fields.map(([k]) => [k, k === 'status' ? 'available' : '']));
  const setField = (k, v) => setForm((f) => ({ ...f, data: { ...f.data, [k]: v } }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const d = form.data;
      if (form.editing) await axios.put(`${API}/${kind}/${d[cfg.id]}`, d); else await axios.post(`${API}/${kind}`, d);
      toast(`${cfg.one[0].toUpperCase() + cfg.one.slice(1)} ${form.editing ? 'updated' : 'added'}`);
      setForm(null);
      await load();
    } catch (err) { toast(err.response?.data?.message || 'Could not save. Check the details and try again.', 'err'); }
    setSaving(false);
  };

  const remove = async () => {
    const it = confirm; setConfirm(null);
    try { await axios.delete(`${API}/${kind}/${it[cfg.id]}`); toast(`${cfg.one[0].toUpperCase() + cfg.one.slice(1)} deleted`); await load(); }
    catch (err) { toast(err.response?.data?.message || 'Cannot delete. It may be linked to other records.', 'err'); }
  };

  const exportCsv = () => {
    const csv = [[cfg.id, ...cfg.cols.map(([, l]) => l)], ...rows.map((r) => [r[cfg.id], ...cfg.cols.map(([k]) => r[k] ?? '')])]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `batloung-${kind}.csv`; a.click(); URL.revokeObjectURL(a.href);
    toast(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'}`);
  };

  const Th = ({ k, label }) => (
    <th><button className={sort.k === k ? 'on' : ''} onClick={() => setSort((s) => (s.k === k ? { k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { k, dir: 'asc' }))}>{label}{sort.k === k && (sort.dir === 'asc' ? ' ↑' : ' ↓')}</button></th>
  );

  return (
    <div className="ap-page">
      <div className="ap-head">
        <div><h2>{cfg.title}</h2><p>{loading ? 'Loading...' : `${rows.length} of ${items.length} record${items.length === 1 ? '' : 's'}`}</p></div>
        <div className="ap-tools">
          <label className="ap-search"><FaSearch /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${cfg.title.toLowerCase()}...`} /></label>
          <button className="ap-btn ghost" onClick={exportCsv} disabled={!rows.length}>Export</button>
          {!cfg.readOnly && <button className="ap-btn primary" onClick={() => setForm({ editing: false, data: blank() })}><FaPlus /> Add new</button>}
        </div>
      </div>
      {error && <div className="ap-banner"><span>{error}</span><button className="ap-btn ghost" onClick={load}>Try again</button></div>}
      <div className="ap-card"><div className="ap-scroll">
        <table className="ap-table">
          <thead><tr><Th k={cfg.id} label="ID" />{cfg.cols.map(([k, l]) => <Th key={k} k={k} label={l} />)}{!cfg.readOnly && <th className="r">Actions</th>}</tr></thead>
          {!loading && (
            <tbody>
              {rows.map((it, i) => (
                <tr key={it[cfg.id]} style={{ '--i': Math.min(i, 10) }}>
                  <td className="id">#{it[cfg.id]}</td>
                  {cfg.cols.map(([k]) => <td key={k}>{cell(k, it[k])}</td>)}
                  {!cfg.readOnly && (
                    <td className="r">
                      <button className="ap-icon edit" title="Edit" aria-label="Edit" onClick={() => setForm({ editing: true, data: { ...it } })}><FaEdit /></button>
                      <button className="ap-icon del" title="Delete" aria-label="Delete" onClick={() => setConfirm(it)}><FaTrash /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          )}
        </table>
        {loading && [0, 1, 2, 3, 4].map((n) => <div className="ap-skrow" key={n}>{cfg.cols.map(([k]) => <div className="skel" key={k} />)}</div>)}
        {!loading && !rows.length && !error && (
          <div className="ap-empty"><strong>{items.length ? 'Nothing matches' : `No ${cfg.title.toLowerCase()} yet`}</strong><span>{items.length ? 'Try a different search.' : cfg.readOnly ? 'Records will appear here.' : 'Add the first one to get started.'}</span></div>
        )}
      </div></div>

      {form && (
        <div className="ap-scrim" onMouseDown={(e) => e.target === e.currentTarget && setForm(null)}>
          <form className="ap-modal" onSubmit={save}>
            <div className="ap-mhead"><h3>{form.editing ? 'Edit' : 'New'} {cfg.one}</h3><button type="button" className="ap-icon" onClick={() => setForm(null)} aria-label="Close"><FaTimes /></button></div>
            {cfg.fields.map(([k, label, opts], i) => {
              const cur = form.data[k] ?? '';
              return (
                <label key={k} className="ap-field">{label}
                  {opts ? (
                    <select required value={cur} onChange={(e) => setField(k, e.target.value)}>
                      <option value="">Select...</option>
                      {(cur && !opts.includes(cur) ? [...opts, cur] : opts).map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : <input required autoFocus={i === 0} value={cur} onChange={(e) => setField(k, e.target.value)} />}
                </label>
              );
            })}
            <div className="ap-foot"><button type="button" className="ap-btn ghost" onClick={() => setForm(null)}>Cancel</button><button className="ap-btn primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></div>
          </form>
        </div>
      )}
      {confirm && (
        <div className="ap-scrim" onMouseDown={(e) => e.target === e.currentTarget && setConfirm(null)}>
          <div className="ap-modal">
            <h3>Delete this {cfg.one}?</h3><p>This can't be undone. If other records use it, the server will refuse.</p>
            <div className="ap-foot"><button className="ap-btn ghost" onClick={() => setConfirm(null)} autoFocus>Keep it</button><button className="ap-btn danger" onClick={remove}>Delete</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Dashboard ---------- */
function Dashboard({ user, go }) {
  const [d, setD] = useState(null);
  useEffect(() => {
    let off = false;
    const get = (u) => axios.get(`${API}/${u}`).then((r) => r.data.data || []).catch(() => []);
    Promise.all(['sales', 'purchases', 'vendors', 'fruits', 'suppliers'].map(get)).then(([sales, purchases, vendors, fruits, suppliers]) => { if (!off) setD({ sales, purchases, vendors, fruits, suppliers }); });
    return () => { off = true; };
  }, []);
  const h = new Date().getHours();
  const hi = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const sum = (a, k) => a.reduce((t, x) => t + (Number(x[k]) || 0), 0);
  let kpis = null, recent = [];
  if (d) {
    const rev = sum(d.sales, 'total_amount'), paid = sum(d.sales, 'amount_paid'), spend = sum(d.purchases, 'total_amount');
    kpis = [['Revenue', money(rev), `${d.sales.length} sales`, 'sales', ''], ['Collected', money(paid), rev ? `${Math.round((paid / rev) * 100)}% of revenue` : 'No sales yet', 'sales', ''],
      ['Still owed', money(Math.max(0, rev - paid)), 'From vendors', 'sales', 'a'], ['Gross margin', money(rev - spend), `After ${money(spend)} purchases`, 'purchases', 'b']];
    recent = [...d.sales].sort((a, b) => b.sale_id - a.sale_id).slice(0, 5);
  }
  return (
    <div className="ap-page">
      <div className="ap-hero"><h2>{hi}, {user.name.split(' ')[0]}</h2><p>Here is how Batloung Farm is doing today.</p></div>
      <div className="ap-kpis">
        {(kpis || [0, 1, 2, 3]).map((x, i) => d
          ? <button key={i} className={'ap-kpi ' + x[4]} style={{ '--i': i }} onClick={() => go(x[3])}><span>{x[0]}</span><strong>{x[1]}</strong><em>{x[2]}</em></button>
          : <div key={i} className="ap-kpi skel" style={{ height: 112 }} />)}
      </div>
      <div className="ap-cols">
        <div className="ap-box">
          <h3>Recent sales</h3>
          {!d ? [0, 1, 2].map((n) => <div key={n} className="skel" style={{ height: 44 }} />)
            : recent.length ? recent.map((s) => (
              <div className="ap-rrow" key={s.sale_id}>
                <div><strong>{s.vendor_name || `Vendor ${s.vendor_id}`}</strong><small>#{s.sale_id} · {fmtDate(s.sale_date)}</small></div>
                <div style={{ textAlign: 'right' }}><strong>{money(s.total_amount)}</strong><small><span className={'ap-badge ' + (STAT[s.payment_status]?.[1] || 'part')}>{STAT[s.payment_status]?.[0] || s.payment_status}</span></small></div>
              </div>
            )) : <p style={{ color: 'var(--muted)', margin: 0 }}>No sales recorded yet.</p>}
        </div>
        <div className="ap-box">
          <h3>At a glance</h3>
          {[['suppliers', 'Suppliers'], ['fruits', 'Fruits'], ['vendors', 'Vendors']].map(([k, l]) => (
            <button key={k} className="ap-tile" onClick={() => go(k)}><span>{l}</span><strong>{d ? d[k].length : '…'}</strong></button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- Notifications bell ---------- */
function Bell({ page, go }) {
  const [sales, setSales] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  useEffect(() => {
    let off = false;
    const pull = () => axios.get(`${API}/sales`).then((r) => !off && setSales(r.data.data || [])).catch(() => {});
    pull();
    const t = setInterval(pull, 120000);
    return () => { off = true; clearInterval(t); };
  }, [page]);
  const due = useMemo(() => sales.filter((s) => s.payment_status !== 'PAID')
    .map((s) => ({ ...s, left: Math.max(0, Number(s.total_amount) - Number(s.amount_paid || 0)), age: ageOf(s.sale_date) }))
    .sort((a, b) => b.age - a.age), [sales]);
  const late = due.filter((s) => s.age > 14).length;
  const open_ = () => { setOpen(false); go('sales'); };
  return (
    <div className="ap-pop" ref={ref}>
      <button className="ap-icon" aria-label="Notifications" onClick={() => setOpen((o) => !o)}>
        <FaBell />{due.length > 0 && <span className="ap-badge-n">{due.length > 9 ? '9+' : due.length}</span>}
      </button>
      {open && (
        <div className="ap-menu">
          <div className="ap-menu-h"><strong>Payments to collect</strong><span>{late ? `${late} overdue` : `${due.length} open`}</span></div>
          {due.length ? due.slice(0, 5).map((s) => (
            <button key={s.sale_id} className="ap-menu-i" onClick={open_}>
              <span><strong>{s.vendor_name || `Vendor ${s.vendor_id}`}</strong><small>Sale #{s.sale_id} · {s.age} day{s.age === 1 ? '' : 's'} ago</small></span>
              <b className={s.age > 14 ? 'late' : ''}>{money(s.left)}</b>
            </button>
          )) : <div className="ap-menu-e">You're all caught up. Nothing to collect.</div>}
          {due.length > 5 && <button className="ap-menu-more" onClick={open_}>View all {due.length}</button>}
        </div>
      )}
    </div>
  );
}

/* ---------- Command palette (Ctrl+K) ---------- */
function Palette({ open, onClose, items }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const list = useMemo(() => items.filter((x) => (x.label + ' ' + x.hint).toLowerCase().includes(q.toLowerCase())), [items, q]);
  useEffect(() => { setI(0); }, [q]);
  useEffect(() => { if (open) setQ(''); }, [open]);
  if (!open) return null;
  const run = (x) => { onClose(); x.run(); };
  const key = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setI((n) => Math.min(n + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(n - 1, 0)); }
    else if (e.key === 'Enter' && list[i]) run(list[i]);
    else if (e.key === 'Escape') onClose();
  };
  return (
    <div className="pal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pal" role="dialog" aria-label="Command palette">
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={key} placeholder="Jump to a page or run an action…" />
        <ul>
          {list.map((x, n) => <li key={x.label} className={n === i ? 'on' : ''}><button onMouseEnter={() => setI(n)} onClick={() => run(x)}><span>{x.label}</span><small>{x.hint}</small></button></li>)}
          {!list.length && <div className="pal-e">Nothing matches "{q}"</div>}
        </ul>
      </div>
    </div>
  );
}

/* ---------- Settings ---------- */
function Settings({ user, onUser, onLogout, toast }) {
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState('');
  const [pw, setPw] = useState({ cur: '', next: '', again: '' });
  const [code, setCode] = useState('');
  const [codePw, setCodePw] = useState('');
  const [askDelete, setAskDelete] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [api, setApi] = useState({ state: 'checking', ms: 0 });

  const ping = useCallback(async () => {
    setApi({ state: 'checking', ms: 0 });
    const t0 = performance.now();
    try { await axios.get(API_ROOT, { timeout: 8000 }); setApi({ state: 'online', ms: Math.round(performance.now() - t0) }); }
    catch { setApi({ state: 'offline', ms: 0 }); }
  }, []);
  useEffect(() => { ping(); }, [ping]);

  const saveName = () => {
    const r = auth.updateName(user.id, name);
    if (r.ok) { onUser(auth.getSession()); toast('Profile updated'); } else toast(r.error, 'err');
  };
  const savePw = async (e) => {
    e.preventDefault();
    if (!auth.passwordOk(pw.next)) return toast('Use 8+ characters with a letter and a number.', 'err');
    if (pw.next !== pw.again) return toast("The new passwords don't match.", 'err');
    setBusy('pw');
    const r = await auth.changePassword(user.id, pw.cur, pw.next);
    setBusy('');
    if (r.ok) { setPw({ cur: '', next: '', again: '' }); toast('Password changed'); } else toast(r.error, 'err');
  };
  const newCode = async (e) => {
    e.preventDefault();
    setBusy('code');
    const r = await auth.regenerateRecovery(user.id, codePw);
    setBusy('');
    if (r.ok) { setCode(r.code); setCodePw(''); toast('New recovery code created'); } else toast(r.error, 'err');
  };
  const removeAccount = async (e) => {
    e.preventDefault();
    setBusy('del');
    const r = await auth.deleteAccount(user.id, delPw);
    setBusy('');
    if (r.ok) onLogout('Your account was deleted.'); else toast(r.error, 'err');
  };

  const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const since = user.created ? new Date(user.created).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  return (
    <div className="ap-page">
      <div className="ap-head"><div><h2>Settings</h2><p>Your profile, security and system status.</p></div></div>
      <div className="st-grid">
        <section className="ap-box st-box">
          <h3>Profile</h3>
          <div className="st-id"><div className="ap-avatar big">{initials}</div><div><strong>{user.name}</strong><small>@{user.username} · {user.role}</small></div></div>
          <label className="ap-field">Full name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="st-row"><span>Email</span><strong>{user.email}</strong></div>
          <div className="st-row"><span>Member since</span><strong>{since}</strong></div>
          <button className="ap-btn primary" onClick={saveName} disabled={name.trim() === user.name}>Save profile</button>
        </section>

        <section className="ap-box st-box">
          <h3>System status</h3>
          <div className="st-status"><i className={'st-dot ' + api.state} /><strong>{api.state === 'online' ? 'Server online' : api.state === 'offline' ? 'Server unreachable' : 'Checking server…'}</strong></div>
          <div className="st-row"><span>Response time</span><strong>{api.state === 'online' ? `${api.ms} ms` : '—'}</strong></div>
          <div className="st-row"><span>Session</span><strong>Signs out after 30 min idle</strong></div>
          <button className="ap-btn ghost" onClick={ping}>Check again</button>
        </section>

        <form className="ap-box st-box" onSubmit={savePw}>
          <h3>Change password</h3>
          <label className="ap-field">Current password<input type="password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} /></label>
          <label className="ap-field">New password<input type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></label>
          <Strength value={pw.next} />
          <label className="ap-field">Confirm new password<input type="password" autoComplete="new-password" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} /></label>
          <button className="ap-btn primary" disabled={busy === 'pw' || !pw.cur || !pw.next}>{busy === 'pw' ? 'Updating…' : 'Update password'}</button>
        </form>

        <form className="ap-box st-box" onSubmit={newCode}>
          <h3>Recovery code</h3>
          <p className="st-note">Lost your code? Create a new one. The old code stops working.</p>
          {code && <div className="lg-code"><code>{code}</code></div>}
          {code && <p className="st-note">Save it now. It won't be shown again.</p>}
          <label className="ap-field">Confirm with your password<input type="password" autoComplete="current-password" value={codePw} onChange={(e) => setCodePw(e.target.value)} /></label>
          <button className="ap-btn ghost" disabled={busy === 'code' || !codePw}>{busy === 'code' ? 'Creating…' : 'Create new code'}</button>
        </form>

        <section className="ap-box st-box">
          <h3>This device</h3>
          <p className="st-note">Sign out here. You can sign back in any time with your username and password.</p>
          <button className="ap-btn ghost" onClick={() => onLogout('You have been signed out.')}><FaSignOutAlt /> Sign out</button>
        </section>

        <form className="ap-box st-box danger" onSubmit={removeAccount}>
          <h3>Delete account</h3>
          <p className="st-note">This removes your account from this device. Farm data on the server is not touched.</p>
          {!askDelete ? <button type="button" className="ap-btn ghost" onClick={() => setAskDelete(true)}>Delete my account…</button> : (
            <>
              <label className="ap-field">Enter your password to confirm<input type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} autoFocus /></label>
              <div className="ap-foot"><button type="button" className="ap-btn ghost" onClick={() => { setAskDelete(false); setDelPw(''); }}>Cancel</button><button className="ap-btn danger" disabled={busy === 'del' || !delPw}>{busy === 'del' ? 'Deleting…' : 'Delete account'}</button></div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}

/* ---------- Shell ---------- */
function Shell({ user, onUser, onLogout }) {
  const [page, setPage] = useState(() => { const p = localStorage.getItem(PAGE_KEY); return NAV.some((n) => n[0] === p) ? p : 'dashboard'; });
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const [pal, setPal] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [warn, setWarn] = useState(0);
  const last = useRef(Date.now());
  const warnRef = useRef(false);

  const toast = useCallback((msg, type = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  const go = (p) => { setPage(p); setOpen(false); try { localStorage.setItem(PAGE_KEY, p); } catch {} };

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') setOpen(false);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPal((p) => !p); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  /* Auto sign-out after 30 minutes without activity, with a 60 second warning */
  useEffect(() => {
    const evs = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    const bump = () => { if (!warnRef.current) last.current = Date.now(); };
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }));
    const t = setInterval(() => {
      const idle = Date.now() - last.current;
      if (idle >= IDLE_MS) { onLogout('You were signed out after 30 minutes of inactivity.'); return; }
      if (idle >= IDLE_MS - WARN_MS) { warnRef.current = true; setWarn(Math.ceil((IDLE_MS - idle) / 1000)); }
    }, 1000);
    return () => { evs.forEach((e) => window.removeEventListener(e, bump, { capture: true })); clearInterval(t); };
  }, []); // eslint-disable-line
  const stay = () => { last.current = Date.now(); warnRef.current = false; setWarn(0); };

  const palItems = useMemo(() => [
    ...NAV.map(([id, label, , group]) => ({ label: `Go to ${label}`, hint: group, run: () => go(id) })),
    { label: 'Collapse or expand sidebar', hint: 'Layout', run: () => setCollapsed((c) => !c) },
    { label: 'Sign out', hint: 'Account', run: () => onLogout('You have been signed out.') },
  ], []); // eslint-disable-line

  const cur = NAV.find((n) => n[0] === page);
  const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className={'app' + (collapsed ? ' collapsed' : '') + (open ? ' open' : '')}>
      <aside className="ap-side">
        <div className="ap-brand"><span className="logo"><FaAppleAlt /></span><span>Batloung Farm</span></div>
        <nav className="ap-nav">
          {NAV.map(([id, label, Ico, group], i) => (
            <div key={id} style={{ display: 'contents' }}>
              {(i === 0 || NAV[i - 1][3] !== group) && <div className="ap-group">{group}</div>}
              <button className={'ap-link' + (page === id ? ' on' : '')} onClick={() => go(id)} title={label}><Ico /><span>{label}</span></button>
            </div>
          ))}
        </nav>
        <div className="ap-user" onClick={() => go('settings')} style={{ cursor: 'pointer' }} title="Open settings">
          <div className="ap-avatar">{initials}</div>
          <div><strong>{user.name}</strong><span>{user.role}</span></div>
          <button className="ap-icon" onClick={(e) => { e.stopPropagation(); onLogout('You have been signed out.'); }} title="Sign out" aria-label="Sign out"><FaSignOutAlt /></button>
        </div>
      </aside>
      <div className="ap-shade" onClick={() => setOpen(false)} />
      <div className="ap-wrap">
        <header className="ap-top">
          <button className="ap-icon" aria-label="Toggle menu" onClick={() => (window.innerWidth <= 900 ? setOpen((o) => !o) : setCollapsed((c) => !c))}><FaBars /></button>
          <h1>{cur[1]}</h1>
          <span className="ap-date">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          <button className="ap-kbd" onClick={() => setPal(true)} aria-label="Search or jump to"><FaSearch /><span>Search or jump to…</span><kbd>Ctrl K</kbd></button>
          <Bell page={page} go={go} />
        </header>
        <main className="ap-main">
          <div className="ap-fade" key={page}>
            {page === 'dashboard' ? <Dashboard user={user} go={go} />
              : page === 'sales' ? <Sales />
              : page === 'settings' ? <Settings user={user} onUser={onUser} onLogout={onLogout} toast={toast} />
              : <Manage kind={page} toast={toast} />}
          </div>
        </main>
      </div>

      <Palette open={pal} onClose={() => setPal(false)} items={palItems} />

      {warn > 0 && (
        <div className="ap-scrim" style={{ zIndex: 400 }}>
          <div className="ap-modal" role="alertdialog">
            <h3>Still there?</h3>
            <p>For your security you'll be signed out in <strong>{warn}s</strong> because there has been no activity.</p>
            <div className="ap-foot">
              <button className="ap-btn ghost" onClick={() => onLogout('You have been signed out.')}>Sign out now</button>
              <button className="ap-btn primary" onClick={stay} autoFocus>Stay signed in</button>
            </div>
          </div>
        </div>
      )}

      <div className="ap-toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={'ap-toast ' + t.type}>{t.msg}</div>)}</div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(auth.getSession);
  const [booting, setBooting] = useState(() => !!auth.getSession());
  const login = (s) => { setUser(s); setBooting(true); };
  const logout = (msg) => {
    auth.endSession();
    if (typeof msg === 'string') sessionStorage.setItem('batloung_notice', msg);
    setUser(null);
  };
  if (!user) return <Login onLogin={login} />;
  if (booting) return <Splash name={user.name} onDone={() => setBooting(false)} />;
  return <Shell user={user} onUser={setUser} onLogout={logout} />;
}