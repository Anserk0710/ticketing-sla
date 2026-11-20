import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/app-layout';
import { PublicLayout } from '../components/layout/public-layout';
import { ApprovalsPage } from '../pages/internal/approvals-page';
import { ChangePasswordPage } from '../pages/internal/change-password-page';
import { DashboardPage } from '../pages/internal/dashboard-page';
import { NotificationsPage } from '../pages/internal/notifications-page';
import { ReportsPage } from '../pages/internal/reports-page';
import { SettingsPage } from '../pages/internal/settings-page';
import { TicketDetailPage } from '../pages/internal/ticket-detail-page';
import { TicketsPage } from '../pages/internal/tickets-page';
import { NotFoundPage } from '../pages/not-found-page';
import { ForgotPasswordPage } from '../pages/public/forgot-password-page';
import { HomePage } from '../pages/public/home-page';
import { LoginPage } from '../pages/public/login-page';
import { PublicComplaintPage } from '../pages/public/public-complaint-page';
import { PublicTrackPage } from '../pages/public/public-track-page';
import { ResetPasswordPage } from '../pages/public/reset-password-page';
import { TechnicianRegisterPage } from '../pages/public/technician-register-page';
import { MyAssignmentsPage } from '../pages/technician/my-assignments-page';
import { ProtectedRoute } from '../routes/protected-route';

export const router = createBrowserRouter([
  { element: <PublicLayout />, children: [
    { path: '/', element: <HomePage /> },
    { path: '/complaint', element: <PublicComplaintPage /> },
    { path: '/complaint/:qrToken', element: <PublicComplaintPage /> },
    { path: '/track', element: <PublicTrackPage /> },
    { path: '/login', element: <LoginPage /> },
    { path: '/register-technician', element: <TechnicianRegisterPage /> },
    { path: '/forgot-password', element: <ForgotPasswordPage /> },
    { path: '/reset-password', element: <ResetPasswordPage /> }
  ]},
  { element: <ProtectedRoute />, children: [
    { path: '/change-password', element: <ChangePasswordPage /> },
    { path: '/app', element: <AppLayout />, children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'tickets', element: <TicketsPage /> },
      { path: 'tickets/:id', element: <TicketDetailPage /> },
      { path: 'assignments', element: <MyAssignmentsPage /> },
      { path: 'approvals', element: <ApprovalsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'notifications', element: <NotificationsPage /> }
    ]}
  ]},
  { path: '*', element: <NotFoundPage /> }
]);
