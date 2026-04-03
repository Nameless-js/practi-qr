import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';

const Groups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState(null);
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
      {/* Адаптивные стили */}
      <style>{`
        .grp-navbar {
          background: rgba(10,11,15,0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid #1e2130;
          padding: 0.85rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
          gap: 10px;
          flex-wrap: wrap;
        }
        .grp-navbar-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .grp-navbar-logo h1 {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 700;
          background: linear-gradient(135deg, #4f6ef7, #7c3aed);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          white-space: nowrap;
        }
        .grp-navbar-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .grp-btn-admin {
          background: rgba(79,110,247,0.1);
          color: #4f6ef7;
          border: 1px solid rgba(79,110,247,0.2);
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.82rem;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .grp-btn-logout {
          background: rgba(239,68,68,0.1);
          color: #ef4444;
          border: 1px solid rgba(239,68,68,0.2);
          padding: 8px 14px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.82rem;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .grp-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
        }
        .grp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1.25rem;
        }
        @media (max-width: 480px) {
          .grp-navbar { padding: 0.65rem 0.85rem; }
          .grp-navbar-logo h1 { font-size: 1rem; }
          .grp-btn-admin { font-size: 0.75rem; padding: 7px 10px; }
          .grp-btn-logout { font-size: 0.75rem; padding: 7px 10px; }
          .grp-content { padding: 1.25rem 0.85rem; }
          .grp-grid { grid-template-columns: 1fr; gap: 0.85rem; }
        }
      `}</style>

      {/* Навбар */}
      <div className="grp-navbar">
        <div className="grp-navbar-logo">
          <span style={{ fontSize: '1.4rem' }}>📋</span>
          <h1>Practi-QR</h1>
        </div>
        <div className="grp-navbar-actions">
          <button className="grp-btn-admin" onClick={() => navigate('/admin')}>
            ⚙️ Админ-панель
          </button>
          <button className="grp-btn-logout" onClick={handleLogout}>
            Выйти
          </button>
        </div>
      </div>

      {/* Контент */}
      <div className="grp-content">
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.5rem' }}>Группы практикантов</h2>
        <p style={{ color: '#8892b0', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Выберите группу для просмотра посещаемости</p>

        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#8892b0' }}>
            <div style={{ fontSize: '3rem', opacity: 0.4, marginBottom: '1rem' }}>📂</div>
            <p>Групп пока нет. Добавьте их в админ-панели.</p>
            <button
              onClick={() => navigate('/admin')}
              style={{
                marginTop: '1rem',
                background: 'linear-gradient(135deg, #4f6ef7, #7c3aed)',
                color: 'white', border: 'none',
                padding: '12px 24px', borderRadius: '12px',
                cursor: 'pointer', fontWeight: 600
              }}
            >
              Перейти в админ-панель
            </button>
          </div>
        ) : (
          <div className="grp-grid">
            {groups.map(group => (
              <div
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                style={{
                  background: '#16181f', border: '1px solid #1e2130',
                  borderRadius: '16px', padding: '1.5rem',
                  cursor: 'pointer', transition: 'all 0.3s ease',
                  position: 'relative', overflow: 'hidden'
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
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎓</div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 700, color: '#4f6ef7' }}>
                  {group.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8892b0', fontSize: '0.85rem' }}>
                  <span>👥</span>
                  <span>{group.students?.length || 0} студентов</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Модальное окно выбора типа практики */}
      {selectedGroup && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setSelectedGroup(null)}>
          <div style={{
            background: '#16181f', padding: '2rem', borderRadius: '16px',
            border: '1px solid #1e2130', width: '90%', maxWidth: '400px',
            textAlign: 'center'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.3rem', color: '#f1f3f9' }}>
              Выберите тип практики
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => navigate(`/teacher/attendance/${selectedGroup.id}`)}
                style={{
                  background: 'linear-gradient(135deg, #4f6ef7, #7c3aed)',
                  color: 'white', border: 'none', padding: '14px', borderRadius: '12px',
                  cursor: 'pointer', fontWeight: 600, fontSize: '1rem'
                }}
              >
                Производственная практика
              </button>
              <button
                onClick={() => navigate(`/teacher/normal-subjects/${selectedGroup.id}`)}
                style={{
                  background: 'rgba(79,110,247,0.1)',
                  color: '#4f6ef7', border: '1px solid rgba(79,110,247,0.3)',
                  padding: '14px', borderRadius: '12px',
                  cursor: 'pointer', fontWeight: 600, fontSize: '1rem'
                }}
              >
                Обычная практика
              </button>
            </div>
            <button
              onClick={() => setSelectedGroup(null)}
              style={{
                marginTop: '1.5rem', background: 'transparent', color: '#8892b0',
                border: 'none', cursor: 'pointer', fontSize: '0.9rem'
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
