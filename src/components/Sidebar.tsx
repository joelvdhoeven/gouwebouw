import React, { useEffect, useState } from 'react';
import {
  Home,
  Clock,
  Wrench,
  FolderOpen,
  AlertTriangle,
  Users,
  Bell,
  Settings,
  Mail,
  X,
  Package,
  FileText,
  TrendingUp,
  Ticket
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import ProtectedRoute from './ProtectedRoute';

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, setActiveSection, isOpen, onClose }) => {
  const { t } = useLanguage();
  const { hasPermission } = useAuth();
  const [moduleSettings, setModuleSettings] = useState<any>(null);

  useEffect(() => {
    loadModuleSettings();

    // Subscribe to changes
    const subscription = supabase
      .channel('system_settings_sidebar')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'system_settings'
      }, () => {
        loadModuleSettings();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadModuleSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .maybeSingle();

      setModuleSettings(data || {
        module_invoicing: true,
        module_hourly_rates: true,
        module_damage_reports: true,
        module_inventory: true,
        module_notifications: true,
        module_email_notifications: true,
        module_time_registration: true,
        module_special_tools: true,
        module_financial_dashboard: true,
      });
    } catch (error) {
      console.error('Error loading module settings:', error);
    }
  };

  const allMenuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: Home, permission: 'view_dashboard', module: null },
    { id: 'financieel-dashboard', label: 'Financieel Dashboard', icon: TrendingUp, permission: 'manage_settings', module: 'module_financial_dashboard' },
    { id: 'urenregistratie', label: t('urenregistratie'), icon: Clock, permission: 'register_hours', module: 'module_time_registration' },
    { id: 'mijn-notificaties', label: 'Notificaties', icon: Bell, permission: 'register_hours', module: 'module_notifications' },
    { id: 'voorraad-afboeken', label: 'Voorraad Afboeken', icon: Package, permission: 'view_dashboard', module: 'module_inventory' },
    { id: 'voorraadbeheer', label: 'Voorraadbeheer', icon: Package, permission: 'manage_settings', module: 'module_inventory' },
    { id: 'speciaal-gereedschap', label: t('specialGereedschap'), icon: Wrench, permission: 'view_tools', module: 'module_special_tools' },
    { id: 'projecten', label: t('projecten'), icon: FolderOpen, permission: 'view_projects', module: null },
    { id: 'schademeldingen', label: t('schademeldingen'), icon: AlertTriangle, permission: 'view_damage_reports', module: 'module_damage_reports' },
    { id: 'ticket-omgeving', label: 'Ticket Omgeving', icon: Ticket, permission: 'create_tickets', module: null },
    { id: 'tickets-overzicht', label: 'Tickets Overzicht', icon: Ticket, permission: 'view_all_tickets', module: null },
    { id: 'gebruikers', label: t('gebruikers'), icon: Users, permission: 'manage_users', module: null },
    { id: 'meldingen', label: t('meldingen'), icon: Bell, permission: 'manage_notifications', module: 'module_notifications' },
    { id: 'email-notificaties', label: 'E-mail Notificaties', icon: Mail, permission: 'manage_settings', module: 'module_email_notifications' },
    { id: 'factuur-instellingen', label: 'Factuur Instellingen', icon: FileText, permission: 'manage_settings', module: 'module_invoicing' },
    { id: 'instellingen', label: t('instellingen'), icon: Settings, permission: 'view_dashboard', module: null },
  ];

  // Filter menu items based on user permissions AND module settings
  const menuItems = allMenuItems.filter(item => {
    const hasPerms = hasPermission(item.permission);
    const moduleEnabled = !item.module || !moduleSettings || moduleSettings[item.module] !== false;
    return hasPerms && moduleEnabled;
  });

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white shadow-lg border-r border-gray-200 h-screen flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src="/image copy copy.png" alt="GouweBouw" className="w-12 h-12 object-contain" />
              <h1 className="text-xl font-bold text-gray-800">GouweBouw</h1>
            </div>
            <button
              onClick={onClose}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Close menu"
            >
              <X size={20} className="text-gray-600" />
            </button>
          </div>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-md flex items-center space-x-3 transition-colors ${
                      isActive
                        ? 'bg-red-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon
                      size={18}
                      className={item.id === 'schademeldingen' ? 'text-yellow-400' : ''}
                    />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;