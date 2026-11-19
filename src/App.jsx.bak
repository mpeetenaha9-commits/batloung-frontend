import { useState, useEffect } from 'react';
import axios from 'axios';
import { FaBox, FaTruck, FaUsers, FaTrash, FaPlus, FaAppleAlt, FaTimes, FaEdit, FaShoppingCart, FaMoneyBillWave, FaSearch } from 'react-icons/fa';

const API_URL = 'https://batloung-farm-production.up.railway.app/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('suppliers');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'purchases' ? 'purchases' : activeTab === 'sales' ? 'sales' : activeTab;
      const res = await axios.get(API_URL + '/' + endpoint);
      setData(res.data.data || []);
    } catch (err) { console.error(err); setData([]); }
    setLoading(false);
  };

  useEffect(() => { 
    fetchData(); 
    setSearchTerm('');
  }, [activeTab]);

  const handleDelete = async (id) => {
    if(!window.confirm('Are you sure you want to delete this?')) return;
    try {
      await axios.delete(API_URL + '/' + activeTab + '/' + id);
      fetchData();
    } catch (err) { alert('Cannot delete. Linked to other records.'); }
  };

  const handleEdit = (item) => {
    setFormData(item);
    setEditMode(true);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setFormData({});
    setEditMode(false);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const id = formData.supplier_id || formData.fruit_id || formData.vendor_id;
      if (editMode && id) {
        await axios.put(API_URL + '/' + activeTab + '/' + id, formData);
      } else {
        await axios.post(API_URL + '/' + activeTab, formData);
      }
      setShowModal(false); setFormData({}); fetchData();
    } catch (err) { alert('Error saving record.'); }
  };

  const getColumns = () => {
    if (activeTab === 'purchases') return ['purchase_id', 'supplier_id', 'purchase_date', 'total_amount'];
    if (activeTab === 'sales') return ['sale_id', 'vendor_id', 'sale_date', 'payment_status', 'payment_method', 'total_amount'];
    if (activeTab === 'suppliers') return ['supplier_id', 'business_name', 'contact_person', 'phone', 'province', 'address'];
    if (activeTab === 'fruits') return ['fruit_id', 'fruit_name', 'description', 'status'];
    if (activeTab === 'vendors') return ['vendor_id', 'vendor_name', 'phone_number', 'location', 'registration_date'];
    return [];
  };

  const columns = getColumns();

  const filteredData = data.filter(item => {
    if (!searchTerm) return true;
    return Object.values(item).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <div className='flex h-screen bg-slate-900 text-slate-100'>
      
      <div className='w-64 bg-slate-800 p-6 shadow-2xl flex flex-col border-r border-slate-700'>
        <h1 className='text-2xl font-bold text-green-400 mb-10 flex items-center gap-2'><FaAppleAlt /> Batloung Farm</h1>
        <nav className='space-y-3 flex-1'>
          <button onClick={() => setActiveTab('suppliers')} className={'w-full flex items-center gap-3 p-3 rounded-lg transition ' + (activeTab === 'suppliers' ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-slate-700')}><FaTruck /> Suppliers</button>
          <button onClick={() => setActiveTab('fruits')} className={'w-full flex items-center gap-3 p-3 rounded-lg transition ' + (activeTab === 'fruits' ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-slate-700')}><FaBox /> Fruits</button>
          <button onClick={() => setActiveTab('vendors')} className={'w-full flex items-center gap-3 p-3 rounded-lg transition ' + (activeTab === 'vendors' ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-slate-700')}><FaUsers /> Vendors</button>
          
          <div className='border-t border-slate-700 pt-3 mt-3'>
            <button onClick={() => setActiveTab('purchases')} className={'w-full flex items-center gap-3 p-3 rounded-lg transition ' + (activeTab === 'purchases' ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-slate-700')}><FaShoppingCart /> Purchases</button>
            <button onClick={() => setActiveTab('sales')} className={'w-full flex items-center gap-3 p-3 rounded-lg transition ' + (activeTab === 'sales' ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-slate-700')}><FaMoneyBillWave /> Sales</button>
          </div>
        </nav>
      </div>

      <div className='flex-1 p-10 overflow-y-auto'>
        <div className='flex justify-between items-center mb-8'>
          <h2 className='text-3xl font-bold capitalize'>{activeTab} Management</h2>
          
          <div className='flex items-center gap-4'>
            <div className='relative'>
              <FaSearch className='absolute left-3 top-3 text-slate-400' />
              <input 
                type="text" 
                placeholder="Search..." 
                className='pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 focus:border-green-500 outline-none text-sm w-64 transition'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* HIDE ADD BUTTON FOR PURCHASES AND SALES */}
            {activeTab !== 'purchases' && activeTab !== 'sales' && (
              <button onClick={handleAddNew} className='bg-green-500 hover:bg-green-400 text-white px-5 py-2 rounded-lg flex items-center gap-2 font-semibold transition shadow-lg shadow-green-500/30'><FaPlus /> Add New</button>
            )}
          </div>
        </div>

        {loading ? (
          <div className='flex justify-center items-center h-64'>
            <div className='animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-green-500'></div>
          </div>
        ) : (
          <div className='bg-slate-800 rounded-xl shadow-xl overflow-hidden border border-slate-700'>
            <table className='w-full text-left'>
              <thead className='bg-slate-700 text-slate-300 uppercase text-sm'>
                <tr>
                  {columns.map(key => <th key={key} className='p-4'>{key.replace('_', ' ')}</th>)}
                  <th className='p-4 text-right'>Actions</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-700'>
                {filteredData.map((item, index) => (
                  <tr key={index} className='hover:bg-slate-700/50 transition'>
                    {columns.map(key => <td key={key} className='p-4'>{item[key]}</td>)}
                    <td className='p-4 flex justify-end gap-3'>
                      <button onClick={() => handleEdit(item)} className='text-blue-400 hover:text-blue-300 p-2 transition'><FaEdit /></button>
                      <button onClick={() => handleDelete(item.supplier_id || item.fruit_id || item.vendor_id || item.purchase_id || item.sale_id)} className='text-red-400 hover:text-red-300 p-2 transition'><FaTrash /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50'>
          <div className='bg-slate-800 p-8 rounded-2xl w-96 shadow-2xl border border-slate-600 relative'>
            <button onClick={() => setShowModal(false)} className='absolute top-4 right-4 text-slate-400 hover:text-white'><FaTimes /></button>
            <h3 className='text-2xl font-bold mb-6 capitalize'>{editMode ? 'Edit' : 'Add'} {activeTab}</h3>
            <form onSubmit={handleSubmit} className='space-y-4'>
              
              {activeTab === 'suppliers' && <><input required placeholder='Business Name' defaultValue={formData.business_name} className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, business_name: e.target.value})} /><input required placeholder='Contact Person' defaultValue={formData.contact_person} className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, contact_person: e.target.value})} /><input required placeholder='Phone' defaultValue={formData.phone} className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, phone: e.target.value})} /><select required defaultValue={formData.province} className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, province: e.target.value})}><option value=''>Select Province</option><option value='Gauteng'>Gauteng</option><option value='Western Cape'>Western Cape</option><option value='Free State'>Free State</option></select><input required placeholder='Address' defaultValue={formData.address} className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, address: e.target.value})} /></>}
              
              {activeTab === 'fruits' && <><input required placeholder='Fruit Name' defaultValue={formData.fruit_name} className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, fruit_name: e.target.value})} /><input required placeholder='Description' defaultValue={formData.description} className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, description: e.target.value})} /></>}
              
              {activeTab === 'vendors' && <><input required placeholder='Vendor Name' defaultValue={formData.vendor_name} className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, vendor_name: e.target.value})} /><input required placeholder='Phone Number' defaultValue={formData.phone_number} className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, phone_number: e.target.value})} /><input required placeholder='Location' defaultValue={formData.location} className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, location: e.target.value})} /></>}
              
              <div className='flex justify-end gap-3 mt-6'><button type='button' onClick={() => setShowModal(false)} className='px-4 py-2 rounded text-slate-400 hover:text-white'>Cancel</button><button type='submit' className='bg-green-500 hover:bg-green-400 text-white px-6 py-2 rounded font-bold shadow-lg'>Save</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}