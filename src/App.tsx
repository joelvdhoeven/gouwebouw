import React, { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import FinancieelDashboard from './pages/FinancieelDashboard';
import Urenregistratie from './pages/Urenregistratie';
import MijnNotificaties from './pages/MijnNotificaties';
import SpeciaalGereedschap from './pages/SpeciaalGereedschap';
import Projecten from './pages/Projecten';
import Schademeldingen from './pages/Schademeldingen';
import Gebruikers from './pages/Gebruikers';
import Meldingen from './pages/Meldingen';
import Instellingen from './pages/Instellingen';
import EmailNotifications from './pages/EmailNotifications';
import VoorraadbeheerAdmin from './pages/VoorraadbeheerAdmin';
import VoorraadbeheerAfboeken from './pages/VoorraadbeheerAfboeken';
import FactuurInstellingen from './pages/FactuurInstellingen';
import TicketOmgeving from './pages/TicketOmgeving';
import TicketsOverzicht from './pages/TicketsOverzicht';

function App() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Show login page if user is not authenticated
  if (!user) {
    return <Login />;
  }
  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <ProtectedRoute permission="view_dashboard">
            <Dashboard />
          </ProtectedRoute>
        );
      case 'financieel-dashboard':
        return (
          <ProtectedRoute permission="manage_settings">
            <FinancieelDashboard />
          </ProtectedRoute>
        );
      case 'urenregistratie':
        return (
          <ProtectedRoute permission="register_hours">
            <Urenregistratie />
          </ProtectedRoute>
        );
      case 'mijn-notificaties':
        return (
          <ProtectedRoute permission="register_hours">
            <MijnNotificaties />
          </ProtectedRoute>
        );
      case 'speciaal-gereedschap':
        return (
          <ProtectedRoute permission="view_tools">
            <SpeciaalGereedschap />
          </ProtectedRoute>
        );
      case 'projecten':
        return (
          <ProtectedRoute permission="view_projects">
            <Projecten />
          </ProtectedRoute>
        );
      case 'schademeldingen':
        return (
          <ProtectedRoute permission="view_damage_reports">
            <Schademeldingen />
          </ProtectedRoute>
        );
      case 'voorraad-afboeken':
        return (
          <ProtectedRoute permission="view_dashboard">
            <VoorraadbeheerAfboeken />
          </ProtectedRoute>
        );
      case 'voorraadbeheer':
        return (
          <ProtectedRoute permission="manage_settings">
            <VoorraadbeheerAdmin />
          </ProtectedRoute>
        );
      case 'gebruikers':
        return (
          <ProtectedRoute permission="manage_users">
            <Gebruikers />
          </ProtectedRoute>
        );
      case 'meldingen':
        return (
          <ProtectedRoute permission="manage_notifications">
            <Meldingen />
          </ProtectedRoute>
        );
      case 'email-notificaties':
        return (
          <ProtectedRoute permission="manage_settings">
            <EmailNotifications />
          </ProtectedRoute>
        );
      case 'instellingen':
        return <Instellingen />;
      case 'factuur-instellingen':
        return (
          <ProtectedRoute permission="manage_settings">
            <FactuurInstellingen />
          </ProtectedRoute>
        );
      case 'ticket-omgeving':
        return (
          <ProtectedRoute permission="create_tickets">
            <TicketOmgeving />
          </ProtectedRoute>
        );
      case 'tickets-overzicht':
        return (
          <ProtectedRoute permission="view_all_tickets">
            <TicketsOverzicht />
          </ProtectedRoute>
        );
      default:
        return (
          <ProtectedRoute permission="view_dashboard">
            <Dashboard />
          </ProtectedRoute>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        activeSection={activeSection}
        setActiveSection={(section) => {
          setActiveSection(section);
          setIsSidebarOpen(false);
        }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          onNotificationClick={() => setActiveSection('meldingen')}
          onMenuClick={() => setIsSidebarOpen(true)}
        />
        <main className="flex-1 p-4 md:p-6 flex justify-center">
          <div className="w-full max-w-[1400px]">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;