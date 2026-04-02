import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';
import MapPicker from './MapPicker';

const AdminPanel = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('groups');

  // === DATA ===
  const [groups, setGroups] = useState([]);
  const [students, setStudents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // === FORMS ===
  const [groupForm, setGroupForm] = useState({ name: '' });
  const [studentForm, setStudentForm] = useState({ name: '', login: '', password: '', group_id: '' });
  const [companyForm, setCompanyForm] = useState({ name: '', address: '', latitude: '', longitude: '', allowed_radius: '200' });
  const [accountForm, setAccountForm] = useState({ login: '', password: '', role: 'teacher', company_id: '', student_id: '' });
  const [assignForm, setAssignForm] = useState({ student_id: '', company_id: '' });

  // === EDIT MODE ===
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingCompany, setEditingCompany] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [g, s, c, a] = await Promise.all([
      supabase.from('groups').select('*').order('name'),
      supabase.from('students').select('*, groups(name)').order('name'),
      supabase.from('companies').select('*').order('name'),
      supabase.from('accounts').select('*').order('created_at', { ascending: false }),
    ]);
    setGroups(g.data || []);
    setStudents(s.data || []);
    setCompanies(c.data || []);
    setAccounts(a.data || []);

    // Загружаем связки студент-предприятие
    const { data: assignData } = await supabase
      .from('student_assignments')
      .select('*, students(name), companies(name)');
    setAssignments(assignData || []);

    setLoading(false);
  };

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  // ===================== GROUPS =====================
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupForm.name.trim()) return;
    const { error } = await supabase.from('groups').insert([{ name: groupForm.name.trim() }]);
    if (error) { showMsg('Ошибка: ' + error.message, 'error'); return; }
    showMsg('Группа создана!');
    setGroupForm({ name: '' });
    fetchAll();
  };

  const handleUpdateGroup = async (id) => {
    const { error } = await supabase.from('groups').update({ name: editingGroup.name }).eq('id', id);
    if (error) { showMsg('Ошибка: ' + error.message, 'error'); return; }
    showMsg('Группа обновлена!');
    setEditingGroup(null);
    fetchAll();
  };

  const handleDeleteGroup = async (id) => {
    if (!confirm('Удалить группу? Все студенты этой группы потеряют привязку.')) return;
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (error) { showMsg('Ошибка: ' + error.message, 'error'); return; }
    showMsg('Группа удалена');
    fetchAll();
  };

  // ===================== STUDENTS =====================
  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!studentForm.name.trim() || !studentForm.login.trim() || !studentForm.password.trim()) return;

    // 1. Создаем студента
    const { data: newStudent, error: sErr } = await supabase
      .from('students')
      .insert([{
        name: studentForm.name.trim(),
        group_id: studentForm.group_id || null
      }])
      .select()
      .single();

    if (sErr) { showMsg('Ошибка: ' + sErr.message, 'error'); return; }

    // 2. Создаем аккаунт автоматом
    const { error: aErr } = await supabase
      .from('accounts')
      .insert([{
        login: studentForm.login.trim(),
        password_hash: studentForm.password.trim(),
        role: 'student',
        student_id: newStudent.id
      }]);

    if (aErr) { showMsg('Студент создан, но ошибка аккаунта: ' + aErr.message, 'error'); }
    else { showMsg('Студент и аккаунт созданы!'); }

    setStudentForm({ name: '', login: '', password: '', group_id: '' });
    fetchAll();
  };

  const handleUpdateStudent = async (id) => {
    const upd = { name: editingStudent.name, group_id: editingStudent.group_id || null };
    const { error } = await supabase.from('students').update(upd).eq('id', id);
    if (error) { showMsg('Ошибка: ' + error.message, 'error'); return; }
    showMsg('Студент обновлён!');
    setEditingStudent(null);
    fetchAll();
  };

  const handleDeleteStudent = async (id) => {
    if (!confirm('Удалить студента? Все его данные будут потеряны.')) return;
    // Удаляем аккаунт тоже
    await supabase.from('accounts').delete().eq('student_id', id);
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) { showMsg('Ошибка: ' + error.message, 'error'); return; }
    showMsg('Студент удалён');
    fetchAll();
  };

  // ===================== COMPANIES =====================
  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!companyForm.name.trim()) return;
    const payload = {
      name: companyForm.name.trim(),
      address: companyForm.address.trim() || null,
      latitude: companyForm.latitude ? parseFloat(companyForm.latitude) : null,
      longitude: companyForm.longitude ? parseFloat(companyForm.longitude) : null,
      allowed_radius: parseInt(companyForm.allowed_radius) || 200
    };

    const { data: newCompany, error } = await supabase
      .from('companies')
      .insert([payload])
      .select()
      .single();
    if (error) { showMsg('Ошибка: ' + error.message, 'error'); return; }

    // Создаем QR-токен для нового предприятия
    const token = crypto.randomUUID();
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);

    await supabase.from('qr_tokens').insert([{
      token: token,
      company_id: newCompany.id,
      expires_at: tomorrow.toISOString()
    }]);

    showMsg('Предприятие создано + QR-токен сгенерирован!');
    setCompanyForm({ name: '', address: '', latitude: '', longitude: '', allowed_radius: '200' });
    fetchAll();
  };

  const handleUpdateCompany = async (id) => {
    const upd = {
      name: editingCompany.name,
      address: editingCompany.address || null,
      latitude: editingCompany.latitude ? parseFloat(editingCompany.latitude) : null,
      longitude: editingCompany.longitude ? parseFloat(editingCompany.longitude) : null,
      allowed_radius: parseInt(editingCompany.allowed_radius) || 200
    };
    const { error } = await supabase.from('companies').update(upd).eq('id', id);
    if (error) { showMsg('Ошибка: ' + error.message, 'error'); return; }
    showMsg('Предприятие обновлено!');
    setEditingCompany(null);
    fetchAll();
  };

  const handleDeleteCompany = async (id) => {
    if (!confirm('Удалить предприятие? QR-токены и связки будут потеряны.')) return;
    await supabase.from('qr_tokens').delete().eq('company_id', id);
    const { error } = await supabase.from('companies').delete().eq('id', id);
    if (error) { showMsg('Ошибка: ' + error.message, 'error'); return; }
    showMsg('Предприятие удалено');
    fetchAll();
  };

  // ===================== ACCOUNTS =====================
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (!accountForm.login.trim() || !accountForm.password.trim()) return;
    const payload = {
      login: accountForm.login.trim(),
      password_hash: accountForm.password.trim(),
      role: accountForm.role,
      company_id: accountForm.role === 'company' ? (accountForm.company_id || null) : null,
      student_id: accountForm.role === 'student' ? (accountForm.student_id || null) : null,
    };
    const { error } = await supabase.from('accounts').insert([payload]);
    if (error) { showMsg('Ошибка: ' + error.message, 'error'); return; }
    showMsg('Аккаунт создан!');
    setAccountForm({ login: '', password: '', role: 'teacher', company_id: '', student_id: '' });
    fetchAll();
  };

  const handleUpdateAccount = async (id) => {
    const upd = {
      login: editingAccount.login,
      role: editingAccount.role,
    };
    if (editingAccount.newPassword && editingAccount.newPassword.trim()) {
      upd.password_hash = editingAccount.newPassword.trim();
    }
    const { error } = await supabase.from('accounts').update(upd).eq('id', id);
    if (error) { showMsg('Ошибка: ' + error.message, 'error'); return; }
    showMsg('Аккаунт обновлён!');
    setEditingAccount(null);
    fetchAll();
  };

  const handleDeleteAccount = async (id) => {
    if (!confirm('Удалить аккаунт?')) return;
    const { error } = await supabase.from('accounts').delete().eq('id', id);
    if (error) { showMsg('Ошибка: ' + error.message, 'error'); return; }
    showMsg('Аккаунт удалён');
    fetchAll();
  };

  // ===================== ASSIGNMENTS =====================
  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!assignForm.student_id || !assignForm.company_id) return;
    const { error } = await supabase.from('student_assignments').insert([{
      student_id: assignForm.student_id,
      company_id: assignForm.company_id
    }]);
    if (error) { showMsg('Ошибка: ' + error.message, 'error'); return; }
    showMsg('Связка создана!');
    setAssignForm({ student_id: '', company_id: '' });
    fetchAll();
  };

  const handleDeleteAssignment = async (id) => {
    const { error } = await supabase.from('student_assignments').delete().eq('id', id);
    if (error) { showMsg('Ошибка: ' + error.message, 'error'); return; }
    showMsg('Связка удалена');
    fetchAll();
  };

  // ===================== STYLES =====================
  const inputStyle = {
    background: '#111318', border: '1px solid #1e2130', borderRadius: '10px',
    padding: '10px 14px', color: '#f1f3f9', fontSize: '0.9rem', width: '100%',
    outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s'
  };

  const selectStyle = { ...inputStyle, cursor: 'pointer' };

  const btnPrimary = {
    background: 'linear-gradient(135deg, #4f6ef7, #7c3aed)', color: 'white',
    border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s'
  };

  const btnDanger = {
    background: 'rgba(239,68,68,0.1)', color: '#ef4444',
    border: '1px solid rgba(239,68,68,0.2)', padding: '6px 12px',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem'
  };

  const btnEdit = {
    background: 'rgba(79,110,247,0.1)', color: '#4f6ef7',
    border: '1px solid rgba(79,110,247,0.2)', padding: '6px 12px',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem'
  };

  const btnSave = {
    background: 'rgba(16,185,129,0.15)', color: '#10b981',
    border: '1px solid rgba(16,185,129,0.3)', padding: '6px 12px',
    borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem'
  };

  const cardStyle = {
    background: '#16181f', border: '1px solid #1e2130',
    borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem'
  };

  const tabs = [
    { id: 'groups', icon: '📂', label: 'Группы' },
    { id: 'students', icon: '🎓', label: 'Студенты' },
    { id: 'companies', icon: '🏢', label: 'Предприятия' },
    { id: 'assignments', icon: '🔗', label: 'Связки' },
    { id: 'accounts', icon: '👤', label: 'Аккаунты' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0b0f', color: '#f1f3f9' }}>
      <style>{`
        .adm-navbar {
          background: rgba(10,11,15,0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid #1e2130;
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
          flex-wrap: wrap;
          gap: 8px;
        }
        .adm-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 1.25rem;
          overflow-x: auto;
          padding-bottom: 4px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .adm-tabs::-webkit-scrollbar { display: none; }
        .adm-tab-btn {
          background: #16181f;
          color: #8892b0;
          border: 1px solid #1e2130;
          padding: 9px 14px;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.82rem;
          white-space: nowrap;
          transition: all 0.2s;
          flex-shrink: 0;
        }
        .adm-tab-btn.active {
          background: rgba(79,110,247,0.15);
          color: #4f6ef7;
          border-color: rgba(79,110,247,0.3);
        }
        .adm-form-row {
          display: flex;
          gap: 10px;
        }
        .adm-main { max-width: 1100px; margin: 0 auto; padding: 1.25rem 1rem; }
        @media (max-width: 600px) {
          .adm-main { padding: 1rem 0.75rem; }
          .adm-form-row { flex-direction: column; gap: 8px; }
          .adm-form-row > * { flex: unset !important; width: 100%; }
        }
      `}</style>
      {/* Навбар */}
      <div className="adm-navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => navigate('/teacher/groups')}
            style={{
              background: '#1c1f28', color: '#f1f3f9', border: '1px solid #1e2130',
              padding: '7px 12px', borderRadius: '10px', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap'
            }}
          >
            ← Назад
          </button>
          <h1 style={{
            margin: 0, fontSize: '1.1rem', fontWeight: 700,
            background: 'linear-gradient(135deg, #4f6ef7, #7c3aed)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            whiteSpace: 'nowrap'
          }}>Админ-панель</h1>
        </div>
      </div>

      {/* Уведомление */}
      {msg.text && (
        <div style={{
          position: 'fixed', top: '80px', right: '20px', zIndex: 200,
          padding: '12px 20px', borderRadius: '12px',
          background: msg.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
          color: msg.type === 'error' ? '#ef4444' : '#10b981',
          border: `1px solid ${msg.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          fontWeight: 600, fontSize: '0.9rem',
          animation: 'slideUp 0.3s ease'
        }}>
          {msg.text}
        </div>
      )}

      <div className="adm-main">
        {/* Табы */}
        <div className="adm-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`adm-tab-btn${activeTab === tab.id ? ' active' : ''}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* ==================== ГРУППЫ ==================== */}
        {activeTab === 'groups' && (
          <div>
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>➕ Добавить группу</h3>
              <form onSubmit={handleCreateGroup} style={{ display: 'flex', gap: '10px' }}>
                <input
                  placeholder="Название группы (напр. ИТ-21)"
                  value={groupForm.name}
                  onChange={e => setGroupForm({ name: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button type="submit" style={btnPrimary}>Создать</button>
              </form>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>📋 Все группы ({groups.length})</h3>
              {groups.length === 0 ? (
                <p style={{ color: '#4a5568' }}>Групп пока нет</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {groups.map(g => (
                    <div key={g.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: '#111318', padding: '12px 16px', borderRadius: '10px',
                      border: '1px solid #1e2130'
                    }}>
                      {editingGroup && editingGroup.id === g.id ? (
                        <input
                          value={editingGroup.name}
                          onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })}
                          style={{ ...inputStyle, flex: 1, marginRight: '10px' }}
                        />
                      ) : (
                        <span style={{ fontWeight: 600 }}>{g.name}</span>
                      )}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {editingGroup && editingGroup.id === g.id ? (
                          <>
                            <button onClick={() => handleUpdateGroup(g.id)} style={btnSave}>💾 Сохранить</button>
                            <button onClick={() => setEditingGroup(null)} style={btnEdit}>Отмена</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setEditingGroup({ ...g })} style={btnEdit}>✏️</button>
                            <button onClick={() => handleDeleteGroup(g.id)} style={btnDanger}>🗑️</button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== СТУДЕНТЫ ==================== */}
        {activeTab === 'students' && (
          <div>
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>➕ Добавить студента</h3>
              <form onSubmit={handleCreateStudent} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="ФИО" value={studentForm.name}
                  onChange={e => setStudentForm({ ...studentForm, name: e.target.value })} style={inputStyle} />
                <div className="adm-form-row">
                  <input placeholder="Логин" value={studentForm.login}
                    onChange={e => setStudentForm({ ...studentForm, login: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                  <input placeholder="Пароль" value={studentForm.password}
                    onChange={e => setStudentForm({ ...studentForm, password: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                </div>
                <select value={studentForm.group_id}
                  onChange={e => setStudentForm({ ...studentForm, group_id: e.target.value })} style={selectStyle}>
                  <option value="">— Выберите группу —</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button type="submit" style={btnPrimary}>Создать студента + аккаунт</button>
              </form>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>📋 Все студенты ({students.length})</h3>
              {students.length === 0 ? (
                <p style={{ color: '#4a5568' }}>Студентов пока нет</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>ФИО</th>
                        <th style={thStyle}>Логин</th>
                        <th style={thStyle}>Группа</th>
                        <th style={thStyle}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #1e2130' }}>
                          <td style={tdStyle}>
                            {editingStudent && editingStudent.id === s.id ? (
                              <input value={editingStudent.name}
                                onChange={e => setEditingStudent({ ...editingStudent, name: e.target.value })}
                                style={{ ...inputStyle, padding: '6px 10px' }} />
                            ) : (
                              <span style={{ fontWeight: 600 }}>{s.name}</span>
                            )}
                          </td>
                          <td style={tdStyle}><span style={{ color: '#8892b0' }}>{s.login}</span></td>
                          <td style={tdStyle}>
                            {editingStudent && editingStudent.id === s.id ? (
                              <select value={editingStudent.group_id || ''}
                                onChange={e => setEditingStudent({ ...editingStudent, group_id: e.target.value })}
                                style={{ ...selectStyle, padding: '6px 10px' }}>
                                <option value="">— нет —</option>
                                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                              </select>
                            ) : (
                              <span style={{
                                background: 'rgba(79,110,247,0.1)', color: '#4f6ef7',
                                border: '1px solid rgba(79,110,247,0.2)',
                                padding: '3px 8px', borderRadius: '100px', fontSize: '0.78rem', fontWeight: 600
                              }}>{s.groups?.name || 'Нет группы'}</span>
                            )}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {editingStudent && editingStudent.id === s.id ? (
                                <>
                                  <button onClick={() => handleUpdateStudent(s.id)} style={btnSave}>💾</button>
                                  <button onClick={() => setEditingStudent(null)} style={btnEdit}>✕</button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => setEditingStudent({ ...s })} style={btnEdit}>✏️</button>
                                  <button onClick={() => handleDeleteStudent(s.id)} style={btnDanger}>🗑️</button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== ПРЕДПРИЯТИЯ ==================== */}
        {activeTab === 'companies' && (
          <div>
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>➕ Добавить предприятие</h3>
              <form onSubmit={handleCreateCompany} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Название предприятия" value={companyForm.name}
                  onChange={e => setCompanyForm({ ...companyForm, name: e.target.value })} style={inputStyle} />
                <input placeholder="Адрес" value={companyForm.address}
                  onChange={e => setCompanyForm({ ...companyForm, address: e.target.value })} style={inputStyle} />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input placeholder="Широта (latitude)" type="number" step="any" value={companyForm.latitude}
                    onChange={e => setCompanyForm({ ...companyForm, latitude: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                  <input placeholder="Долгота (longitude)" type="number" step="any" value={companyForm.longitude}
                    onChange={e => setCompanyForm({ ...companyForm, longitude: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                </div>
                <MapPicker
                   onSelect={(lat, lng) =>
                     setCompanyForm({
                      ...companyForm,
                      latitude: lat,
                      longitude: lng
                  })
                 }
                />
                <input placeholder="Допустимый радиус (м)" type="number" value={companyForm.allowed_radius}
                  onChange={e => setCompanyForm({ ...companyForm, allowed_radius: e.target.value })} style={inputStyle} />
                <button type="submit" style={btnPrimary}>Создать предприятие</button>
              </form>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>📋 Все предприятия ({companies.length})</h3>
              {companies.length === 0 ? (
                <p style={{ color: '#4a5568' }}>Предприятий пока нет</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {companies.map(c => (
                    <div key={c.id} style={{
                      background: '#111318', padding: '16px', borderRadius: '12px',
                      border: '1px solid #1e2130'
                    }}>
                      {editingCompany && editingCompany.id === c.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <input value={editingCompany.name}
                            onChange={e => setEditingCompany({ ...editingCompany, name: e.target.value })} style={inputStyle} />
                          <input value={editingCompany.address || ''} placeholder="Адрес"
                            onChange={e => setEditingCompany({ ...editingCompany, address: e.target.value })} style={inputStyle} />
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input value={editingCompany.latitude || ''} placeholder="Широта" type="number" step="any"
                              onChange={e => setEditingCompany({ ...editingCompany, latitude: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                            <input value={editingCompany.longitude || ''} placeholder="Долгота" type="number" step="any"
                              onChange={e => setEditingCompany({ ...editingCompany, longitude: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                          </div>
                          <input value={editingCompany.allowed_radius || ''} placeholder="Радиус (м)" type="number"
                            onChange={e => setEditingCompany({ ...editingCompany, allowed_radius: e.target.value })} style={inputStyle} />
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => handleUpdateCompany(c.id)} style={btnSave}>💾 Сохранить</button>
                            <button onClick={() => setEditingCompany(null)} style={btnEdit}>Отмена</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>{c.name}</div>
                            {c.address && <div style={{ color: '#8892b0', fontSize: '0.85rem' }}>📍 {c.address}</div>}
                            <div style={{ color: '#4a5568', fontSize: '0.8rem', marginTop: '4px' }}>
                              GPS: {c.latitude || '—'}, {c.longitude || '—'} | Радиус: {c.allowed_radius || 200}м
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => setEditingCompany({ ...c })} style={btnEdit}>✏️</button>
                            <button onClick={() => handleDeleteCompany(c.id)} style={btnDanger}>🗑️</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== СВЯЗКИ ==================== */}
        {activeTab === 'assignments' && (
          <div>
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>🔗 Привязать студента к предприятию</h3>
              <form onSubmit={handleCreateAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <select value={assignForm.student_id}
                  onChange={e => setAssignForm({ ...assignForm, student_id: e.target.value })} style={selectStyle}>
                  <option value="">— Выберите студента —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.groups?.name || 'без группы'})</option>)}
                </select>
                <select value={assignForm.company_id}
                  onChange={e => setAssignForm({ ...assignForm, company_id: e.target.value })} style={selectStyle}>
                  <option value="">— Выберите предприятие —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="submit" style={btnPrimary}>Привязать</button>
              </form>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>📋 Все связки ({assignments.length})</h3>
              {assignments.length === 0 ? (
                <p style={{ color: '#4a5568' }}>Связок пока нет</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {assignments.map(a => (
                    <div key={a.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: '#111318', padding: '12px 16px', borderRadius: '10px',
                      border: '1px solid #1e2130'
                    }}>
                      <span>
                        <span style={{ fontWeight: 600 }}>{a.students?.name || '?'}</span>
                        <span style={{ color: '#4a5568', margin: '0 8px' }}>→</span>
                        <span style={{ color: '#8892b0' }}>{a.companies?.name || '?'}</span>
                      </span>
                      <button onClick={() => handleDeleteAssignment(a.id)} style={btnDanger}>🗑️</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== АККАУНТЫ ==================== */}
        {activeTab === 'accounts' && (
          <div>
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>➕ Создать аккаунт (вручную)</h3>
              <p style={{ color: '#8892b0', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Для студентов аккаунт создаётся автоматом при добавлении. Здесь можно создать аккаунт преподавателя или руководителя.
              </p>
              <form onSubmit={handleCreateAccount} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="adm-form-row">
                  <input placeholder="Логин" value={accountForm.login}
                    onChange={e => setAccountForm({ ...accountForm, login: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                  <input placeholder="Пароль" value={accountForm.password}
                    onChange={e => setAccountForm({ ...accountForm, password: e.target.value })} style={{ ...inputStyle, flex: 1 }} />
                </div>
                <select value={accountForm.role}
                  onChange={e => setAccountForm({ ...accountForm, role: e.target.value })} style={selectStyle}>
                  <option value="teacher">Преподаватель</option>
                  <option value="company">Руководитель (предприятие)</option>
                  <option value="admin">Админ</option>
                  <option value="student">Студент</option>
                </select>
                {accountForm.role === 'company' && (
                  <select value={accountForm.company_id}
                    onChange={e => setAccountForm({ ...accountForm, company_id: e.target.value })} style={selectStyle}>
                    <option value="">— Привяжите к предприятию —</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                <button type="submit" style={btnPrimary}>Создать аккаунт</button>
              </form>
            </div>

            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>📋 Все аккаунты ({accounts.length})</h3>
              {accounts.length === 0 ? (
                <p style={{ color: '#4a5568' }}>Аккаунтов пока нет</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {accounts.map(a => (
                    <div key={a.id} style={{
                      background: '#111318', padding: '14px 16px', borderRadius: '12px',
                      border: '1px solid #1e2130'
                    }}>
                      {editingAccount && editingAccount.id === a.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <input
                            value={editingAccount.login}
                            onChange={e => setEditingAccount({ ...editingAccount, login: e.target.value })}
                            placeholder="Логин"
                            style={inputStyle}
                          />
                          <input
                            value={editingAccount.newPassword || ''}
                            onChange={e => setEditingAccount({ ...editingAccount, newPassword: e.target.value })}
                            placeholder="Новый пароль (оставьте пустым, чтобы не менять)"
                            type="password"
                            style={inputStyle}
                          />
                          <select
                            value={editingAccount.role}
                            onChange={e => setEditingAccount({ ...editingAccount, role: e.target.value })}
                            style={selectStyle}
                          >
                            <option value="teacher">Преподаватель</option>
                            <option value="company">Руководитель (предприятие)</option>
                            <option value="admin">Админ</option>
                            <option value="student">Студент</option>
                          </select>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => handleUpdateAccount(a.id)} style={btnSave}>💾 Сохранить</button>
                            <button onClick={() => setEditingAccount(null)} style={btnEdit}>Отмена</button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700 }}>{a.login}</span>
                            <span style={{
                              padding: '3px 8px', borderRadius: '100px', fontSize: '0.72rem', fontWeight: 600,
                              background: a.role === 'admin' ? 'rgba(239,68,68,0.1)' :
                                         a.role === 'teacher' ? 'rgba(16,185,129,0.1)' :
                                         a.role === 'company' ? 'rgba(124,58,237,0.1)' : 'rgba(79,110,247,0.1)',
                              color: a.role === 'admin' ? '#ef4444' :
                                     a.role === 'teacher' ? '#10b981' :
                                     a.role === 'company' ? '#7c3aed' : '#4f6ef7',
                              border: `1px solid ${
                                a.role === 'admin' ? 'rgba(239,68,68,0.2)' :
                                a.role === 'teacher' ? 'rgba(16,185,129,0.2)' :
                                a.role === 'company' ? 'rgba(124,58,237,0.2)' : 'rgba(79,110,247,0.2)'
                              }`
                            }}>{a.role}</span>
                            <span style={{ color: '#4a5568', fontSize: '0.78rem' }}>
                              {new Date(a.created_at).toLocaleDateString('ru-RU')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => setEditingAccount({ ...a, newPassword: '' })} style={btnEdit}>✏️</button>
                            <button onClick={() => handleDeleteAccount(a.id)} style={btnDanger}>🗑️</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const thStyle = {
  padding: '12px 16px', fontSize: '0.75rem', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.08em',
  color: '#8892b0', borderBottom: '1px solid #1e2130', textAlign: 'left'
};

const tdStyle = {
  padding: '12px 16px', fontSize: '0.9rem', verticalAlign: 'middle'
};

export default AdminPanel;
