import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';

const Login = () => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const roles = [
    { id: 'student', title: 'Студент', desc: 'Сканируйте QR-код и подтверждайте локацию', icon: '🎓', path: '/student/scan', color: '#4f6ef7' },
    { id: 'company', title: 'Руководитель', desc: 'Генерируйте QR-код для вашего предприятия', icon: '🏢', path: '/company/generator', color: '#7c3aed' },
    { id: 'teacher', title: 'Преподаватель', desc: 'Управляйте группами и посещаемостью', icon: '📋', path: '/teacher/groups', color: '#10b981' }
  ];

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: dbErr } = await supabase
        .from('accounts')
        .select('*')
        .eq('login', login)
        .single();

      if (dbErr || !data) {
        setError('Неверный логин или пароль');
        setLoading(false);
        return;
      }

      // Проверяем пароль (прямое сравнение)
      if (data.password_hash !== password) {
        setError('Неверный логин или пароль');
        setLoading(false);
        return;
      }

      // Проверяем роль
      if (data.role !== selectedRole.id && data.role !== 'admin') {
        setError('Ваш аккаунт не имеет доступа к этой роли');
        setLoading(false);
        return;
      }

      // Сохраняем в localStorage
      localStorage.setItem('practi_user', JSON.stringify(data));

      // Редирект по роли
      if (data.role === 'admin') {
        navigate('/teacher/groups');
      } else {
        navigate(selectedRole.path);
      }
    } catch (err) {
      setError('Ошибка подключения к серверу');
    }

    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0b0f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem'
    }}>
      {!selectedRole ? (
        <div style={{ width: '100%', maxWidth: '900px', animation: 'slideUp 0.4s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h1 style={{
              fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem',
              background: 'linear-gradient(135deg, #4f6ef7, #7c3aed)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
            }}>Practi-QR</h1>
            <p style={{ color: '#8892b0', fontSize: '1.1rem' }}>Система учёта производственной практики</p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.25rem'
          }}>
            {roles.map(r => (
              <div
                key={r.id}
                onClick={() => setSelectedRole(r)}
                style={{
                  background: '#16181f',
                  border: '1px solid #1e2130',
                  borderRadius: '20px',
                  padding: '2rem 1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = r.color + '55';
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = `0 20px 60px rgba(0,0,0,0.4), 0 0 30px ${r.color}22`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#1e2130';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{r.icon}</div>
                <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.3rem', fontWeight: 700, color: r.color }}>
                  {r.title}
                </h2>
                <p style={{ color: '#8892b0', fontSize: '0.9rem', lineHeight: 1.5, margin: 0 }}>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          width: '100%', maxWidth: '420px',
          background: '#16181f',
          border: '1px solid #1e2130',
          borderRadius: '20px',
          padding: '2.5rem 2rem',
          animation: 'slideUp 0.3s ease'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{selectedRole.icon}</div>
            <h2 style={{ margin: '0 0 0.25rem 0', fontSize: '1.3rem', fontWeight: 700 }}>
              Вход: {selectedRole.title}
            </h2>
            <p style={{ color: '#8892b0', fontSize: '0.9rem', margin: 0 }}>Введите ваш логин и пароль</p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px',
              borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center'
            }}>
              ⚠️ {error}
            </div>
          )}

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{
                display: 'block', fontSize: '0.75rem', fontWeight: 600,
                color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.05em',
                marginBottom: '6px'
              }}>Логин</label>
              <input
                type="text"
                placeholder="Введите логин"
                value={login}
                onChange={e => setLogin(e.target.value)}
                required
                style={{
                  width: '100%', background: '#111318', border: '1px solid #1e2130',
                  borderRadius: '12px', padding: '12px 16px', color: '#f1f3f9',
                  fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color 0.2s', boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <label style={{
                display: 'block', fontSize: '0.75rem', fontWeight: 600,
                color: '#8892b0', textTransform: 'uppercase', letterSpacing: '0.05em',
                marginBottom: '6px'
              }}>Пароль</label>
              <input
                type="password"
                placeholder="Введите пароль"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={{
                  width: '100%', background: '#111318', border: '1px solid #1e2130',
                  borderRadius: '12px', padding: '12px 16px', color: '#f1f3f9',
                  fontSize: '0.95rem', outline: 'none', fontFamily: 'inherit',
                  transition: 'border-color 0.2s', boxSizing: 'border-box'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                background: loading ? '#1c1f28' : 'linear-gradient(135deg, #4f6ef7, #7c3aed)',
                color: 'white', border: 'none', padding: '14px',
                borderRadius: '12px', cursor: loading ? 'wait' : 'pointer',
                fontWeight: 700, fontSize: '1rem', marginTop: '6px',
                transition: 'all 0.2s'
              }}
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>

            <button
              type="button"
              onClick={() => { setSelectedRole(null); setError(''); setLogin(''); setPassword(''); }}
              style={{
                background: 'transparent', color: '#8892b0',
                border: 'none', cursor: 'pointer', fontSize: '0.9rem',
                padding: '8px'
              }}
            >
              ← Выбрать другую роль
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Login;