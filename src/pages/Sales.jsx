import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./Sales.css";

const API = "https://batloung-farm-production.up.railway.app/api";
const SIZES = ["small", "medium", "large"];
const STATUS = {
  PAID: { label: "Paid", cls: "paid" },
  PARTIALLY_PAID: { label: "Partial", cls: "pending" },
  UNPAID: { label: "Unpaid", cls: "overdue" },
};
const FILTERS = ["All", "PAID", "PARTIALLY_PAID", "UNPAID"];
const RANGES = [[7, "7 days"], [30, "30 days"], [90, "90 days"], [0, "All time"]];
const OVERDUE_AFTER = 14;

/* Quick map lookups. Anything not listed here is found automatically through OpenStreetMap and remembered. */
const PLACES = {
  maseru: [-29.3167, 27.4833], teyateyaneng: [-29.15, 27.75], hlotse: [-28.8667, 28.05], leribe: [-28.8667, 28.05],
  mafeteng: [-29.8233, 27.2381], "mohale's hoek": [-30.15, 27.4667], quthing: [-30.4, 27.7], "qacha's nek": [-30.1167, 28.6833],
  mokhotlong: [-29.2889, 29.0667], "butha-buthe": [-28.7667, 28.25], "thaba-tseka": [-29.5233, 28.6094], roma: [-29.45, 27.7167],
  johannesburg: [-26.2041, 28.0473], pretoria: [-25.7479, 28.2293], "cape town": [-33.9249, 18.4241], bloemfontein: [-29.0852, 26.1596],
};
const local = (t) => { const s = String(t || "").toLowerCase(); const k = Object.keys(PLACES).find((p) => s.includes(p)); return k ? PLACES[k] : null; };
const locate = (t, cache) => local(t) || (Array.isArray(cache[String(t || "").toLowerCase()]) ? cache[String(t).toLowerCase()] : null);

