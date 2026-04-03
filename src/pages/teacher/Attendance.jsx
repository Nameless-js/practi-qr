import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../api/supabaseClient";

const Attendance = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [groupName, setGroupName] = useState("");
  const [students, setStudents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const datePickerRef = useRef(null);

  // Для модального окна истории
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentHistory, setStudentHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Close date picker on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
        setDatePickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const today = new Date().toISOString().split("T")[0];

  const formatDisplayDate = (dateStr) => {
    if (dateStr === today) return "Сегодня";
    const [y, m, d] = dateStr.split("-");
    return `${d}.${m}.${y}`;
  };

  useEffect(() => {
    fetchData();
  }, [groupId, selectedDate]);

  const fetchData = async () => {
    setLoading(true);

    const { data: grp } = await supabase
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .single();
    if (grp) setGroupName(grp.name);

    const { data: studentsData } = await supabase
      .from("students")
      .select("*")
      .eq("group_id", groupId)
      .order("name");

    setStudents(studentsData || []);

    const startOfDay = selectedDate + "T00:00:00";
    const endOfDay = selectedDate + "T23:59:59";

    const { data: attData } = await supabase
      .from("attendance")
      .select("*, companies(name, latitude, longitude)")
      .gte("scanned_at", startOfDay)
      .lte("scanned_at", endOfDay)
      .order("scanned_at", { ascending: false });

    setAttendance(attData || []);
    setLoading(false);
  };

  const getAttendanceForStudent = (studentId) => {
    return attendance.find((a) => a.student_id === studentId);
  };

  const openStudentHistoryModal = async (student) => {
    setSelectedStudent(student);
    setHistoryLoading(true);
    // Запрашиваем историю посещаемости за всё время
    const { data } = await supabase
      .from("attendance")
      .select("*, companies(name, latitude, longitude)")
      .eq("student_id", student.id)
      .order("scanned_at", { ascending: false });
    
    setStudentHistory(data || []);
    setHistoryLoading(false);
  };

  const openMaps = (studentLat, studentLng, companyLat, companyLng) => {
    if (!studentLat || !studentLng || !companyLat || !companyLng) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${studentLat},${studentLng}&destination=${companyLat},${companyLng}&travelmode=driving`;
    window.open(url, "_blank");
  };

  const getStatusBadge = (att) => {
    if (!att) return (
      <span style={{
        background: "rgba(245,158,11,0.1)", color: "#f59e0b",
        border: "1px solid rgba(245,158,11,0.2)",
        padding: "4px 10px", borderRadius: "100px",
        fontSize: "0.78rem", fontWeight: 600,
      }}>⏳ Ожидание</span>
    );
    if (att.status === "present") return (
      <span style={{
        background: "rgba(16,185,129,0.1)", color: "#10b981",
        border: "1px solid rgba(16,185,129,0.2)",
        padding: "4px 10px", borderRadius: "100px",
        fontSize: "0.78rem", fontWeight: 600,
      }}>✓ Совпадает</span>
    );
    return (
      <span style={{
        background: "rgba(239,68,68,0.1)", color: "#ef4444",
        border: "1px solid rgba(239,68,68,0.2)",
        padding: "4px 10px", borderRadius: "100px",
        fontSize: "0.78rem", fontWeight: 600,
      }}>✗ Не совпадает</span>
    );
  };

  const formatTime = (att) => {
    if (!att) return null;
    const date = new Date(att.scanned_at);
    date.setHours(date.getHours() + 5);
    return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
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
          Загрузка...
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0b0f", color: "#f1f3f9" }}>
      {/* Стили адаптивности */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .att-navbar {
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
        .att-navbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        .att-navbar-left h1 {
          margin: 0;
          font-size: 1rem;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        /* ── Date Picker Dropdown ── */
        .att-datepicker {
          position: relative;
          flex-shrink: 0;
        }
        .att-datepicker-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #16181f;
          color: #f1f3f9;
          border: 1px solid #2a2f45;
          padding: 8px 14px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .att-datepicker-btn:hover {
          border-color: #4f6ef7;
          background: #1c1f2e;
          box-shadow: 0 4px 16px rgba(79,110,247,0.2);
        }
        .att-datepicker-btn.open {
          border-color: #4f6ef7;
          background: #1c1f2e;
          box-shadow: 0 4px 16px rgba(79,110,247,0.2);
        }
        .att-datepicker-icon {
          width: 18px;
          height: 18px;
          object-fit: contain;
          opacity: 0.85;
          flex-shrink: 0;
        }
        .att-datepicker-label {
          color: #f1f3f9;
        }
        .att-datepicker-arrow {
          margin-left: 2px;
          font-size: 0.7rem;
          color: #8892b0;
          transition: transform 0.2s;
        }
        .att-datepicker-btn.open .att-datepicker-arrow {
          transform: rotate(180deg);
        }
        .att-datepicker-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: #16181f;
          border: 1px solid #2a2f45;
          border-radius: 16px;
          padding: 12px;
          box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 4px 16px rgba(79,110,247,0.12);
          z-index: 200;
          transform-origin: top right;
          animation: dpDropIn 0.18s ease;
        }
        @keyframes dpDropIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        .att-datepicker-native {
          background: #1e2130;
          color: #f1f3f9;
          border: 1px solid #2a2f45;
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 0.9rem;
          outline: none;
          cursor: pointer;
          width: 180px;
          color-scheme: dark;
        }
        .att-datepicker-native:focus {
          border-color: #4f6ef7;
          box-shadow: 0 0 0 3px rgba(79,110,247,0.15);
        }
        .att-datepicker-hint {
          font-size: 0.72rem;
          color: #4a5568;
          margin-top: 8px;
          text-align: center;
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
          border-radius: 16px; width: 100%; max-width: 600px;
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
          border-radius: 10px; margin-bottom: 8px; flex-wrap: wrap; gap: 10px;
        }

        /* Таблица — desktop */
        .att-table-wrapper {
          background: #16181f;
          border: 1px solid #1e2130;
          border-radius: 16px;
          overflow: hidden;
        }
        .att-table {
          width: 100%;
          border-collapse: collapse;
        }
        .att-table th {
          padding: 14px 16px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #8892b0;
          border-bottom: 1px solid #1e2130;
          text-align: left;
          white-space: nowrap;
        }
        .att-table td {
          padding: 12px 16px;
          font-size: 0.88rem;
          vertical-align: middle;
          border-bottom: 1px solid #1e2130;
        }
        .att-table tr:last-child td { border-bottom: none; }

        /* Карточки — mobile */
        .att-cards { display: none; flex-direction: column; gap: 10px; }
        .att-card {
          background: #16181f;
          border: 1px solid #1e2130;
          border-radius: 14px;
          padding: 1rem;
        }
        .att-card-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          gap: 8px;
        }
        .att-card-label {
          font-size: 0.72rem;
          color: #4a5568;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }
        .att-card-value {
          font-size: 0.85rem;
          color: #f1f3f9;
          text-align: right;
        }
        .att-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
          padding-bottom: 10px;
          border-bottom: 1px solid #1e2130;
        }
        .att-card-name {
          font-weight: 700;
          font-size: 0.95rem;
          color: #f1f3f9;
        }
        .att-map-btn {
          background: rgba(79,110,247,0.1);
          color: #4f6ef7;
          border: 1px solid rgba(79,110,247,0.2);
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.78rem;
          white-space: nowrap;
        }

        @media (max-width: 640px) {
          .att-navbar { padding: 0.6rem 0.75rem; }
          .att-navbar-left h1 { font-size: 0.85rem; }
          .att-datepicker-btn { font-size: 0.78rem; padding: 7px 10px; }
          .att-datepicker-native { width: 150px; }
          .att-table-wrapper { display: none; }
          .att-cards { display: flex; }
          .att-content { padding: 1rem 0.75rem !important; }
        }
      `}</style>

      {/* Навбар */}
      <div className="att-navbar">
        <div className="att-navbar-left">
          <button
            onClick={() => navigate("/teacher/groups")}
            style={{
              background: "#1c1f28", color: "#f1f3f9",
              border: "1px solid #1e2130",
              padding: "8px 12px", borderRadius: "10px",
              cursor: "pointer", fontWeight: 600, fontSize: "0.82rem",
              flexShrink: 0,
            }}
          >
            ← Назад
          </button>
          <h1>
            Группа: <span style={{ color: "#4f6ef7" }}>{groupName}</span>
          </h1>
        </div>
        {/* ── Date Picker Button ── */}
        <div className="att-datepicker" ref={datePickerRef}>
          <button
            className={`att-datepicker-btn${datePickerOpen ? " open" : ""}`}
            onClick={() => setDatePickerOpen((o) => !o)}
          >
            <img
              src="/images/timer.png"
              alt="calendar"
              className="att-datepicker-icon"
            />
            <span className="att-datepicker-label">
              {formatDisplayDate(selectedDate)}
            </span>
            <span className="att-datepicker-arrow">▼</span>
          </button>

          {datePickerOpen && (
            <div className="att-datepicker-dropdown">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setDatePickerOpen(false);
                }}
                className="att-datepicker-native"
                autoFocus
              />
              <div className="att-datepicker-hint">Выберите дату</div>
            </div>
          )}
        </div>
      </div>

      {/* Контент */}
      <div className="att-content" style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {students.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", color: "#8892b0" }}>
            <div style={{ fontSize: "3rem", opacity: 0.4, marginBottom: "1rem" }}>👤</div>
            <p>В этой группе пока нет студентов.</p>
          </div>
        ) : (
          <>
            {/* === DESKTOP ТАБЛИЦА === */}
            <div className="att-table-wrapper">
              <table className="att-table">
                <thead>
                  <tr>
                    <th>Студент</th>
                    <th>Предприятие</th>
                    <th>Время отметки</th>
                    <th>Статус</th>
                    <th>Карта</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const att = getAttendanceForStudent(student.id);
                    return (
                      <tr 
                        key={student.id} 
                        onClick={() => openStudentHistoryModal(student)}
                        style={{ cursor: 'pointer' }}
                        className="student-table-row"
                      >
                        <td>
                          <div style={{ fontWeight: 600, color: "#f1f3f9" }}>{student.name}</div>
                          <div style={{ color: "#8892b0", fontSize: "0.75rem", marginTop: "2px" }}>Кликните для просмотра истории</div>
                        </td>
                        <td>
                          {att
                            ? <span style={{ color: "#8892b0" }}>{att.companies?.name || "—"}</span>
                            : <span style={{ color: "#4a5568" }}>—</span>
                          }
                        </td>
                        <td>
                          {att
                            ? <span>{formatTime(att)}</span>
                            : <span style={{ color: "#4a5568" }}>Нет отметки</span>
                          }
                        </td>
                        <td>{getStatusBadge(att)}</td>
                        <td>
                          {att && att.lat && att.lng ? (
                            <button
                              className="att-map-btn"
                              onClick={(e) => { e.stopPropagation(); openMaps(att.lat, att.lng, att.companies.latitude, att.companies.longitude); }}
                            >
                              📍 Карта
                            </button>
                          ) : (
                            <span style={{ color: "#4a5568", fontSize: "0.85rem" }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* === MOBILE КАРТОЧКИ === */}
            <div className="att-cards">
              {students.map((student) => {
                const att = getAttendanceForStudent(student.id);
                return (
                  <div 
                    key={student.id} 
                    className="att-card" 
                    onClick={() => openStudentHistoryModal(student)} 
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="att-card-header">
                      <div>
                        <span className="att-card-name">{student.name}</span>
                        <div style={{ color: "#8892b0", fontSize: "0.75rem", marginTop: "2px", fontWeight: "normal" }}>Кликните для просмотра истории</div>
                      </div>
                      {getStatusBadge(att)}
                    </div>
                    <div className="att-card-row">
                      <span className="att-card-label">Предприятие</span>
                      <span className="att-card-value" style={{ color: "#8892b0" }}>
                        {att ? (att.companies?.name || "—") : "—"}
                      </span>
                    </div>
                    <div className="att-card-row">
                      <span className="att-card-label">Время отметки</span>
                      <span className="att-card-value">
                        {att ? formatTime(att) : <span style={{ color: "#4a5568" }}>Нет отметки</span>}
                      </span>
                    </div>
                    {att && att.lat && att.lng && (
                      <div style={{ marginTop: "8px" }}>
                        <button
                          className="att-map-btn"
                          style={{ width: "100%", justifyContent: "center" }}
                          onClick={(e) => { e.stopPropagation(); openMaps(att.lat, att.lng, att.companies.latitude, att.companies.longitude); }}
                        >
                          📍 Открыть на карте
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Модальное окно истории */}
      {selectedStudent && (
        <div className="modal-overlay" onClick={() => setSelectedStudent(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#f1f3f9" }}>История посещаемости (За всё время)</h2>
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
              {historyLoading ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "#8892b0" }}>Загрузка истории...</div>
              ) : studentHistory.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "#8892b0", background: "#111318", borderRadius: "10px", border: "1px dashed #2a2f45" }}>
                  Нет записей о посещаемости для этого студента.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {studentHistory.map(record => (
                    <div key={record.id} className="history-item">
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span style={{ fontWeight: 600, color: "#f1f3f9" }}>
                          {new Date(record.scanned_at).toLocaleDateString('ru-RU')}
                        </span>
                        <span style={{ fontSize: "0.85rem", color: "#8892b0" }}>
                          Время: {formatTime(record)}
                        </span>
                        <span style={{ fontSize: "0.85rem", color: "#8892b0" }}>
                          Предприятие: {record.companies?.name || "—"}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                        {getStatusBadge(record)}
                        {record.lat && record.lng && (
                          <button
                            className="att-map-btn"
                            onClick={() => openMaps(record.lat, record.lng, record.companies.latitude, record.companies.longitude)}
                            style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                          >
                            📍 Карта
                          </button>
                        )}
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

export default Attendance;
