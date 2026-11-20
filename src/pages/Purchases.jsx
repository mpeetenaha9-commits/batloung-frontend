import { useEffect, useState } from "react";
import axios from "axios";

const API = "https://batloung-farm-production.up.railway.app/api";
const money = (n) => "M " + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const niceDate = (s) => new Date(s + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default function Purchases() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    axios.get(API + "/purchases")
      .then((r) => setPurchases(r.data.data || []))
      .catch(() => setError("Could not load purchases."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="sm" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ marginBottom: '24px' }}>
        <h1>Purchases Management</h1>
        <p style={{ color: '#666' }}>Track stock bought from suppliers.</p>
      </header>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>{error}</div>}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Loading purchases...</div>
        ) : purchases.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px 0' }}>No purchases yet</h3>
            <p style={{ color: '#666', margin: 0 }}>When you buy stock from a supplier, it will appear here.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>ID</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Supplier</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Date</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Items</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.purchase_id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '16px' }}>#{p.purchase_id}</td>
                  <td style={{ padding: '16px' }}>
                    <strong>{p.supplier_name || `Supplier ${p.supplier_id}`}</strong>
                    {p.supplier_province && <><br /><small style={{ color: '#666' }}>{p.supplier_province}</small></>}
                  </td>
                  <td style={{ padding: '16px' }}>{niceDate(p.purchase_date)}</td>
                  <td style={{ padding: '16px' }}>{p.item_count} item(s) ({p.total_boxes} boxes)</td>
                  <td style={{ padding: '16px', textAlign: 'right', fontWeight: '600' }}>{money(p.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}