const GEO_KEY = "batloung_geo_v1";
function useGeo(texts) {
  const [cache, setCache] = useState(() => { try { return JSON.parse(localStorage.getItem(GEO_KEY)) || {}; } catch { return {}; } });
  const key = texts.join("|");
  useEffect(() => {
    const todo = texts.filter((t) => t && !local(t) && !(t.toLowerCase() in cache));
    if (!todo.length) return;
    let off = false;
    (async () => {
      for (const t of todo) {
        if (off) return;
        let val = 0;
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ls,za&q=${encodeURIComponent(t)}`);
          const j = await r.json();
          if (j[0]) val = [Number(j[0].lat), Number(j[0].lon)];
        } catch { return; }
        setCache((c) => { const n = { ...c, [t.toLowerCase()]: val }; try { localStorage.setItem(GEO_KEY, JSON.stringify(n)); } catch {} return n; });
        await new Promise((r) => setTimeout(r, 1100));
      }
    })();
    return () => { off = true; };
  }, [key]); // eslint-disable-line
  return cache;
}

const money = (n) => "M " + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const niceDate = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const today = () => new Date().toLocaleDateString("en-CA");
const daysAgo = (s) => Math.floor((new Date(today() + "T00:00:00") - new Date(s + "T00:00:00")) / 864e5);
const pretty = (m) => String(m || "").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const errMsg = (e, fb) => e?.response?.data?.message || fb;

const norm = (r) => ({
  id: r.sale_id, vendorId: r.vendor_id, vendorName: r.vendor_name || `Vendor ${r.vendor_id}`, location: r.location || "",
  date: String(r.sale_date || "").slice(0, 10), status: r.payment_status, method: r.payment_method || "",
  paid: Number(r.amount_paid) || 0, total: Number(r.total_amount) || 0,
});

function useCountUp(value, ms = 800) {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(value); from.current = value; return; }
    const start = performance.now(); const a = from.current; let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / ms); const e = 1 - Math.pow(1 - p, 3);
      setV(a + (value - a) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return v;
}

const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d.split("|").map((p, i) => <path key={i} d={p} />)}
  </svg>
);
const I = {
  search: "M21 21l-4.3-4.3|M11 19a8 8 0 100-16 8 8 0 000 16z", plus: "M12 5v14|M5 12h14",
  edit: "M12 20h9|M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z", trash: "M3 6h18|M8 6V4h8v2|M19 6l-1 14H6L5 6|M10 11v6|M14 11v6",
  check: "M20 6L9 17l-5-5", map: "M9 3L3 5v16l6-2 6 2 6-2V3l-6 2z|M9 3v16|M15 5v16", download: "M12 3v12|M7 10l5 5 5-5|M5 21h14",
  x: "M18 6L6 18|M6 6l12 12", arrow: "M12 5v14|M6 13l6 6 6-6", print: "M6 9V3h12v6|M6 18H4v-7h16v7h-2|M6 14h12v7H6z",
};

/* ---------- Receipt ---------- */
function printReceipt(s, items) {
  const w = window.open("", "_blank", "width=420,height=680");
  if (!w) return false;
  const rows = items.map((i) => `<tr><td>${esc(i.fruit_name || "Fruit " + i.fruit_id)} (${esc(i.packaging_size)})</td><td>${i.quantity} × ${money(i.unit_price)}</td><td>${money(i.quantity * i.unit_price)}</td></tr>`).join("");
  w.document.write(`<html><head><title>Receipt #${s.id}</title><style>body{font:14px system-ui,sans-serif;padding:24px;color:#111}h1{margin:0 0 4px;font-size:22px;color:#15803d}table{width:100%;border-collapse:collapse;margin:16px 0}td{padding:6px 0;border-bottom:1px solid #ddd}td:last-child{text-align:right}.t{display:flex;justify-content:space-between;font-weight:700;margin-top:6px}small{color:#666}</style></head><body><h1>Batloung Farm</h1><small>Receipt #${s.id} · ${niceDate(s.date)}</small><p>${esc(s.vendorName)}<br><small>${esc(s.location)}</small></p><table>${rows}</table><div class="t"><span>Total</span><span>${money(s.total)}</span></div><div class="t"><span>Paid</span><span>${money(s.paid)}</span></div><div class="t"><span>Balance</span><span>${money(Math.max(0, s.total - s.paid))}</span></div><p><small>Payment: ${esc(pretty(s.method))} · ${esc(STATUS[s.status]?.label || s.status)}<br>Thank you for your business.</small></p><script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
  return true;
}

/* ---------- Map ---------- */
function SalesMap({ pins, activeVendor, onPick }) {
  const el = useRef(null); const map = useRef(null); const layer = useRef(null);
  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: false, scrollWheelZoom: false }).setView([-29.6, 28.2], 7);
    L.control.zoom({ position: "bottomright" }).addTo(map.current);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 18, className: "sm-tiles" }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current.remove(); map.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    layer.current.clearLayers();
    const shown = pins.filter((p) => p.ll);
    const max = Math.max(1, ...shown.map((p) => p.total));
    shown.forEach((p) => {
      const size = Math.round(22 + (p.total / max) * 26);
      const cls = "sm-pin" + (p.open ? " warn" : "") + (activeVendor === p.vendorId ? " on" : "");
      const icon = L.divIcon({ className: cls, html: "<b></b><i></i>", iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
      const m = L.marker(p.ll, { icon }).addTo(layer.current);
      m.bindTooltip(`<strong>${esc(p.name)}</strong><br>${esc(p.location)}<br>${money(p.total)} · ${p.count} sale${p.count > 1 ? "s" : ""}` + (p.open ? `<br><span class="w">${p.open} not fully paid</span>` : ""), { className: "sm-tip", direction: "top", offset: [0, -size / 2] });
      m.on("click", () => onPick(p.vendorId));
    });
    const active = shown.find((p) => p.vendorId === activeVendor);
    if (active) map.current.flyTo(active.ll, 10, { duration: 0.9 });
    else if (shown.length) map.current.fitBounds(shown.map((p) => p.ll), { padding: [50, 50], maxZoom: 9 });
  }, [pins, activeVendor]); // eslint-disable-line
  return <div ref={el} className="sm-map" />;
}

/* ---------- Revenue trend ---------- */
function Trend({ sales, days }) {
  const [hi, setHi] = useState(null);
  const pts = useMemo(() => {
    const out = [];
    for (let i = days - 1; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push({ k: d.toLocaleDateString("en-CA"), v: 0 }); }
    const idx = Object.fromEntries(out.map((p, i) => [p.k, i]));
    sales.forEach((s) => { if (s.date in idx) out[idx[s.date]].v += s.total; });
    return out;
  }, [sales, days]);
  const n = pts.length; const max = Math.max(1, ...pts.map((p) => p.v));
  const X = (i) => (i / (n - 1)) * 600; const Y = (v) => 120 - (v / max) * 100;
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.v).toFixed(1)}`).join("");
  const move = (e) => { const r = e.currentTarget.getBoundingClientRect(); setHi(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1))))); };
  return (
    <div className="sm-trend" onMouseMove={move} onMouseLeave={() => setHi(null)}>
      <svg viewBox="0 0 600 130" preserveAspectRatio="none" key={n + "-" + sales.length}>
        <defs><linearGradient id="smg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22c55e" stopOpacity=".4" /><stop offset="1" stopColor="#22c55e" stopOpacity="0" /></linearGradient></defs>
        <path d={`${line}L600 130L0 130Z`} fill="url(#smg)" className="area" />
        <path d={line} className="ln" pathLength="1" />
        {hi != null && <line x1={X(hi)} x2={X(hi)} y1="0" y2="130" className="cur" />}
      </svg>
      {hi != null && (
        <div className="tip" style={{ left: `${(hi / (n - 1)) * 100}%` }}>
          <span>{niceDate(pts[hi].k)}</span><strong>{money(pts[hi].v)}</strong>
        </div>
      )}
    </div>
  );
}

/* ---------- Details drawer ---------- */
function Drawer({ sale, items, onClose, onPay, onEdit, onDelete }) {
  const [amt, setAmt] = useState("");
  const left = Math.max(0, sale.total - sale.paid);
  const pct = sale.total ? Math.min(100, (sale.paid / sale.total) * 100) : 0;
  const age = daysAgo(sale.date);
  const late = sale.status !== "PAID" && age > OVERDUE_AFTER;
  return (
    <div className="sm-dscrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="sm-drawer" role="dialog" aria-modal="true" aria-label={`Sale ${sale.id}`}>
        <div className="sm-modal-head">
          <div><h2>Sale #{sale.id}</h2><p className="sm-muted">{niceDate(sale.date)} · {pretty(sale.method)}</p></div>
          <button className="sm-icon" onClick={onClose} aria-label="Close"><Icon d={I.x} /></button>
        </div>
        <div className="sm-dcard">
          <strong>{sale.vendorName}</strong>
          <span className="sm-muted">{sale.location || `Vendor ID ${sale.vendorId}`}</span>
          <span className={"badge " + (late ? "overdue" : STATUS[sale.status]?.cls || "pending")}>{late ? `Overdue · ${age} days` : STATUS[sale.status]?.label || sale.status}</span>
        </div>
        <div className="sm-dcard">
          <div className="sm-row-between"><span className="sm-muted">Paid {money(sale.paid)}</span><strong>{money(sale.total)}</strong></div>
          <div className="sm-bar"><i style={{ "--p": pct + "%" }} /></div>
          <div className="sm-row-between"><span className="sm-muted">{Math.round(pct)}% collected</span><span className={left ? "amber" : "green"}>{left ? `${money(left)} left` : "Paid in full"}</span></div>
          {left > 0 && (
            <div className="sm-pay">
              <input type="number" min="0" step="0.01" placeholder="Payment amount (M)" value={amt} onChange={(e) => setAmt(e.target.value)} />
              <button className="sm-btn primary" disabled={!(Number(amt) > 0)} onClick={() => { onPay(sale, Number(amt)); setAmt(""); }}>Record</button>
              <button className="sm-btn ghost" onClick={() => onPay(sale, left)}>Pay in full</button>
            </div>
          )}
        </div>
        <div className="sm-dcard">
          <strong>Items</strong>
          {items === null ? <span className="sm-muted">Loading items...</span> : items.length === 0 ? <span className="sm-muted">No items found.</span> : items.map((it, n) => (
            <div className="sm-readonly" key={n}>
              <span>{it.fruit_name || `Fruit ${it.fruit_id}`} · {it.packaging_size}<small>{it.quantity} × {money(it.unit_price)}</small></span>
              <strong>{money(it.quantity * it.unit_price)}</strong>
            </div>
          ))}
        </div>
        <div className="sm-modal-foot spread">
          <button className="sm-btn ghost" onClick={() => items && !printReceipt(sale, items) && alert("Allow pop-ups to print the receipt.")} disabled={!items}><Icon d={I.print} /> Receipt</button>
          <button className="sm-btn ghost" onClick={() => onEdit(sale)}><Icon d={I.edit} /> Edit</button>
          <button className="sm-btn danger" onClick={() => onDelete(sale)}><Icon d={I.trash} /> Delete</button>
        </div>
      </aside>
    </div>
  );
}

/* ---------- Modal form ---------- */
const blankItem = () => ({ fruit_id: "", packaging_size: "small", quantity: "", unit_price: "" });

function SaleForm({ editing, initial, vendors, fruits, methods, saving, onSave, onClose }) {
  const [f, setF] = useState(initial);
  const [items, setItems] = useState(editing ? [] : [blankItem()]);
  const [err, setErr] = useState({});
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setItem = (i, k, v) => setItems((p) => p.map((it, n) => (n === i ? { ...it, [k]: v } : it)));
  useEffect(() => {
    if (!editing) return;
    let off = false;
    axios.get(`${API}/sales/${initial.id}`).then((r) => { if (!off) setItems(r.data.data?.items || []); }).catch(() => {});
    return () => { off = true; };
  }, []); // eslint-disable-line
  const total = editing ? initial.total : items.reduce((t, i) => t + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0);
  const submit = (e) => {
    e.preventDefault();
    const er = {};
    if (!f.vendor_id) er.vendor = "Choose a vendor.";
    if (!f.sale_date) er.date = "Pick the sale date.";
    const paid = Number(f.amount_paid || 0);
    if (!(paid >= 0)) er.paid = "Amount can't be negative.";
    if (!editing) {
      const bad = items.some((i) => !i.fruit_id || !(Number(i.quantity) > 0) || i.unit_price === "" || Number(i.unit_price) < 0);
      if (!items.length || bad) er.items = "Each item needs a fruit, a quantity above 0 and a price.";
    }
    setErr(er);
    if (Object.keys(er).length) return;
    const head = { vendor_id: Number(f.vendor_id), sale_date: f.sale_date, payment_method: f.payment_method, amount_paid: paid };
    onSave(editing ? head : { ...head, items: items.map((i) => ({ fruit_id: Number(i.fruit_id), packaging_size: i.packaging_size, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })) });
  };
  return (
    <div className="sm-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="sm-modal wide" role="dialog" aria-modal="true" aria-label={editing ? "Edit sale" : "New sale"} onSubmit={submit} noValidate>
        <div className="sm-modal-head">
          <h2>{editing ? `Edit sale #${initial.id}` : "New sale"}</h2>
          <button type="button" className="sm-icon" onClick={onClose} aria-label="Close"><Icon d={I.x} /></button>
        </div>
        <label>Vendor
          <select value={f.vendor_id} onChange={(e) => set("vendor_id", e.target.value)} className={err.vendor ? "bad" : ""} autoFocus>
            <option value="">Choose a vendor</option>
            {vendors.map((v) => <option key={v.vendor_id} value={v.vendor_id}>{v.vendor_name}{v.location ? ` · ${v.location}` : ""}</option>)}
          </select>
          {err.vendor && <small>{err.vendor}</small>}
        </label>
        <div className="sm-row2">
          <label>Sale date
            <input type="date" value={f.sale_date} onChange={(e) => set("sale_date", e.target.value)} className={err.date ? "bad" : ""} />
            {err.date && <small>{err.date}</small>}
          </label>
          <label>Payment method
            <select value={f.payment_method} onChange={(e) => set("payment_method", e.target.value)}>
              {methods.map((m) => <option key={m} value={m}>{pretty(m)}</option>)}
            </select>
          </label>
        </div>
        <div className="sm-items">
          <div className="sm-items-head">
            <span>{editing ? "Items sold (can't be changed after the sale)" : "Items sold"}</span>
            {!editing && <button type="button" className="sm-link" onClick={() => setItems((p) => [...p, blankItem()])}><Icon d={I.plus} size={14} /> Add item</button>}
          </div>
          {editing ? (
            items.length ? items.map((it, n) => (
              <div className="sm-readonly" key={n}><span>{it.fruit_name || `Fruit ${it.fruit_id}`} · {it.packaging_size}</span><span>{it.quantity} × {money(it.unit_price)}</span></div>
            )) : <div className="sm-readonly"><span>Loading items...</span></div>
          ) : items.map((it, n) => (
            <div className="sm-item" key={n}>
              <select value={it.fruit_id} onChange={(e) => setItem(n, "fruit_id", e.target.value)} aria-label="Fruit">
                <option value="">Fruit</option>
                {fruits.map((fr) => <option key={fr.fruit_id} value={fr.fruit_id}>{fr.fruit_name}</option>)}
              </select>
              <select value={it.packaging_size} onChange={(e) => setItem(n, "packaging_size", e.target.value)} aria-label="Box size">
                {SIZES.map((s) => <option key={s} value={s}>{pretty(s)}</option>)}
              </select>
              <input type="number" min="1" step="1" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(n, "quantity", e.target.value)} aria-label="Quantity" />
              <input type="number" min="0" step="0.01" placeholder="Price (M)" value={it.unit_price} onChange={(e) => setItem(n, "unit_price", e.target.value)} aria-label="Unit price" />
              <button type="button" className="sm-icon del" disabled={items.length === 1} onClick={() => setItems((p) => p.filter((_, x) => x !== n))} aria-label="Remove item"><Icon d={I.x} size={15} /></button>
            </div>
          ))}
          {err.items && <small>{err.items}</small>}
        </div>
        <div className="sm-row2">
          <label>Amount paid (M)
            <input type="number" min="0" step="0.01" value={f.amount_paid} onChange={(e) => set("amount_paid", e.target.value)} className={err.paid ? "bad" : ""} placeholder="0.00" />
            {err.paid && <small>{err.paid}</small>}
          </label>
          <div className="sm-total"><span>Sale total</span><strong>{money(total)}</strong></div>
        </div>
        <div className="sm-modal-foot">
          <button type="button" className="sm-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="sm-btn primary" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Add sale"}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------- Page ---------- */
