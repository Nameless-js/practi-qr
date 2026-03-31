import React, { useState } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useNavigate } from 'react-router-dom'; // Добавляем навигацию

const ManageUsers = () => {
  const [formData, setFormData] = useState({ login: '', password: '', role: 'student', name: '' });
  const navigate = useNavigate(); // Инициализируем

  const handleCreate = async (e) => {
    e.preventDefault();
    // ... твоя логика создания пользователя ...
    alert("Пользователь создан!");
  };

  return (
    <div style={{ padding: '40px', background: '#121212', color: 'white', minHeight: '100vh' }}>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '30px' }}>
        <button 
          onClick={() => navigate(-1)} // Возврат на предыдущую страницу
          style={{ background: '#333', color: 'white', border: 'none', padding: '8px 15px', cursor: 'pointer', borderRadius: '5px' }}
        >
          ← Назад
        </button>
        <h1 style={{ margin: 0 }}>Управление пользователями</h1>
      </div>

      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '400px' }}>
        <input 
          placeholder="ФИО / Название" 
          style={{ padding: '12px', background: '#1e1e1e', border: '1px solid #333', color: 'white' }}
          onChange={e => setFormData({...formData, name: e.target.value})} 
        />
        {/* ... остальные инпуты ... */}
        <button type="submit" style={{ background: '#10b981', color: 'white', border: 'none', padding: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
          Создать аккаунт
        </button>
      </form>
    </div>
  );
};

export default ManageUsers;