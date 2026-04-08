import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../../api/supabaseClient';
import { getDistance } from '../../utils/geo';
import { useNavigate } from 'react-router-dom';

const Scan = () => {
  const navigate = useNavigate();
  const [location, setLocation] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [geoLoading, setGeoLoading] = useState(true);
  const [scanResult, setScanResult] = useState(null); // { success, message, details }
  const [scanning, setScanning] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [practices, setPractices] = useState([]);
  const [selectedPractice, setSelectedPractice] = useState('');
  const [practicesLoading, setPracticesLoading] = useState(true);
  const scannerRef = useRef(null);

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('practi_user')); } catch { return null; }
  })();

  // 1. Запрашиваем геолокацию и загружаем практики при входе
  useEffect(() => {
    requestGeolocation();
    fetchPractices();
  }, []);

  const fetchPractices = async () => {
    setPracticesLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('practices')
      .select('*')
      .lte('start_date', today)
      .gte('end_date', today)
      .order('name');
    setPractices(data || []);
    if (data && data.length === 1) {
      setSelectedPractice(data[0].id);
    }
    setPracticesLoading(false);
  };

  const requestGeolocation = () => {
    setGeoLoading(true);
    setGeoError(null);

    if (!navigator.geolocation) {
      setGeoError('Геолокация не поддерживается вашим браузером');
      setGeoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        });
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        switch (err.code) {
          case 1:
            setGeoError('Вы запретили доступ к геолокации. Разрешите доступ в настройках браузера и обновите страницу.');
            break;
          case 2:
            setGeoError('Не удалось определить местоположение. Включите GPS.');
            break;
          case 3:
            setGeoError('Время ожидания геолокации истекло. Попробуйте ещё раз.');
            break;
          default:
            setGeoError('Ошибка геолокации. Попробуйте ещё раз.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // 2. Запускаем сканер QR
  const startScanner = () => {
    setScanning(true);
    setScanResult(null);

    // Ждём рендер DOM-элемента
    setTimeout(() => {
      if (scannerRef.current) {
        try { scannerRef.current.clear(); } catch {}
      }

      const scanner = new Html5QrcodeScanner("qr-reader", {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true
      });

      scanner.render(
        async (decodedText) => {
          // Успешное сканирование — останавливаем сканер
          try { scanner.clear(); } catch {}
          setScanning(false);
          await handleCheckIn(decodedText);
        },
        (errorMessage) => {
          // Ошибки сканирования (нормально, пока ищет код)
        }
      );

      scannerRef.current = scanner;
    }, 100);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try { scannerRef.current.clear(); } catch {}
    }
    setScanning(false);
  };

  // 3. Обработка сканирования: check-in при первом сканировании, check-out при повторном
  const handleCheckIn = async (qrToken) => {
    setProcessing(true);

    try {
      // a) Ищем QR-токен в базе
      const { data: qrData, error: qrErr } = await supabase
        .from('qr_tokens')
        .select('*, companies(*)')
        .eq('token', qrToken)
        .single();

      if (qrErr || !qrData) {
        setScanResult({
          success: false,
          message: 'Неверный или просроченный QR-код',
          details: 'Токен не найден в базе данных. Попросите руководителя показать актуальный QR.'
        });
        setProcessing(false);
        return;
      }

      // b) Проверяем не истёк ли токен
      if (new Date(qrData.expires_at) < new Date()) {
        setScanResult({
          success: false,
          message: 'QR-код просрочен',
          details: 'Этот QR-код уже истёк. Новый генерируется автоматически каждый день.'
        });
        setProcessing(false);
        return;
      }

      const company = qrData.companies;

      // c) Проверяем, есть ли уже запись прихода за сегодня
      const today = new Date().toISOString().split('T')[0];
      const startOfDay = today + 'T00:00:00';
      const endOfDay = today + 'T23:59:59';

      const { data: existingAtt } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', user.student_id)
        .gte('scanned_at', startOfDay)
        .lte('scanned_at', endOfDay)
        .is('check_out_at', null)
        .maybeSingle();

      // d) Если запись прихода есть — записываем время ухода (check-out)
      if (existingAtt) {
        const { error: updateErr } = await supabase
          .from('attendance')
          .update({
            check_out_at: new Date().toISOString(),
            checkout_lat: location?.lat || null,
            checkout_lng: location?.lng || null
          })
          .eq('id', existingAtt.id);

        if (updateErr) {
          setScanResult({
            success: false,
            message: 'Ошибка записи ухода',
            details: updateErr.message
          });
        } else {
          const checkInTime = new Date(existingAtt.scanned_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          const checkOutTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
          setScanResult({
            success: true,
            isCheckOut: true,
            message: 'Уход зафиксирован! 👋',
            details: `Предприятие: ${company.name} | Приход: ${checkInTime} | Уход: ${checkOutTime}`
          });
        }
        setProcessing(false);
        return;
      }

      // e) Иначе — первое сканирование: записываем приход (check-in)
      let status = 'present';
      let reason = null;
      let distance = null;

      if (company.latitude && company.longitude && location) {
        distance = getDistance(
          location.lat, location.lng,
          company.latitude, company.longitude
        );
        const allowedRadius = company.allowed_radius || 200;

        if (distance > allowedRadius) {
          status = 'rejected';
          reason = `Расстояние ${Math.round(distance)}м превышает допустимый радиус ${allowedRadius}м`;
        }
      }

      const { error: insertErr } = await supabase.from('attendance').insert([{
        student_id: user.student_id,
        company_id: company.id,
        practice_id: selectedPractice || null,
        status: status,
        reason: reason,
        lat: location?.lat || null,
        lng: location?.lng || null
      }]);

      if (insertErr) {
        setScanResult({
          success: false,
          message: 'Ошибка записи в базу',
          details: insertErr.message
        });
      } else {
        setScanResult({
          success: status === 'present',
          isCheckOut: false,
          message: status === 'present' ? '✅ Приход отмечен!' : 'Отметка записана, но геолокация не совпадает',
          details: status === 'present'
            ? `Предприятие: ${company.name}${distance !== null ? ` | Расстояние: ${Math.round(distance)}м` : ''}`
            : reason
        });
      }
    } catch (e) {
      setScanResult({
        success: false,
        message: 'Произошла ошибка',
        details: e.message
      });
    }

    setProcessing(false);
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
          <span style={{ fontSize: '1.5rem' }}>📱</span>
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

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Статус геолокации */}
        <div style={{
          background: '#16181f', border: '1px solid #1e2130', borderRadius: '16px',
          padding: '1.25rem', marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>📍</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Геолокация</span>
          </div>

          {geoLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b' }}>
              <div style={{
                width: '16px', height: '16px', border: '2px solid #1e2130',
                borderTopColor: '#f59e0b', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              Определение местоположения...
            </div>
          ) : geoError ? (
            <div>
              <div style={{
                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)', padding: '10px 14px',
                borderRadius: '10px', fontSize: '0.85rem', marginBottom: '10px'
              }}>
                ⚠️ {geoError}
              </div>
              <button onClick={requestGeolocation} style={{
                background: 'rgba(79,110,247,0.1)', color: '#4f6ef7',
                border: '1px solid rgba(79,110,247,0.2)', padding: '8px 16px',
                borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem'
              }}>🔄 Попробовать снова</button>
            </div>
          ) : (
            <div style={{
              background: 'rgba(16,185,129,0.1)', color: '#10b981',
              border: '1px solid rgba(16,185,129,0.2)', padding: '10px 14px',
              borderRadius: '10px', fontSize: '0.85rem'
            }}>
              ✅ Геопозиция получена ({location.lat.toFixed(5)}, {location.lng.toFixed(5)})
              <br/><span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Точность: ~{Math.round(location.accuracy)}м</span>
            </div>
          )}
        </div>

        {/* Выбор предмета практики */}
        <div style={{
          background: '#16181f', border: '1px solid #1e2130', borderRadius: '16px',
          padding: '1.25rem', marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>📚</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Предмет практики</span>
          </div>

          {practicesLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b' }}>
              <div style={{
                width: '16px', height: '16px', border: '2px solid #1e2130',
                borderTopColor: '#f59e0b', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              Загрузка практик...
            </div>
          ) : practices.length === 0 ? (
            <div style={{
              background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.2)', padding: '10px 14px',
              borderRadius: '10px', fontSize: '0.85rem'
            }}>
              ⚠️ Нет активных практик на сегодня. Обратитесь к администратору.
            </div>
          ) : (
            <div>
              <select
                value={selectedPractice}
                onChange={e => setSelectedPractice(e.target.value)}
                style={{
                  width: '100%', background: '#111318', border: '1px solid #1e2130',
                  borderRadius: '10px', padding: '10px 14px', color: '#f1f3f9',
                  fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit',
                  cursor: 'pointer'
                }}
              >
                <option value="">— Выберите предмет практики —</option>
                {practices.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({new Date(p.start_date).toLocaleDateString('ru-RU')} — {new Date(p.end_date).toLocaleDateString('ru-RU')})
                  </option>
                ))}
              </select>
              {selectedPractice && (
                <div style={{
                  background: 'rgba(16,185,129,0.1)', color: '#10b981',
                  border: '1px solid rgba(16,185,129,0.2)', padding: '8px 12px',
                  borderRadius: '10px', fontSize: '0.82rem', marginTop: '8px'
                }}>
                  ✅ {practices.find(p => p.id === selectedPractice)?.name}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Сканер QR */}
        <div style={{
          background: '#16181f', border: '1px solid #1e2130', borderRadius: '16px',
          padding: '1.25rem', textAlign: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', justifyContent: 'center' }}>
            <span style={{ fontSize: '1.2rem' }}>📷</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>QR-сканер</span>
          </div>

          {processing ? (
            <div style={{ padding: '2rem', color: '#8892b0' }}>
              <div style={{
                width: '40px', height: '40px', border: '3px solid #1e2130',
                borderTopColor: '#4f6ef7', borderRadius: '50%',
                animation: 'spin 0.8s linear infinite', margin: '0 auto 16px'
              }} />
              Обработка отметки...
            </div>
          ) : scanResult ? (
            <div>
              <div style={{
                background: scanResult.isCheckOut
                  ? 'rgba(124,58,237,0.12)'
                  : scanResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                color: scanResult.isCheckOut
                  ? '#a78bfa'
                  : scanResult.success ? '#10b981' : '#ef4444',
                border: `1px solid ${
                  scanResult.isCheckOut
                    ? 'rgba(124,58,237,0.25)'
                    : scanResult.success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'
                }`,
                padding: '1.25rem', borderRadius: '12px', marginBottom: '1rem'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                  {scanResult.isCheckOut ? '🚪' : scanResult.success ? '✅' : '❌'}
                </div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>{scanResult.message}</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>{scanResult.details}</div>
              </div>
              <button onClick={() => { setScanResult(null); }} style={{
                background: 'linear-gradient(135deg, #4f6ef7, #7c3aed)', color: 'white',
                border: 'none', padding: '12px 24px', borderRadius: '12px',
                cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', width: '100%'
              }}>Сканировать ещё раз</button>
            </div>
          ) : scanning ? (
            <div>
              <div id="qr-reader" style={{
                width: '100%', maxWidth: '350px', margin: '0 auto',
                borderRadius: '12px', overflow: 'hidden'
              }}></div>
              <button onClick={stopScanner} style={{
                marginTop: '1rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                border: '1px solid rgba(239,68,68,0.2)', padding: '10px 20px',
                borderRadius: '10px', cursor: 'pointer', fontWeight: 600
              }}>Отменить сканирование</button>
            </div>
          ) : (
            <div>
              <p style={{ color: '#8892b0', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Нажмите кнопку для запуска камеры и отсканируйте QR-код на предприятии
              </p>
              <button
                onClick={startScanner}
                disabled={!location || !selectedPractice}
                style={{
                  background: (location && selectedPractice) ? 'linear-gradient(135deg, #4f6ef7, #7c3aed)' : '#1c1f28',
                  color: (location && selectedPractice) ? 'white' : '#4a5568',
                  border: 'none',
                  padding: '14px 28px',
                  borderRadius: '14px',
                  cursor: (location && selectedPractice) ? 'pointer' : 'not-allowed',
                  fontWeight: 700,
                  fontSize: '1rem',
                  width: '100%',
                  boxShadow: (location && selectedPractice) ? '0 4px 20px rgba(79,110,247,0.3)' : 'none',
                  transition: 'all 0.2s'
                }}
              >
                📷 Отсканировать QR
              </button>
              {!location && (
                <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginTop: '10px' }}>
                  ⚠️ Сначала разрешите доступ к геолокации
                </p>
              )}
              {location && !selectedPractice && (
                <p style={{ color: '#f59e0b', fontSize: '0.8rem', marginTop: '10px' }}>
                  ⚠️ Выберите предмет практики
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Scan;