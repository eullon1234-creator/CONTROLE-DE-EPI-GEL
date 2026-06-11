import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Saida from './pages/Saida';
import Entrada from './pages/Entrada';
import Estoque from './pages/Estoque';
import Historico from './pages/Historico';
import Produtos from './pages/Produtos';
import Importar from './pages/Importar';
import Imprimir from './pages/Imprimir';

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/CONTROLE-DE-EPI-GEL">
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a2235',
              color: '#f1f5f9',
              border: '1px solid #2a3a52',
              borderRadius: '10px',
              fontSize: '0.875rem',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#1a2235' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#1a2235' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/" element={
            <PrivateRoute>
              <AppLayout><Dashboard /></AppLayout>
            </PrivateRoute>
          } />

          <Route path="/saida" element={
            <PrivateRoute>
              <AppLayout><Saida /></AppLayout>
            </PrivateRoute>
          } />

          <Route path="/entrada" element={
            <PrivateRoute>
              <AppLayout><Entrada /></AppLayout>
            </PrivateRoute>
          } />

          <Route path="/estoque" element={
            <PrivateRoute>
              <AppLayout><Estoque /></AppLayout>
            </PrivateRoute>
          } />

          <Route path="/historico" element={
            <PrivateRoute>
              <AppLayout><Historico /></AppLayout>
            </PrivateRoute>
          } />

          <Route path="/produtos" element={
            <PrivateRoute>
              <AppLayout><Produtos /></AppLayout>
            </PrivateRoute>
          } />

          <Route path="/importar" element={
            <PrivateRoute>
              <AppLayout><Importar /></AppLayout>
            </PrivateRoute>
          } />

          <Route path="/imprimir" element={
            <PrivateRoute>
              <AppLayout><Imprimir /></AppLayout>
            </PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
