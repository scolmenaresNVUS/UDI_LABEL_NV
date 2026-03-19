import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/Auth/LoginPage';
import AppShell from './components/Layout/AppShell';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import UserManagement from './components/Auth/UserManagement';
import LabelDataForm from './components/LabelForm/LabelDataForm';
import ProductList from './components/ProductManager/ProductList';
import LabelDesigner from './components/LabelDesigner/LabelDesigner';
import PrinterManager from './components/PrinterManager/PrinterManager';
import BatchPrintPage from './components/BatchPrint/BatchPrintPage';
import PrintHistory from './components/PrintHistory/PrintHistory';
import AuditLogViewer from './components/AuditLog/AuditLogViewer';
import PrintQueue from './components/PrintQueue/PrintQueue';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/labels" replace />} />
        <Route path="/labels" element={<LabelDataForm />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/templates" element={<LabelDesigner />} />
        <Route path="/print" element={<BatchPrintPage />} />
        <Route path="/print-history" element={<PrintHistory />} />
        <Route path="/print-queue" element={<PrintQueue />} />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/printers"
          element={
            <ProtectedRoute requiredRole="admin">
              <PrinterManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/audit-log"
          element={
            <ProtectedRoute requiredRole="admin">
              <AuditLogViewer />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
