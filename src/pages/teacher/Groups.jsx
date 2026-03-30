import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    // Загружаем группы + считаем студентов в каждой
    const { data, error } = await supabase
      .from('groups')
      .select('*, students(id)')
      .order('name');

    if (!error && data) {
      setGroups(data);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('practi_user');
    navigate('/');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0b0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#8892b0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px',
            border: '3px solid #1e2130',
            borderTopColor: '#4f6ef7',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px'
          }} />
          Загрузка групп...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0b0f', color: '#f1f3f9' }}>
      {/* Навбар */}
      <div style={{
        background: 'rgba(10,11,15,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #1e2130',
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.5rem' }}>📋</span>
          <h1 style={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #4f6ef7, #7c3aed)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Practi-QR</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/admin')}
            style={{
              background: 'rgba(79,110,247,0.1)',
              color: '#4f6ef7',
              border: '1px solid rgba(79,110,247,0.2)',
              padding: '8px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            ⚙️ Админ-панель
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.2)',
              padding: '8px 16px',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            Выйти
          </button>
        </div>
      </div>

      {/* Контент */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>Группы практикантов</h2>
        <p style={{ color: '#8892b0', marginBottom: '2rem' }}>Выберите группу для просмотра посещаемости</p>

        {groups.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            color: '#8892b0'
          }}>
            <div style={{ fontSize: '3rem', opacity: 0.4, marginBottom: '1rem' }}>📂</div>
            <p>Групп пока нет. Добавьте их в админ-панели.</p>
            <button
              onClick={() => navigate('/admin')}
              style={{
                marginTop: '1rem',
                background: 'linear-gradient(135deg, #4f6ef7, #7c3aed)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Перейти в админ-панель
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1.25rem'
          }}>
            {groups.map(group => (
              <div
                key={group.id}
                onClick={() => navigate(`/teacher/attendance/${group.id}`)}
                style={{
                  background: '#16181f',
                  border: '1px solid #1e2130',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#3d4466';
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 20px 60px rgba(0,0,0,0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#1e2130';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  fontSize: '2rem',
                  marginBottom: '0.75rem'
                }}>🎓</div>
                <h3 style={{
                  margin: '0 0 0.5rem 0',
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#4f6ef7'
                }}>{group.name}</h3>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#8892b0',
                  fontSize: '0.85rem'
                }}>
                  <span>👥</span>
                  <span>{group.students?.length || 0} студентов</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Groups;
