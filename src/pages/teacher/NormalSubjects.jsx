import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../api/supabaseClient';

const NormalSubjects = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const fetchData = async () => {
    setLoading(true);
    // Fetch group details
    const { data: grp } = await supabase
      .from('groups')
      .select('name')
      .eq('id', groupId)
      .single();
    if (grp) setGroupName(grp.name);

    // Fetch subjects assigned to this group
    const { data: gsData, error } = await supabase
      .from('group_subjects')
      .select('subject_id, subjects(id, name)')
      .eq('group_id', groupId);

    if (!error && gsData) {
      // gsData is an array of objects: { subject_id, subjects: { id, name } }
      const mappedSubjects = gsData
        .filter(gs => gs.subjects)
        .map(gs => ({
          id: gs.subjects.id,
          name: gs.subjects.name,
        }));
      setSubjects(mappedSubjects);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0b0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8892b0'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', border: '3px solid #1e2130',
            borderTopColor: '#4f6ef7', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px'
          }} />
          Загрузка предметов...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0b0f', color: '#f1f3f9' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .ns-navbar {
          background: rgba(10,11,15,0.9); backdrop-filter: blur(20px);
          border-bottom: 1px solid #1e2130; padding: 0.75rem 1rem;
          display: flex; alignItems: center; position: sticky; top: 0; z-index: 100;
        }
        .ns-back-btn {
          background: #1c1f28; color: #f1f3f9; border: 1px solid #1e2130;
          padding: 8px 12px; border-radius: 10px; cursor: pointer;
          font-weight: 600; font-size: 0.82rem; margin-right: 15px;
        }
        .ns-title { margin: 0; font-size: 1rem; font-weight: 700; color: #f1f3f9; }
        .ns-subtitle { color: #4f6ef7; }
        .ns-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-top: 1.5rem; }
        .ns-card {
          background: #16181f; border: 1px solid #1e2130; border-radius: 14px;
          padding: 1.5rem; cursor: pointer; transition: all 0.2s ease;
        }
        .ns-card:hover {
          border-color: #4f6ef7; transform: translateY(-3px);
          box-shadow: 0 10px 30px rgba(79,110,247,0.15);
        }
        .ns-card-icon { font-size: 2rem; margin-bottom: 12px; }
        .ns-card-title { font-size: 1.1rem; font-weight: 600; margin: 0 0 4px 0; }
      `}</style>

      <div className="ns-navbar">
        <button onClick={() => navigate('/teacher/groups')} className="ns-back-btn">
          ← Назад
        </button>
        <h1 className="ns-title">
          Предметы <span className="ns-subtitle">({groupName})</span>
        </h1>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {subjects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#8892b0' }}>
            <div style={{ fontSize: '3rem', opacity: 0.4, marginBottom: '1rem' }}>📚</div>
            <p>У этой группы пока нет обычных предметов.</p>
          </div>
        ) : (
          <div className="ns-grid">
            {subjects.map(subject => (
              <div
                key={subject.id}
                className="ns-card"
                onClick={() => navigate(`/teacher/normal-attendance/${groupId}/${subject.id}`)}
              >
                <div className="ns-card-icon">📘</div>
                <h3 className="ns-card-title">{subject.name}</h3>
                <div style={{ color: '#8892b0', fontSize: '0.85rem' }}>
                  Нажмите для просмотра посещаемости
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NormalSubjects;
