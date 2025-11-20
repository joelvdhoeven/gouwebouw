import React, { useState } from 'react';
import {
  Clock,
  Users,
  FolderOpen,
  Package,
  AlertTriangle,
  TrendingUp,
  Calendar,
  CheckCircle,
  Wrench,
  BarChart3,
  Activity,
  User,
  Eye,
  Filter,
  Sparkles,
  Target,
  Award,
  Zap,
  ChevronDown,
  ChevronUp,
  TrendingDown,
  Box
} from 'lucide-react';
import Modal from '../components/Modal';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabase';
import { formatDate } from '../utils/dateUtils';

interface UserProfile {
  id: string;
  naam: string;
  email: string;
  role: 'admin' | 'kantoorpersoneel' | 'medewerker' | 'zzper';
  created_at: string;
  updated_at: string;
}

const Dashboard: React.FC = () => {
  const { t } = useLanguage();
  const { user, hasPermission } = useAuth();
  const [selectedEmployeeForWeekView, setSelectedEmployeeForWeekView] = useState<any>(null);
  const [showWeeklyBreakdownModal, setShowWeeklyBreakdownModal] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('medewerker');
  const [showLowStockDetails, setShowLowStockDetails] = useState(false);

  const { data: allTimeRegistrations } = useSupabaseQuery<any>(
    'time_registrations',
    'id, user_id, project_id, datum, werktype, aantal_uren, werkomschrijving, project_naam, locatie, status, created_at, updated_at',
    {},
    { order: { column: 'created_at', ascending: false } }
  );
  const { data: userTimeRegistrations } = useSupabaseQuery<any>(
    'time_registrations',
    'id, user_id, project_id, datum, werktype, aantal_uren, werkomschrijving, project_naam, locatie, status, created_at, updated_at',
    hasPermission('view_reports') ? {} : { user_id: user?.id },
    { order: { column: 'created_at', ascending: false } }
  );
  const { data: projects } = useSupabaseQuery<any>('projects');
  const { data: inventoryProducts } = useSupabaseQuery<any>('inventory_products');
  const { data: inventoryStock } = useSupabaseQuery<any>('inventory_stock');
  const { data: specialTools } = useSupabaseQuery<any>('special_tools');
  const { data: damageReports } = useSupabaseQuery<any>('damage_reports');
  const { data: returnItems } = useSupabaseQuery<any>('return_items');
  const { data: userProfiles = [] } = useSupabaseQuery<UserProfile>('profiles');

  const timeRegistrations = hasPermission('view_reports') ? allTimeRegistrations : userTimeRegistrations;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const formatDateStr = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatDateStr(now);
  const startOfWeekStr = formatDateStr(startOfWeek);
  const startOfMonthStr = formatDateStr(startOfMonth);

  const hoursToday = timeRegistrations
    .filter(reg => reg.datum === todayStr)
    .reduce((sum, reg) => sum + reg.aantal_uren, 0);

  const hoursThisWeek = timeRegistrations
    .filter(reg => reg.datum >= startOfWeekStr)
    .reduce((sum, reg) => sum + reg.aantal_uren, 0);

  const hoursThisMonth = timeRegistrations
    .filter(reg => reg.datum >= startOfMonthStr)
    .reduce((sum, reg) => sum + reg.aantal_uren, 0);

  const activeProjects = projects.filter(p => p.status === 'actief');
  const completedProjects = projects.filter(p => p.status === 'voltooid');

  const workedProjects = hasPermission('view_reports')
    ? [...new Set(timeRegistrations.map(reg => reg.project_id).filter(Boolean))]
    : [...new Set(userTimeRegistrations.map(reg => reg.project_id).filter(Boolean))];

  // Combine inventory products with their stock levels
  const inventoryItems = inventoryProducts.map(product => {
    const totalStock = inventoryStock
      .filter(stock => stock.product_id === product.id)
      .reduce((sum, stock) => sum + parseFloat(stock.quantity || 0), 0);
    return {
      ...product,
      voorraad: totalStock,
      minimum_voorraad: product.minimum_stock,
      prijs: parseFloat(product.price || 0)
    };
  });

  const lowStockItems = inventoryItems.filter(item => item.voorraad <= item.minimum_voorraad);
  const totalInventoryValue = inventoryItems.reduce((sum, item) => sum + (item.prijs || 0) * item.voorraad, 0);

  const availableTools = specialTools.filter(tool => tool.status === 'beschikbaar');
  const toolsInMaintenance = specialTools.filter(tool => tool.status === 'onderhoud');

  const pendingDamageReports = damageReports.filter(report => report.status !== 'opgelost');
  const pendingReturns = returnItems.filter(item => item.status === 'in-behandeling');

  const isAdminOrOffice = hasPermission('view_reports');

  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const sevenDaysAgoStr = formatDateStr(sevenDaysAgo);

  const employeeActivity = isAdminOrOffice ? userProfiles
    .filter(profile => roleFilter === 'alle' || profile.role === roleFilter)
    .map(profile => {
      const recentRegistrations = allTimeRegistrations.filter(reg =>
        reg.user_id === profile.id && reg.datum >= sevenDaysAgoStr
      );

      const weekRegistrations = allTimeRegistrations.filter(reg =>
        reg.user_id === profile.id && reg.datum >= startOfWeekStr
      );
      const weekHours = weekRegistrations.reduce((sum, reg) => sum + reg.aantal_uren, 0);

      const totalHours = recentRegistrations.reduce((sum, reg) => sum + reg.aantal_uren, 0);
      const lastRegistration = recentRegistrations.length > 0
        ? recentRegistrations.sort((a, b) => b.datum.localeCompare(a.datum))[0].datum
        : null;

      return {
        ...profile,
        recentHours: totalHours,
        weekHours: weekHours,
        lastActivity: lastRegistration ? new Date(lastRegistration + 'T00:00:00') : null,
        hasRecentActivity: totalHours > 0,
        registrationCount: recentRegistrations.length
      };
    }).sort((a, b) => {
      if (!a.hasRecentActivity && b.hasRecentActivity) return 1;
      if (a.hasRecentActivity && !b.hasRecentActivity) return -1;
      return b.recentHours - a.recentHours;
    }) : [];

  const inactiveEmployees = employeeActivity.filter(emp => !emp.hasRecentActivity);

  const getWeeklyBreakdown = (userId: string) => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const days = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
    const breakdown = [];

    for (let i = 0; i < 7; i++) {
      const currentDay = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const year = currentDay.getFullYear();
      const month = String(currentDay.getMonth() + 1).padStart(2, '0');
      const day = String(currentDay.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayRegistrations = allTimeRegistrations.filter(
        reg => reg.user_id === userId && reg.datum === dateStr
      );

      const totalHours = dayRegistrations.reduce((sum, reg) => sum + reg.aantal_uren, 0);

      breakdown.push({
        day: days[i],
        date: dateStr,
        hours: totalHours,
        registrations: dayRegistrations
      });
    }

    return breakdown;
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            {t('dashboard')}
          </h1>
          <p className="text-gray-600 mt-1 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-red-500" />
            {t('welkomTerug')}, {user?.naam}
          </p>
        </div>
        <div className="text-right bg-gradient-to-br from-red-50 to-orange-50 px-6 py-3 rounded-xl border border-red-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('vandaag')}</p>
          <p className="text-lg font-bold text-gray-800 mt-1">
            {new Date().toLocaleDateString('nl-NL', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-red-600 transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">{t('urenVandaag')}</p>
              <p className="text-4xl font-bold text-gray-900">{hoursToday.toFixed(1)}</p>
              <p className="text-gray-500 text-xs mt-1">uur gewerkt</p>
            </div>
            <div className="bg-red-50 p-4 rounded-xl">
              <Clock className="h-10 w-10 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-red-600 transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">{t('urenDezeWeek')}</p>
              <p className="text-4xl font-bold text-gray-900">{hoursThisWeek.toFixed(1)}</p>
              <p className="text-gray-500 text-xs mt-1">uur deze week</p>
            </div>
            <div className="bg-red-50 p-4 rounded-xl">
              <Calendar className="h-10 w-10 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-red-600 transform hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium mb-1">{t('urenDezeMaand')}</p>
              <p className="text-4xl font-bold text-gray-900">{hoursThisMonth.toFixed(1)}</p>
              <p className="text-gray-500 text-xs mt-1">uur deze maand</p>
            </div>
            <div className="bg-red-50 p-4 rounded-xl">
              <BarChart3 className="h-10 w-10 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="bg-red-50 p-3 rounded-lg">
              <FolderOpen className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">
                {isAdminOrOffice ? t('actieveProjecten') : t('projectenGewerkt')}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {isAdminOrOffice ? activeProjects.length : workedProjects.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="bg-red-50 p-3 rounded-lg">
              <CheckCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">
                {isAdminOrOffice ? t('voltooideProjecten') : t('totaalUren')}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {isAdminOrOffice ? completedProjects.length : timeRegistrations.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="bg-red-50 p-3 rounded-lg">
              <Activity className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">
                {isAdminOrOffice ? t('totaalRegistraties') : t('mijnRegistraties')}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {timeRegistrations.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="bg-red-50 p-3 rounded-lg">
              <TrendingUp className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{t('gemiddeldPerDag')}</p>
              <p className="text-2xl font-bold text-gray-900">
                {timeRegistrations.length > 0
                  ? (timeRegistrations.reduce((sum, reg) => sum + reg.aantal_uren, 0) /
                     [...new Set(timeRegistrations.map(reg => reg.datum))].length).toFixed(1)
                  : '0.0'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {isAdminOrOffice && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 p-2 rounded-lg">
                  <Users className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{t('medewerkerActiviteitOverzicht')}</h3>
                  <p className="text-sm text-gray-600">Activiteit van de afgelopen 7 dagen</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 text-sm border-r pr-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-red-500" />
                    <span className="text-gray-700 font-medium">Actief: {employeeActivity.length - inactiveEmployees.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-gray-700 font-medium">Inactief: {inactiveEmployees.length}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
                  <Filter className="h-4 w-4 text-gray-500" />
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="text-sm font-medium text-gray-700 bg-transparent border-none outline-none cursor-pointer"
                  >
                    <option value="medewerker">Medewerkers</option>
                    <option value="zzper">ZZP'ers</option>
                    <option value="admin">Admins</option>
                    <option value="kantoorpersoneel">Kantoorpersoneel</option>
                    <option value="alle">Alle rollen</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="p-6">
            {employeeActivity.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">Geen medewerkers gevonden voor dit filter</p>
                <p className="text-sm text-gray-400 mt-1">Selecteer een ander filter om resultaten te zien</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Medewerker
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Functie
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Deze Week
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Registraties
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Laatste Activiteit
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {employeeActivity.map((employee) => (
                      <tr key={employee.id} className={`hover:bg-gray-50 transition-colors ${!employee.hasRecentActivity ? 'bg-red-25' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                              employee.hasRecentActivity
                                ? 'bg-gradient-to-br from-red-500 to-red-600 text-white'
                                : 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'
                            }`}>
                              {employee.naam.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{employee.naam}</div>
                              <div className="text-xs text-gray-500">{employee.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-full ${
                            employee.role === 'admin' ? 'bg-red-100 text-red-700' :
                            employee.role === 'kantoorpersoneel' ? 'bg-blue-100 text-blue-700' :
                            employee.role === 'medewerker' ? 'bg-green-100 text-green-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {employee.role === 'admin' ? '👑 Admin' :
                             employee.role === 'kantoorpersoneel' ? '💼 Kantoor' :
                             employee.role === 'medewerker' ? '🔧 Medewerker' :
                             '⚡ ZZP\'er'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span className={`font-bold ${employee.weekHours === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                {employee.weekHours.toFixed(1)}h
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedEmployeeForWeekView(employee);
                                setShowWeeklyBreakdownModal(true);
                              }}
                              className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-lg transition-colors"
                              title="Bekijk dagspecificatie"
                            >
                              <Eye size={16} />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-700">
                            <Target className="h-4 w-4 text-gray-400" />
                            {employee.registrationCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {employee.lastActivity ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-gray-700 font-medium">{formatDate(employee.lastActivity)}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Geen activiteit</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {employee.hasRecentActivity ? (
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-200">
                              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                              Actief
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-200">
                              <AlertTriangle className="h-3 w-3" />
                              Inactief
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {isAdminOrOffice && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="bg-red-50 p-3 rounded-lg">
                  <Package className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Lage Voorraad</p>
                  <p className="text-2xl font-bold text-gray-900">{lowStockItems.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="bg-red-50 p-3 rounded-lg">
                  <Wrench className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Beschikbare Tools</p>
                  <p className="text-2xl font-bold text-gray-900">{availableTools.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="bg-red-50 p-3 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Schademeldingen</p>
                  <p className="text-2xl font-bold text-gray-900">{pendingDamageReports.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4">
                <div className="bg-red-50 p-3 rounded-lg">
                  <Award className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 font-medium">Retourboekingen</p>
                  <p className="text-2xl font-bold text-gray-900">{pendingReturns.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
            <div className="px-8 py-6 border-b border-gray-100 bg-gradient-to-r from-red-50 to-white">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Package className="h-6 w-6 text-red-600" />
                Magazijn Overzicht
              </h3>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-xl p-6 border-2 border-red-600">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-red-100 p-2 rounded-lg">
                      <Package className="h-5 w-5 text-red-600" />
                    </div>
                    <p className="text-sm text-gray-600 font-semibold">Totale Waarde</p>
                  </div>
                  <p className="text-3xl font-bold text-red-600">€{totalInventoryValue.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl p-6 border-2 border-red-600">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-red-100 p-2 rounded-lg">
                      <Box className="h-5 w-5 text-red-600" />
                    </div>
                    <p className="text-sm text-gray-600 font-semibold">Totaal Items</p>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{inventoryItems.length}</p>
                </div>
                <div className="bg-white rounded-xl p-6 border-2 border-red-600">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-red-100 p-2 rounded-lg">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    </div>
                    <p className="text-sm text-gray-600 font-semibold">Lage Voorraad</p>
                  </div>
                  <p className="text-3xl font-bold text-orange-600">{lowStockItems.length}</p>
                </div>
                <div className="bg-white rounded-xl p-6 border-2 border-red-600">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-red-100 p-2 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <p className="text-sm text-gray-600 font-semibold">Op Voorraad</p>
                  </div>
                  <p className="text-3xl font-bold text-green-600">{inventoryItems.length - lowStockItems.length}</p>
                </div>
              </div>

              {lowStockItems.length > 0 && (
                <div className="bg-red-50 rounded-xl border border-red-200">
                  <button
                    onClick={() => setShowLowStockDetails(!showLowStockDetails)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-red-100 transition-colors rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-red-200 p-2 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-700" />
                      </div>
                      <div className="text-left">
                        <h4 className="font-bold text-gray-800">Low Stock Alerts</h4>
                        <p className="text-sm text-gray-600">{lowStockItems.length} items onder minimum voorraad</p>
                      </div>
                    </div>
                    {showLowStockDetails ? (
                      <ChevronUp className="h-5 w-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-600" />
                    )}
                  </button>

                  {showLowStockDetails && (
                    <div className="px-6 pb-6">
                      <div className="bg-white rounded-lg border border-red-200 overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                Product
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                Huidige Voorraad
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                Minimum
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                Waarde
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {lowStockItems.slice(0, 10).map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-gray-400" />
                                    <div>
                                      <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                                      <div className="text-xs text-gray-500">{item.category || 'Algemeen'}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-sm font-bold text-red-600">{Math.floor(item.voorraad)} {item.unit}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-sm text-gray-700">{item.minimum_voorraad} {item.unit}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                    Kritiek
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                                  €{((item.prijs || 0) * item.voorraad).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {lowStockItems.length > 10 && (
                          <div className="bg-gray-50 px-4 py-3 border-t border-gray-200 text-center">
                            <p className="text-sm text-gray-600">
                              En nog {lowStockItems.length - 10} items meer...
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {lowStockItems.length === 0 && (
                <div className="bg-green-50 rounded-xl border border-green-200 p-6 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <h4 className="font-bold text-gray-800 mb-1">Alle voorraad op peil!</h4>
                  <p className="text-sm text-gray-600">Er zijn geen items met lage voorraad</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-red-50 to-white">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Activity className="h-5 w-5 text-red-600" />
              {isAdminOrOffice ? 'Recente Registraties' : 'Mijn Recente Registraties'}
            </h3>
          </div>
          <div className="p-6">
            {timeRegistrations.slice(0, 5).length > 0 ? (
              <div className="space-y-3">
                {timeRegistrations.slice(0, 5).map((reg) => (
                  <div key={reg.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">
                        {projects.find(p => p.id === reg.project_id)?.naam || 'Geen project'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        {formatDate(reg.datum)} • {reg.werktype}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">{reg.aantal_uren}h</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">Geen recente registraties</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              {isAdminOrOffice ? 'Aandachtspunten' : 'Actieve Projecten'}
            </h3>
          </div>
          <div className="p-6">
            {isAdminOrOffice ? (
              <div className="space-y-3">
                {inactiveEmployees.length > 0 && (
                  <div className="flex items-center gap-4 p-4 bg-red-50 rounded-xl border border-red-100">
                    <div className="bg-red-100 p-3 rounded-lg">
                      <Users className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-red-800">Inactieve medewerkers</p>
                      <p className="text-xs text-red-600 mt-0.5">{inactiveEmployees.length} medewerkers zonder recente uren</p>
                    </div>
                  </div>
                )}
                {lowStockItems.length > 0 && (
                  <div className="flex items-center gap-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <div className="bg-orange-100 p-3 rounded-lg">
                      <Package className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-orange-800">Lage voorraad</p>
                      <p className="text-xs text-orange-600 mt-0.5">{lowStockItems.length} items bijbestellen</p>
                    </div>
                  </div>
                )}
                {toolsInMaintenance.length > 0 && (
                  <div className="flex items-center gap-4 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                    <div className="bg-yellow-100 p-3 rounded-lg">
                      <Wrench className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-yellow-800">Tools in onderhoud</p>
                      <p className="text-xs text-yellow-600 mt-0.5">{toolsInMaintenance.length} tools niet beschikbaar</p>
                    </div>
                  </div>
                )}
                {pendingDamageReports.length > 0 && (
                  <div className="flex items-center gap-4 p-4 bg-red-50 rounded-xl border border-red-100">
                    <div className="bg-red-100 p-3 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-red-800">Openstaande schademeldingen</p>
                      <p className="text-xs text-red-600 mt-0.5">{pendingDamageReports.length} meldingen te behandelen</p>
                    </div>
                  </div>
                )}
                {inactiveEmployees.length === 0 && lowStockItems.length === 0 && toolsInMaintenance.length === 0 &&
                 pendingDamageReports.length === 0 && (
                  <div className="text-center py-12">
                    <CheckCircle className="mx-auto h-12 w-12 text-red-400 mb-3" />
                    <p className="text-gray-500 font-medium">Geen aandachtspunten</p>
                    <p className="text-sm text-gray-400 mt-1">Alles loopt soepel!</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {workedProjects.slice(0, 5).map((projectId) => {
                  const project = projects.find(p => p.id === projectId);
                  if (!project) return null;

                  const projectHours = userTimeRegistrations
                    .filter(reg => reg.project_id === projectId)
                    .reduce((sum, reg) => sum + reg.aantal_uren, 0);

                  return (
                    <div key={projectId} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">{project.naam}</p>
                        <p className="text-xs text-gray-500 mt-1">{project.locatie}</p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <p className="text-lg font-bold text-gray-900">{projectHours}h</p>
                        <span className={`inline-flex px-3 py-1 text-xs font-bold rounded-full ${
                          project.status === 'actief' ? 'bg-red-100 text-red-700' :
                          project.status === 'voltooid' ? 'bg-gray-100 text-gray-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {project.status === 'actief' ? 'Actief' :
                           project.status === 'voltooid' ? 'Voltooid' : 'Gepauzeerd'}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {workedProjects.length === 0 && (
                  <div className="text-center py-12">
                    <FolderOpen className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">Nog geen projecten gewerkt</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedEmployeeForWeekView && (
        <Modal
          isOpen={showWeeklyBreakdownModal}
          onClose={() => {
            setShowWeeklyBreakdownModal(false);
            setSelectedEmployeeForWeekView(null);
          }}
          title={`Weekoverzicht - ${selectedEmployeeForWeekView.naam}`}
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 bg-red-50 p-3 rounded-lg">
              📅 Uren per dag voor de huidige week (Maandag t/m Zondag)
            </p>
            <div className="space-y-2">
              {getWeeklyBreakdown(selectedEmployeeForWeekView.id).map((day) => (
                <div
                  key={day.date}
                  className={`flex justify-between items-center p-4 rounded-xl transition-all ${
                    day.hours > 0
                      ? 'bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200'
                      : 'bg-gray-50 border-2 border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      day.hours > 0 ? 'bg-red-500 text-white' : 'bg-gray-300 text-gray-600'
                    }`}>
                      {day.day.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-gray-800">{day.day}</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {day.date.split('-')[2]} {['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'][parseInt(day.date.split('-')[1]) - 1]}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className={`h-5 w-5 ${day.hours > 0 ? 'text-red-600' : 'text-gray-400'}`} />
                    <span className={`text-xl font-bold ${day.hours > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                      {day.hours.toFixed(1)}h
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t-2 border-gray-200">
              <div className="flex justify-between items-center bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-xl">
                <span className="font-bold text-gray-800 text-lg">Totaal deze week:</span>
                <span className="text-3xl font-bold text-red-600">
                  {selectedEmployeeForWeekView.weekHours.toFixed(1)}h
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Dashboard;