export default function Sales() {
  const [sales, setSales] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [fruits, setFruits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [range, setRange] = useState(0);
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const [vendorFilter, setVendorFilter] = useState(null);
  const [showMap, setShowMap] = useState(true);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [leaving, setLeaving] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [detailItems, setDetailItems] = useState(null);
  const searchRef = useRef(null);

  const toast = (msg, type = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  };

  const load = useCallback(async (quiet) => {
    if (!quiet) setLoading(true);
    try {
      const [s, v, f] = await Promise.all([axios.get(API + "/sales"), axios.get(API + "/vendors"), axios.get(API + "/fruits")]);
      setSales((s.data.data || []).map(norm));
      setVendors(v.data.data || []);
      setFruits(f.data.data || []);
      setError("");
    } catch (e) {
      setError(e.response?.status === 404 ? "The server doesn't have the sales list yet. Deploy the updated backend, then try again." : "Can't reach the server. Check your connection and try again.");
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (detailId == null) return;
    let off = false; setDetailItems(null);
    axios.get(`${API}/sales/${detailId}`).then((r) => !off && setDetailItems(r.data.data?.items || [])).catch(() => !off && setDetailItems([]));
    return () => { off = true; };
  }, [detailId]);

  const openAdd = () => setModal({ mode: "add", sale: { vendor_id: "", sale_date: today(), payment_method: "cash", amount_paid: 0 } });
  const openEdit = (s) => { setDetailId(null); setModal({ mode: "edit", sale: { id: s.id, total: s.total, vendor_id: s.vendorId, sale_date: s.date, payment_method: s.method || "cash", amount_paid: s.paid } }); };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { setModal(null); setConfirm(null); setDetailId(null); return; }
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey || modal || confirm) return;
      const k = e.key.toLowerCase();
      if (k === "/") { e.preventDefault(); searchRef.current?.focus(); }
      else if (k === "n") { e.preventDefault(); openAdd(); }
      else if (k === "m") setShowMap((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const methods = useMemo(() => [...new Set(["cash", ...sales.map((s) => s.method).filter(Boolean)])], [sales]);
  const scoped = useMemo(() => sales.filter((s) => !range || daysAgo(s.date) <= range), [sales, range]);
  const texts = useMemo(() => [...new Set(sales.map((s) => s.location).filter(Boolean))], [sales]);
  const geo = useGeo(texts);

  const pins = useMemo(() => {
    const by = {};
    scoped.forEach((s) => {
      const b = (by[s.vendorId] ||= { vendorId: s.vendorId, name: s.vendorName, location: s.location, total: 0, count: 0, open: 0 });
      b.total += s.total; b.count += 1; if (s.status !== "PAID") b.open += 1;
    });
    return Object.values(by).map((b) => ({ ...b, ll: locate(b.location, geo) }));
  }, [scoped, geo]);
  const missing = pins.filter((p) => !p.ll).length;
  const top = useMemo(() => [...pins].sort((a, b) => b.total - a.total).slice(0, 5), [pins]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = scoped.filter((s) => {
      if (status !== "All" && s.status !== status) return false;
      if (vendorFilter != null && s.vendorId !== vendorFilter) return false;
      if (!q) return true;
      return [s.id, s.vendorName, s.location, s.method, STATUS[s.status]?.label, s.date, s.total].join(" ").toLowerCase().includes(q);
    });
    const k = sort.key; const dir = sort.dir === "asc" ? 1 : -1;
    const val = (s) => (k === "id" || k === "total" ? s[k] : String(s[k]).toLowerCase());
    return [...list].sort((a, b) => (val(a) > val(b) ? dir : val(a) < val(b) ? -dir : 0));
  }, [scoped, query, status, vendorFilter, sort]);

  const sum = (fn) => scoped.reduce((t, s) => t + fn(s), 0);
  const rawTotal = sum((s) => s.total); const rawPaid = sum((s) => s.paid);
  const overdueCount = scoped.filter((s) => s.status !== "PAID" && daysAgo(s.date) > OVERDUE_AFTER).length;
  const totalAll = useCountUp(rawTotal); const totalPaid = useCountUp(rawPaid);
  const totalOwed = useCountUp(Math.max(0, rawTotal - rawPaid)); const countAll = useCountUp(scoped.length, 500);
  const chartDays = range || Math.min(120, Math.max(14, ...sales.map((s) => daysAgo(s.date) + 1)));

  const save = async (payload) => {
    setSaving(true);
    try {
      if (modal.mode === "edit") { await axios.put(`${API}/sales/${modal.sale.id}`, payload); toast(`Sale #${modal.sale.id} updated`); }
      else { const r = await axios.post(`${API}/sales`, payload); toast(`Sale #${r.data.sale_id} added`); }
      setModal(null); await load(true);
    } catch (e) { toast(errMsg(e, "Couldn't save the sale. Check the details and try again."), "warn"); }
    setSaving(false);
  };

  const remove = async (s) => {
    setConfirm(null); setDetailId(null); setLeaving(s.id);
    try {
      await axios.delete(`${API}/sales/${s.id}`);
      setTimeout(async () => { await load(true); setLeaving(null); toast(`Sale #${s.id} deleted and stock returned`, "warn"); }, 320);
    } catch (e) { setLeaving(null); toast(errMsg(e, "Couldn't delete the sale."), "warn"); }
  };

  const pay = async (s, amount) => {
    try {
      const next = Math.min(s.total, s.paid + amount);
      await axios.put(`${API}/sales/${s.id}`, { amount_paid: next });
      toast(next >= s.total ? `Sale #${s.id} is paid in full` : `${money(amount)} recorded on sale #${s.id}`);
      await load(true);
    } catch (e) { toast(errMsg(e, "Couldn't record the payment."), "warn"); }
  };

  const exportCsv = () => {
    const head = ["Sale ID", "Vendor", "Location", "Date", "Status", "Method", "Paid", "Total"];
    const body = rows.map((s) => [s.id, s.vendorName, s.location, s.date, STATUS[s.status]?.label || s.status, s.method, s.paid, s.total]);
    const csv = [head, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "batloung-sales.csv"; a.click(); URL.revokeObjectURL(a.href);
    toast(`Exported ${rows.length} sale${rows.length === 1 ? "" : "s"}`);
  };

  const toggleSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  const pickVendor = (id) => setVendorFilter((cur) => (cur === id ? null : id));
  const activeName = vendorFilter != null ? sales.find((s) => s.vendorId === vendorFilter)?.vendorName : "";
  const detail = sales.find((s) => s.id === detailId);

  const Th = ({ k, children, right }) => (
    <th className={right ? "r" : ""} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button className={"sm-sort" + (sort.key === k ? " on" : "")} onClick={() => toggleSort(k)}>
        {children}<span className={"arr " + (sort.key === k ? sort.dir : "")}><Icon d={I.arrow} size={13} /></span>
      </button>
    </th>
  );

  return (
    <section className="sm">
      <header className="sm-top">
        <h1>Sales Management</h1>
        <div className="sm-tools">
          <label className="sm-search">
            <Icon d={I.search} />
            <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search sales...  ( / )" />
          </label>
          <button className="sm-btn ghost" onClick={() => setShowMap((v) => !v)} aria-pressed={showMap} title="Shortcut: M"><Icon d={I.map} /> {showMap ? "Hide map" : "Show map"}</button>
          <button className="sm-btn ghost" onClick={exportCsv} disabled={!rows.length}><Icon d={I.download} /> Export</button>
          <button className="sm-btn primary sheen" onClick={openAdd} title="Shortcut: N"><Icon d={I.plus} /> New sale</button>
        </div>
      </header>

      {error && <div className="sm-banner"><span>{error}</span><button className="sm-btn ghost" onClick={() => load()}>Try again</button></div>}

      <div className="sm-stats">
        <div className="sm-stat"><span>Total sales</span><strong>{money(totalAll)}</strong><em>{scoped.length ? `Average ${money(rawTotal / scoped.length)}` : "No sales yet"}</em></div>
        <div className="sm-stat good"><span>Collected</span><strong>{money(totalPaid)}</strong><em>{rawTotal ? Math.round((rawPaid / rawTotal) * 100) : 0}% of sales value</em></div>
        <div className="sm-stat warn"><span>Still owed</span><strong>{money(totalOwed)}</strong><em>{overdueCount ? `${overdueCount} overdue` : "Nothing overdue"}</em></div>
        <div className="sm-stat"><span>Number of sales</span><strong>{Math.round(countAll)}</strong><em>{pins.length} vendor{pins.length === 1 ? "" : "s"}</em></div>
      </div>

      <div className="sm-insights">
        <div className="sm-panel">
          <div className="sm-panel-head"><h3>Revenue, last {chartDays} days</h3><span>{money(rawTotal)}</span></div>
          <Trend sales={scoped} days={chartDays} />
        </div>
        <div className="sm-panel">
          <div className="sm-panel-head"><h3>Top vendors</h3></div>
          {top.length ? top.map((p) => (
            <button key={p.vendorId} className={"sm-vrow" + (vendorFilter === p.vendorId ? " on" : "")} onClick={() => pickVendor(p.vendorId)}>
              <span>{p.name}</span><strong>{money(p.total)}</strong>
              <i style={{ "--w": (p.total / top[0].total) * 100 + "%" }} />
            </button>
          )) : <p className="sm-muted">No sales in this period.</p>}
        </div>
      </div>

      {showMap && (
        <div className="sm-mapwrap">
          <SalesMap pins={pins} activeVendor={vendorFilter} onPick={pickVendor} />
          <div className="sm-legend">
            <span><i className="g" /> All paid</span>
            <span><i className="a" /> Has unpaid sales</span>
            <span>Bigger pin = more revenue. Click a pin to filter.</span>
            {missing > 0 && <span>Finding {missing} vendor location{missing > 1 ? "s" : ""}...</span>}
          </div>
        </div>
      )}

      <div className="sm-filters">
        {FILTERS.map((s) => (
          <button key={s} className={"chip" + (status === s ? " on" : "")} onClick={() => setStatus(s)}>
            {s === "All" ? "All" : STATUS[s].label}<em>{s === "All" ? scoped.length : scoped.filter((x) => x.status === s).length}</em>
          </button>
        ))}
        <span className="sm-gap" />
        {RANGES.map(([d, label]) => <button key={d} className={"chip" + (range === d ? " on" : "")} onClick={() => setRange(d)}>{label}</button>)}
        {vendorFilter != null && <button className="chip vendor" onClick={() => setVendorFilter(null)}>{activeName} <Icon d={I.x} size={13} /></button>}
      </div>

      <div className="sm-card">
        {loading ? (
          <div className="sm-loading"><i /> Loading sales...</div>
        ) : (
          <div className="sm-scroll">
            <table>
              <thead>
                <tr>
                  <Th k="id">Sale ID</Th><Th k="vendorName">Vendor</Th><Th k="date">Sale date</Th>
                  <Th k="status">Payment status</Th><Th k="method">Payment method</Th><Th k="total" right>Total amount</Th>
                  <th className="r"><span className="sm-sort static">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const age = daysAgo(s.date); const late = s.status !== "PAID" && age > OVERDUE_AFTER;
                  return (
                    <tr key={s.id} className={leaving === s.id ? "out" : ""} style={{ "--i": Math.min(i, 10) }} onClick={() => setDetailId(s.id)}>
                      <td className="id">#{s.id}</td>
                      <td><span className="vid">{s.vendorName}</span><small>{s.location || `Vendor ID ${s.vendorId}`}</small></td>
                      <td>{niceDate(s.date)}</td>
                      <td><span className={"badge " + (late ? "overdue" : STATUS[s.status]?.cls || "pending")}>{late ? `Overdue · ${age}d` : STATUS[s.status]?.label || s.status}</span></td>
                      <td>{pretty(s.method)}</td>
                      <td className="r amt">{money(s.total)}{s.status !== "PAID" && <small>Paid {money(s.paid)}</small>}</td>
                      <td className="r" onClick={(e) => e.stopPropagation()}>
                        <div className="acts">
                          {s.status !== "PAID" && <button className="sm-icon ok" title="Mark as paid" aria-label={`Mark sale ${s.id} as paid`} onClick={() => pay(s, s.total - s.paid)}><Icon d={I.check} /></button>}
                          <button className="sm-icon" title="Edit" aria-label={`Edit sale ${s.id}`} onClick={() => openEdit(s)}><Icon d={I.edit} /></button>
                          <button className="sm-icon del" title="Delete" aria-label={`Delete sale ${s.id}`} onClick={() => setConfirm(s)}><Icon d={I.trash} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && !error && (
              <div className="sm-empty">
                <strong>{sales.length === 0 ? "No sales yet" : "Nothing matches"}</strong>
                <span>{sales.length === 0 ? "Record your first sale to see it here and on the map." : "Try a different search, period or filter."}</span>
                {sales.length === 0 && <button className="sm-btn primary" onClick={openAdd}>New sale</button>}
              </div>
            )}
          </div>
        )}
      </div>

      {detail && <Drawer sale={detail} items={detailItems} onClose={() => setDetailId(null)} onPay={pay} onEdit={openEdit} onDelete={(s) => setConfirm(s)} />}

      {modal && <SaleForm key={modal.mode + (modal.sale.id || "new")} editing={modal.mode === "edit"} initial={modal.sale} vendors={vendors} fruits={fruits} methods={methods} saving={saving} onSave={save} onClose={() => setModal(null)} />}

      {confirm && (
        <div className="sm-scrim top" onMouseDown={(e) => e.target === e.currentTarget && setConfirm(null)}>
          <div className="sm-modal small" role="alertdialog" aria-modal="true">
            <h2>Delete sale #{confirm.id}?</h2>
            <p>{money(confirm.total)} for {confirm.vendorName}. The boxes in this sale go back into stock. This can't be undone.</p>
            <div className="sm-modal-foot">
              <button className="sm-btn ghost" onClick={() => setConfirm(null)} autoFocus>Keep sale</button>
              <button className="sm-btn danger" onClick={() => remove(confirm)}>Delete sale</button>
            </div>
          </div>
        </div>
      )}

      <div className="sm-toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={"sm-toast " + t.type}>{t.msg}</div>)}
      </div>
    </section>
  );
}