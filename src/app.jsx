import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/auth/login';
import Scan from './pages/student/Scan';
import 'leaflet/dist/leaflet.css';
import Generator from './pages/company/Generator';
import Groups from './pages/teacher/Groups';
import Attendance from './pages/teacher/Attendance';
import AdminPanel from './pages/admin/AdminPanel';

const ProtectedRoute = ({ children, allowedRoles }) => {
  let user = null;
  try { user = JSON.parse(localStorage.getItem('practi_user')); } catch {}

  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route path="/student/scan" element={
          <ProtectedRoute allowedRoles={['student']}>
            <Scan />
          </ProtectedRoute>
        } />

        <Route path="/company/generator" element={
          <ProtectedRoute allowedRoles={['company']}>
            <Generator />
          </ProtectedRoute>
        } />

        <Route path="/teacher/groups" element={
          <ProtectedRoute allowedRoles={['teacher', 'admin']}>
            <Groups />
          </ProtectedRoute>
        } />

        <Route path="/teacher/attendance/:groupId" element={
          <ProtectedRoute allowedRoles={['teacher', 'admin']}>
            <Attendance />
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['teacher', 'admin']}>
            <AdminPanel />
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;