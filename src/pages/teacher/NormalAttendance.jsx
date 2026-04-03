import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../api/supabaseClient";

const NormalAttendance = () => {
  const { groupId, subjectId } = useParams();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Для глобального окна отметки (рабочая дата)
  const todayDate = new Date().toISOString().split("T")[0];
  const [attendanceDate, setAttendanceDate] = useState(todayDate);
  const [attDatePickerOpen, setAttDatePickerOpen] = useState(false);
  const attDatePickerRef = useRef(null);

  // Для индивидуальной модалки студента (история)
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [filterDate, setFilterDate] = useState("");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef(null);

  // Закрытие дропдаунов при клике вне
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
        setDatePickerOpen(false);
      }
      if (attDatePickerRef.current && !attDatePickerRef.current.contains(e.target)) {
        setAttDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    fetchData();
  }, [groupId, subjectId]);

  const fetchData = async () => {
    setLoading(true);

    const { data: grp } = await supabase.from("groups").select("name").eq("id", groupId).single();
    if (grp) setGroupName(grp.name);

    const { data: subj } = await supabase.from("subjects").select("name").eq("id", subjectId).single();
    if (subj) setSubjectName(subj.name);

    const { data: studentsData } = await supabase.from("students").select("*").eq("group_id", groupId).order("name");
    setStudents(studentsData || []);

    const { data: attData } = await supabase
      .from("normal_attendance")
      .select("*")
      .eq("subject_id", subjectId)
      .order("date", { ascending: false });
    
    setAttendance(attData || []);
    setLoading(false);
  };

  const getStatusForStudentOnDate = (studentId, date) => {
    const record = attendance.find(a => a.student_id === studentId && a.date === date);
    return record ? record.status : null; // "present" | "absent" | null
  };

  const handleMarkAttendance = async (studentId, status) => {
    // Оптимистичное обновление UI
    const existingIndex = attendance.findIndex(a => a.student_id === studentId && a.date === attendanceDate);
    let newAttendance = [...attendance];
    
    if (existingIndex > -1) {
      newAttendance[existingIndex] = { ...newAttendance[existingIndex], status };
    } else {
      newAttendance.push({
        id: "temp-" + Date.now(),
        student_id: studentId,
        subject_id: subjectId,
        date: attendanceDate,
        status: status
      });
    }
    setAttendance(newAttendance);

    // Удаление старой записи во избежание дубликатов (если unique constraint не настроен)
    await supabase.from("normal_attendance").delete()
      .eq("student_id", studentId)
      .eq("subject_id", subjectId)
      .eq("date", attendanceDate);

    // Добавление новой
    const { data, error } = await supabase.from("normal_attendance").insert([{
      student_id: studentId,
      subject_id: subjectId,
      date: attendanceDate,
      status: status
    }]).select().single();

    // Заменяем временный ID на реальный
    if (!error && data) {
      setAttendance(prev => prev.map(a => a.student_id === studentId && a.date === attendanceDate ? data : a));
    }
  };

  const handleMarkAllPresent = async () => {
    if (!window.confirm(`Отметить всех студентов (${students.length} чел.) как присутствующих за ${formatDisplayDate(attendanceDate)}?`)) return;
    
    // Оптимистичное обновление
    const newRecords = students.map(st => ({
      id: "temp-" + crypto.randomUUID(),
      student_id: st.id,
      subject_id: subjectId,
      date: attendanceDate,
      status: "present"
    }));

    const filtered = attendance.filter(a => a.date !== attendanceDate);
    setAttendance([...filtered, ...newRecords]);

    // База данных
    const studentIds = students.map(s => s.id);
    await supabase.from("normal_attendance").delete()
      .eq("subject_id", subjectId)
      .eq("date", attendanceDate)
      .in("student_id", studentIds);

    const inserts = students.map(st => ({
      student_id: st.id,
      subject_id: subjectId,
      date: attendanceDate,
      status: "present"
    }));

    await supabase.from("normal_attendance").insert(inserts);
    fetchData(); // для получения реальных ID
  };

  const getStatusBadge = (status) => {
    if (status === "present") return (
      <span style={{
        background: "rgba(16,185,129,0.1)", color: "#10b981",
        border: "1px solid rgba(16,185,129,0.2)",
        padding: "4px 10px", borderRadius: "100px",
        fontSize: "0.78rem", fontWeight: 600,
      }}>Присутствовал</span>
    );
    if (status === "absent") return (
      <span style={{
        background: "rgba(239,68,68,0.1)", color: "#ef4444",
        border: "1px solid rgba(239,68,68,0.2)",
        padding: "4px 10px", borderRadius: "100px",
        fontSize: "0.78rem", fontWeight: 600,
      }}>Отсутствовал</span>
    );
    return null;
  };

  const openStudentModal = (student) => {
    setSelectedStudent(student);
    setFilterDate(""); 
  };

  const getStudentHistory = () => {
    if (!selectedStudent) return [];
    let history = attendance.filter(a => a.student_id === selectedStudent.id);
    if (filterDate) {
      history = history.filter(a => a.date === filterDate);
    }
    // Sort logic handled implicitly since original data was ordered by date desc
    return history.sort((a,b) => new Date(b.date) - new Date(a.date));
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "За все время";
    const [y, m, d] = dateStr.split("-");
    const today = new Date().toISOString().split("T")[0];
    if (dateStr === today) return "Сегодня";
    return `${d}.${m}.${y}`;
  };

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0a0b0f",
        display: "flex", alignItems: "center", justifyContent: "center", color: "#8892b0",
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "40px", height: "40px",
            border: "3px solid #1e2130", borderTopColor: "#4f6ef7",
            borderRadius: "50%", animation: "spin 0.8s linear infinite",
            margin: "0 auto 16px",
          }} />
          Загрузка данных...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#f1f3f9" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .na-navbar {
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
          gap: 10px;
          flex-wrap: wrap;
        }
        .na-navbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
        }
        .na-navbar-left h1 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .student-grid {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 1rem;
        }
        .student-card {
          background: #16181f;
          border: 1px solid #1e2130;
          border-radius: 14px;
          padding: 1rem 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: border-color 0.2s ease;
          gap: 15px;
          flex-wrap: wrap;
        }
        .student-card:hover { border-color: #3d4466; }
        
        .student-info {
          display: flex; align-items: center; gap: 1rem;
          cursor: pointer; flex: 1; min-width: 200px;
        }
        .student-avatar {
          width: 42px; height: 42px;
          border-radius: 50%;
          background: rgba(79,110,247,0.1);
          color: #4f6ef7;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.2rem; font-weight: bold; flex-shrink: 0;
        }

        .student-actions {
          display: flex; gap: 8px; flex-shrink: 0;
        }
        
        .action-btn {
          padding: 8px 14px; border-radius: 10px; font-weight: 600; font-size: 0.85rem;
          cursor: pointer; border: 1px solid transparent; transition: all 0.2s;
          display: flex; align-items: center; gap: 6px;
        }
        .action-btn.present {
          background: rgba(16,185,129,0.1); color: #10b981; border-color: rgba(16,185,129,0.3);
        }
        .action-btn.present:hover, .action-btn.present.active {
          background: #10b981; color: #fff;
        }
        .action-btn.absent {
          background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.3);
        }
        .action-btn.absent:hover, .action-btn.absent.active {
          background: #ef4444; color: #fff;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 1rem;
        }
        .modal-content {
          background: #16181f; border: 1px solid #1e2130;
          border-radius: 16px; width: 100%; max-width: 500px;
          max-height: 90vh; display: flex; flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .modal-header {
          padding: 1.5rem; border-bottom: 1px solid #1e2130;
          display: flex; justify-content: space-between; align-items: flex-start;
        }
        .modal-body {
          padding: 1.5rem; overflow-y: auto;
        }
        .history-item {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 16px; background: #111318; border: 1px solid #1e2130;
          border-radius: 10px; margin-bottom: 8px;
        }

        /* Calendar Button */
        .na-datepicker { position: relative; display: inline-block; }
        .na-datepicker-btn {
          display: flex; align-items: center; gap: 8px;
          background: #1c1f2e; color: #f1f3f9; border: 1px solid #2a2f45;
          padding: 8px 14px; border-radius: 10px; cursor: pointer;
          font-size: 0.85rem; font-weight: 600; transition: all 0.2s;
        }
        .na-datepicker-btn:hover { border-color: #4f6ef7; }
        .na-datepicker-dropdown {
          position: absolute; top: calc(100% + 8px); right: 0;
          background: #16181f; border: 1px solid #2a2f45; border-radius: 16px;
          padding: 12px; box-shadow: 0 16px 48px rgba(0,0,0,0.6); z-index: 200;
        }
        .na-datepicker-native {
          background: #1e2130; color: #f1f3f9; border: 1px solid #2a2f45;
          border-radius: 10px; padding: 9px 12px; font-size: 0.9rem;
          outline: none; cursor: pointer; width: 180px; color-scheme: dark;
        }
        
        .clear-filter-btn {
          margin-top: 8px; background: rgba(239,68,68,0.1); color: #ef4444;
          border: 1px solid rgba(239,68,68,0.2); padding: 6px 12px;
          border-radius: 8px; cursor: pointer; font-size: 0.75rem; width: 100%;
        }

        .tools-panel {
          display: flex; justify-content: space-between; align-items: center;
          background: #111318; padding: 16px; border-radius: 14px;
          border: 1px solid #1e2130; margin-bottom: 1rem; flex-wrap: wrap; gap: 10px;
        }

      `}</style>

      <div className="na-navbar">
        <div className="na-navbar-left">
          <button
            onClick={() => navigate(`/teacher/normal-subjects/${groupId}`)}
            style={{
              background: "#1c1f28", color: "#f1f3f9", border: "1px solid #1e2130",
              padding: "8px 12px", borderRadius: "10px", cursor: "pointer",
              fontWeight: 600, fontSize: "0.82rem",
            }}
          >
            ← Назад
          </button>
          <h1>
            {subjectName} <span style={{ color: "#4f6ef7", fontWeight: 'normal' }}>({groupName})</span>
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        
        {/* Инструменты управления: Дата и Отметить всех */}
        <div className="tools-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ color: '#8892b0', fontSize: '0.9rem', fontWeight: 600 }}>Выставление оценок за:</div>
            
            <div className="na-datepicker" ref={attDatePickerRef}>
              <button
                className="na-datepicker-btn"
                onClick={() => setAttDatePickerOpen(!attDatePickerOpen)}
              >
                <img src="/images/timer.png" alt="calendar" style={{ width: "16px" }} />
                <span>{formatDisplayDate(attendanceDate)}</span>
                <span style={{ fontSize: "0.6rem", marginLeft: "4px" }}>▼</span>
              </button>

              {attDatePickerOpen && (
                <div className="na-datepicker-dropdown" style={{ left: 0, right: 'auto' }}>
                  <input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => {
                      setAttendanceDate(e.target.value);
                      setAttDatePickerOpen(false);
                    }}
                    className="na-datepicker-native"
                  />
                </div>
              )}
            </div>
          </div>
          
          <button 
            onClick={handleMarkAllPresent}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white', border: 'none', padding: '10px 16px', borderRadius: '10px',
              cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem',
              display: 'flex', alignItems: 'center', gap: '8px',
              boxShadow: '0 4px 12px rgba(16,185,129,0.2)'
            }}
          >
            <span>✅</span> Отметить всех как присутствующих
          </button>
        </div>

        {students.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "#8892b0" }}>
            <div style={{ fontSize: "3rem", opacity: 0.4, marginBottom: "1rem" }}>👤</div>
            <p>В этой группе пока нет студентов.</p>
          </div>
        ) : (
          <div className="student-grid">
            {students.map((student) => {
              const currentStatus = getStatusForStudentOnDate(student.id, attendanceDate);
              return (
                <div key={student.id} className="student-card">
                  <div className="student-info" onClick={() => openStudentModal(student)}>
                    <div className="student-avatar">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "1.05rem", color: "#f1f3f9" }}>
                        {student.name}
                      </div>
                      <div style={{ color: "#8892b0", fontSize: "0.85rem", marginTop: "4px" }}>
                        Кликните для просмотра истории
                      </div>
                    </div>
                  </div>
                  
                  <div className="student-actions">
                    <button 
                      className={`action-btn present ${currentStatus === 'present' ? 'active' : ''}`}
                      onClick={() => handleMarkAttendance(student.id, 'present')}
                    >
                      ✓ Присутствовал
                    </button>
                    <button 
                      className={`action-btn absent ${currentStatus === 'absent' ? 'active' : ''}`}
                      onClick={() => handleMarkAttendance(student.id, 'absent')}
                    >
                      ✕ Отсутствовал
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Модальное окно истории */}
      {selectedStudent && (
        <div className="modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#f1f3f9" }}>История посещаемости</h2>
                <div style={{ color: "#4f6ef7", marginTop: "4px", fontWeight: 600 }}>{selectedStudent.name}</div>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)}
                style={{
                  background: "transparent", border: "none", color: "#8892b0",
                  fontSize: "1.5rem", cursor: "pointer", padding: 0
                }}
              >
                &times;
              </button>
            </div>

            <div className="modal-body">
              {/* Календарь-фильтр внутри модалки */}
              <div className="na-datepicker" ref={datePickerRef} style={{ marginBottom: "1rem" }}>
                <button
                  className="na-datepicker-btn"
                  onClick={() => setDatePickerOpen(!datePickerOpen)}
                >
                  <img src="/images/timer.png" alt="calendar" style={{ width: "16px", filter: filterDate ? "none" : "grayscale(100%)" }} />
                  <span>{formatDisplayDate(filterDate)}</span>
                  <span style={{ fontSize: "0.6rem", marginLeft: "4px" }}>▼</span>
                </button>

                {datePickerOpen && (
                  <div className="na-datepicker-dropdown" style={{ left: 0, right: 'auto' }}>
                    <input
                      type="date"
                      value={filterDate}
                      onChange={(e) => {
                        setFilterDate(e.target.value);
                        setDatePickerOpen(false);
                      }}
                      className="na-datepicker-native"
                    />
                    {filterDate && (
                      <button className="clear-filter-btn" onClick={() => { setFilterDate(""); setDatePickerOpen(false); }}>
                        Показать за все время
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Список истории */}
              {getStudentHistory().length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#8892b0", background: "#111318", borderRadius: "10px", border: "1px dashed #2a2f45" }}>
                  Нет записей о посещаемости {filterDate ? "за выбранную дату" : "по этому предмету"}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {getStudentHistory().map((record, idx) => (
                    <div key={record.id || idx} className="history-item">
                      <div style={{ fontWeight: 600, color: "#f1f3f9" }}>
                        {new Date(record.date).toLocaleDateString('ru-RU')}
                      </div>
                      <div>
                        {getStatusBadge(record.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NormalAttendance;
