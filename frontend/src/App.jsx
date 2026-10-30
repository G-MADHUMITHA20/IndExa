import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import WelcomePage from './pages/WelcomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudentDashboard from './pages/StudentDashboard';
import ExamTakePage from './pages/ExamTakePage';
import TeacherDashboard from './pages/TeacherDashboard';
import ExamListPage from './pages/ExamListPage';
import CreateExamPage from './pages/CreateExamPage';
import EditExamPage from './pages/EditExamPage';
import ExamDetailPage from './pages/ExamDetailPage';
import QuestionManagementPage from './pages/QuestionManagementPage';
import TeacherProfilePage from './pages/TeacherProfilePage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { AccessibilityProvider } from './context/AccessibilityContext';
import AccessibilitySettingsModal from './components/AccessibilitySettingsModal';
import KeyboardShortcutsHelpModal from './components/KeyboardShortcutsHelpModal';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AccessibilityProvider>
          <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 transition-colors">
            <AccessibilitySettingsModal />
            <KeyboardShortcutsHelpModal />
            <Navbar />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<WelcomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Student Protected Routes */}
            <Route
              path="/student"
              element={<Navigate to="/student/dashboard" replace />}
            />
            <Route
              path="/student/dashboard"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/exams/:examId/take"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <ExamTakePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student/attempts/:attemptId"
              element={
                <ProtectedRoute allowedRoles={['student']}>
                  <ExamTakePage />
                </ProtectedRoute>
              }
            />

            {/* Teacher Protected Routes */}
            <Route
              path="/teacher"
              element={<Navigate to="/teacher/dashboard" replace />}
            />
            <Route
              path="/teacher/dashboard"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/exams"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <ExamListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/exams/create"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <CreateExamPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/exams/:examId"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <ExamDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/exams/:examId/edit"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <EditExamPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/exams/:examId/questions"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <QuestionManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher/profile"
              element={
                <ProtectedRoute allowedRoles={['teacher']}>
                  <TeacherProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Footer />
        </div>
      </AccessibilityProvider>
    </AuthProvider>
  </BrowserRouter>
);
}
