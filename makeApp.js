const fs = require('fs'); 
const code = String.raw`import { useState, useEffect } from 'react'; 
import axios from 'axios'; 
import { FaBox, FaTruck, FaUsers, FaTrash, FaPlus, FaAppleAlt, FaTimes } from 'react-icons/fa'; 
const API_URL = 'https://batloung-farm-production.up.railway.app/api'; 
export default function App() { 
  const [activeTab, setActiveTab] = useState('suppliers'); 
  const [data, setData] = useState([]); 
  const [loading, setLoading] = useState(false); 
  const [showModal, setShowModal] = useState(false); 
  const [formData, setFormData] = useState({}); 
  const fetchData = async () => { 
    setLoading(true); 
    try { 
      const res = await axios.get(API_URL + '/' + activeTab); 
    } catch (err) { console.error(err); setData([]); } 
    setLoading(false); 
  }; 
  useEffect(() => { fetchData(); }, [activeTab]); 
  const handleDelete = async (id) => { 
    if(!window.confirm('Are you sure?')) return; 
    try { await axios.delete(API_URL + '/' + activeTab + '/' + id); fetchData(); } 
    catch (err) { alert('Cannot delete. Linked to other records.'); } 
  }; 
  const handleAdd = async (e) => { 
    e.preventDefault(); 
    try { 
      await axios.post(API_URL + '/' + activeTab, formData); 
      setShowModal(false); setFormData({}); fetchData(); 
    } catch (err) { alert('Error adding record.'); } 
  }; 
  return ( 
    <div className='flex h-screen bg-slate-900 text-slate-100'> 
      <div className='w-64 bg-slate-800 p-6 shadow-2xl flex flex-col'> 
        <h1 className='text-2xl font-bold text-green-400 mb-10 flex items-center gap-2'><FaAppleAlt /> Batloung Farm</h1> 
        <nav className='space-y-4 flex-1'> 
          <button onClick={() => setActiveTab('suppliers')} className={'w-full flex items-center gap-3 p-3 rounded-lg transition ' + (activeTab === 'suppliers' ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-slate-700')}><FaTruck /> Suppliers</button> 
          <button onClick={() => setActiveTab('fruits')} className={'w-full flex items-center gap-3 p-3 rounded-lg transition ' + (activeTab === 'fruits' ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-slate-700')}><FaBox /> Fruits</button> 
          <button onClick={() => setActiveTab('vendors')} className={'w-full flex items-center gap-3 p-3 rounded-lg transition ' + (activeTab === 'vendors' ? 'bg-green-600 text-white shadow-lg' : 'hover:bg-slate-700')}><FaUsers /> Vendors</button> 
        </nav> 
      </div> 
      <div className='flex-1 p-10 overflow-y-auto'> 
        <div className='flex justify-between items-center mb-8'> 
          <h2 className='text-3xl font-bold capitalize'>{activeTab} Management</h2> 
          <button onClick={() => setShowModal(true)} className='bg-green-500 hover:bg-green-400 text-white px-5 py-2 rounded-lg flex items-center gap-2 font-semibold transition shadow-lg'><FaPlus /> Add New</button> 
        </div> 
        {loading ? <p className='text-center text-slate-400 animate-pulse text-xl'>Loading data from Railway...</p> : ( 
          <div className='bg-slate-800 rounded-xl shadow-xl overflow-hidden border border-slate-700'> 
            <table className='w-full text-left'> 
              <thead className='bg-slate-700 text-slate-300 uppercase text-sm'><tr>{data.length > 0 && Object.keys(data[0]).map(key => <th key={key} className='p-4'>{key.replace('_', ' ')}</th>)}<th className='p-4'>Actions</th></tr></thead> 
              <tbody className='divide-y divide-slate-700'> 
                {data.map((item, index) => ( 
                  <tr key={index} className='hover:bg-slate-700/50 transition'> 
                    {Object.values(item).map((val, i) => <td key={i} className='p-4'>{val}</td>)} 
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
            <h3 className='text-2xl font-bold mb-6 capitalize'>Add New {activeTab}</h3> 
            <form onSubmit={handleAdd} className='space-y-4'> 
              {activeTab === 'suppliers' && <><input required placeholder='Business Name' className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, business_name: e.target.value})} /><input required placeholder='Contact Person' className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, contact_person: e.target.value})} /><input required placeholder='Phone' className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, phone: e.target.value})} /><select required className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, province: e.target.value})}<option value=''>Select Province</option><option value='Gauteng'>Gauteng</option><option value='Western Cape'>Western Cape</option><option value='Free State'>Free State</option></select><input required placeholder='Address' className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, address: e.target.value})} /></>} 
              {activeTab === 'fruits' && <><input required placeholder='Fruit Name' className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, fruit_name: e.target.value})} /><input required placeholder='Description' className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, description: e.target.value})} /></>} 
              {activeTab === 'vendors' && <><input required placeholder='Vendor Name' className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, vendor_name: e.target.value})} /><input required placeholder='Phone Number' className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, phone_number: e.target.value})} /><input required placeholder='Location' className='w-full p-3 rounded bg-slate-900 border border-slate-700 focus:border-green-500 outline-none' onChange={e => setFormData({...formData, location: e.target.value})} /></>} 
              <div className='flex justify-end gap-3 mt-6'><button type='button' onClick={() => setShowModal(false)} className='px-4 py-2 rounded text-slate-400 hover:text-white'>Cancel</button><button type='submit' className='bg-green-500 hover:bg-green-400 text-white px-6 py-2 rounded font-bold shadow-lg'>Save</button></div> 
            </form> 
          </div> 
        </div> 
      )} 
    </div> 
  ); 
} 
`; 
fs.writeFileSync('./src/App.jsx', code); 
console.log('? App.jsx created successfully!'); 
