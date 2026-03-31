import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    fetchData();
  }, [groupId, selectedDate]);

  const fetchData = async () => {
    setLoading(true);

    // 1. Название группы
    const { data: grp } = await supabase
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .single();
    if (grp) setGroupName(grp.name);

    // 2. Студенты этой группы
    const { data: studentsData } = await supabase
      .from("students")
      .select("*")
      .eq("group_id", groupId)
      .order("name");

    setStudents(studentsData || []);

    // 3. Посещаемость за выбранную дату
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

  // Находим запись посещаемости для конкретного студента
  const getAttendanceForStudent = (studentId) => {
    return attendance.find((a) => a.student_id === studentId);
  };

  const openMaps = (studentLat, studentLng, companyLat, companyLng) => {
    if (!studentLat || !studentLng || !companyLat || !companyLng) return;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${studentLat},${studentLng}&destination=${companyLat},${companyLng}&travelmode=driving`;
    window.open(url, "_blank");
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0a0b0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#8892b0",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid #1e2130",
              borderTopColor: "#4f6ef7",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          Загрузка...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ minHeight: "100vh", background: "#0a0b0f", color: "#f1f3f9" }}
    >
      {/* Навбар */}
      <div
        style={{
          background: "rgba(10,11,15,0.9)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid #1e2130",
          padding: "1rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate("/teacher/groups")}
            style={{
              background: "#1c1f28",
              color: "#f1f3f9",
              border: "1px solid #1e2130",
              padding: "8px 14px",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
            }}
          >
            ← Назад
          </button>
          <h1 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>
            Группа: <span style={{ color: "#4f6ef7" }}>{groupName}</span>
          </h1>
        </div>
        <div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              background: "#16181f",
              color: "#f1f3f9",
              border: "1px solid #1e2130",
              padding: "8px 14px",
              borderRadius: "10px",
              fontSize: "0.85rem",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Таблица */}
      <div
        style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem 1.5rem" }}
      >
        {students.length === 0 ? (
          <div
            style={{ textAlign: "center", padding: "4rem", color: "#8892b0" }}
          >
            <div
              style={{ fontSize: "3rem", opacity: 0.4, marginBottom: "1rem" }}
            >
              👤
            </div>
            <p>В этой группе пока нет студентов.</p>
          </div>
        ) : (
          <div
            style={{
              background: "#16181f",
              border: "1px solid #1e2130",
              borderRadius: "16px",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Студент</th>
                  <th style={thStyle}>Предприятие</th>
                  <th style={thStyle}>Время отметки</th>
                  <th style={thStyle}>Статус</th>
                  <th style={thStyle}>Карта</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const att = getAttendanceForStudent(student.id);
                  return (
                    <tr
                      key={student.id}
                      style={{ borderBottom: "1px solid #1e2130" }}
                    >
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600 }}>{student.name}</div>
                      </td>
                      <td style={tdStyle}>
                        {att ? (
                          <span style={{ color: "#8892b0" }}>
                            {att.companies?.name || "—"}
                          </span>
                        ) : (
                          <span style={{ color: "#4a5568" }}>—</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {att ? (
                          <span>
                            {(() => {
                              const date = new Date(att.scanned_at);
                              date.setHours(date.getHours() + 5); // прибавляем 5 часов
                              return date.toLocaleTimeString("ru-RU", {
                                hour: "2-digit",
                                minute: "2-digit",
                              });
                            })()}
                          </span>
                        ) : (
                          <span style={{ color: "#4a5568" }}>Нет отметки</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {att ? (
                          att.status === "present" ? (
                            <span
                              style={{
                                background: "rgba(16,185,129,0.1)",
                                color: "#10b981",
                                border: "1px solid rgba(16,185,129,0.2)",
                                padding: "4px 10px",
                                borderRadius: "100px",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                              }}
                            >
                              ✓ Совпадает
                            </span>
                          ) : (
                            <span
                              style={{
                                background: "rgba(239,68,68,0.1)",
                                color: "#ef4444",
                                border: "1px solid rgba(239,68,68,0.2)",
                                padding: "4px 10px",
                                borderRadius: "100px",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                              }}
                            >
                              ✗ Не совпадает
                            </span>
                          )
                        ) : (
                          <span
                            style={{
                              background: "rgba(245,158,11,0.1)",
                              color: "#f59e0b",
                              border: "1px solid rgba(245,158,11,0.2)",
                              padding: "4px 10px",
                              borderRadius: "100px",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                            }}
                          >
                            ⏳ Ожидание
                          </span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {att && att.lat && att.lng ? (
                          <button
                            onClick={() =>
                              openMaps(
                                att.lat,
                                att.lng,
                                att.companies.latitude,
                                att.companies.longitude,
                              )
                            }
                            style={{
                              background: "rgba(79,110,247,0.1)",
                              color: "#4f6ef7",
                              border: "1px solid rgba(79,110,247,0.2)",
                              padding: "6px 12px",
                              borderRadius: "8px",
                              cursor: "pointer",
                              fontWeight: 600,
                              fontSize: "0.78rem",
                            }}
                          >
                            📍 Карта
                          </button>
                        ) : (
                          <span
                            style={{ color: "#4a5568", fontSize: "0.85rem" }}
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const thStyle = {
  padding: "14px 16px",
  fontSize: "0.75rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#8892b0",
  borderBottom: "1px solid #1e2130",
  textAlign: "left",
};

const tdStyle = {
  padding: "14px 16px",
  fontSize: "0.9rem",
  verticalAlign: "middle",
};

export default Attendance;
