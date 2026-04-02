import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../../api/supabaseClient';
import { useNavigate } from 'react-router-dom';

const Generator = () => {
  const navigate = useNavigate();
  const [qrToken, setQrToken] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('practi_user')); } catch { return null; }
  })();

  useEffect(() => {
    fetchToken();
    const interval = setInterval(fetchToken, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchToken = async () => {
    setLoading(true);
    setError('');

    try {
      // Получаем последний токен для этого предприятия
      const { data, error: err } = await supabase
        .from('qr_tokens')
        .select('id, token, expires_at, companies(name)')
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (err || !data) {
        // Токена нет — создаём новый
        await createNewToken();
        return;
      }

      // Токен истёк? Обновляем expires_at до конца сегодняшнего дня
      const now = new Date();
      const expiresAt = new Date(data.expires_at);

      if (expiresAt < now) {
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        const { error: updateErr } = await supabase
          .from('qr_tokens')
          .update({ expires_at: endOfToday.toISOString() })
          .eq('id', data.id);

        if (updateErr) {
          await createNewToken();
          return;
        }
        // Используем тот же токен (UUID не меняется, только дата)
        setQrToken(data.token);
        setCompanyName(data.companies?.name || user.login);
      } else {
        setQrToken(data.token);
        setCompanyName(data.companies?.name || user.login);
      }
    } catch (e) {
      setError('Ошибка загрузки');
    }

    setLoading(false);
  };

  const createNewToken = async () => {
    try {
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const newToken = crypto.randomUUID();

      const { data: created, error: createErr } = await supabase
        .from('qr_tokens')
        .insert([{
          token: newToken,
          company_id: user.company_id,
          expires_at: endOfToday.toISOString()
        }])
        .select('token, companies(name)')
        .single();

      if (createErr || !created) {
        setError('Не удалось создать QR-токен. Обратитесь к администратору.');
      } else {
        setQrToken(created.token);
        setCompanyName(created.companies?.name || user.login);
      }
    } catch {
      setError('Ошибка создания токена');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('practi_user');
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0b0f', color: '#f1f3f9' }}>
      {/* Навбар */}
      <div style={{
        background: 'rgba(10,11,15,0.9)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid #1e2130', padding: '1rem 1.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.5rem' }}>🏢</span>
          <h1 style={{
            margin: 0, fontSize: '1.15rem', fontWeight: 700,
            background: 'linear-gradient(135deg, #4f6ef7, #7c3aed)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>Practi-QR</h1>
        </div>
        <button onClick={handleLogout} style={{
          background: 'rgba(239,68,68,0.1)', color: '#ef4444',
          border: '1px solid rgba(239,68,68,0.2)', padding: '8px 16px',
          borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem'
        }}>Выйти</button>
      </div>

      <div style={{
        maxWidth: '500px', margin: '0 auto', padding: '3rem 1.5rem',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
      }}>
        <h2 style={{
          fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem'
        }}>QR-код для отметки</h2>
        <p style={{ color: '#8892b0', marginBottom: '2rem' }}>
          Покажите этот код студентам для сканирования
        </p>

        {loading ? (
          <div style={{ padding: '3rem' }}>
            <div style={{
              width: '40px', height: '40px', border: '3px solid #1e2130',
              borderTopColor: '#4f6ef7', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 16px'
            }} />
            <span style={{ color: '#8892b0' }}>Загрузка QR-кода...</span>
          </div>
        ) : error ? (
          <div style={{
            background: 'rgba(239,68,68,0.1)', color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.2)', padding: '1.5rem',
            borderRadius: '16px', width: '100%'
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '10px' }}>⚠️</div>
            {error}
          </div>
        ) : (
          <div>
            <div style={{
              background: 'white', padding: '24px', borderRadius: '20px',
              display: 'inline-block',
              boxShadow: '0 0 40px rgba(79,110,247,0.2)',
              animation: 'pulse-glow 3s ease-in-out infinite'
            }}>
              <QRCodeSVG value={qrToken} size={280} level="H" />
            </div>

            <div style={{
              marginTop: '2rem',
              background: '#16181f', border: '1px solid #1e2130',
              borderRadius: '12px', padding: '1rem'
            }}>
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{companyName}</div>
              <div style={{ color: '#8892b0', fontSize: '0.85rem', marginTop: '4px' }}>
                Обновляется автоматически каждые 24 часа
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Generator;