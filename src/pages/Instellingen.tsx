import React, { useState, useEffect } from 'react';
import { User, Lock, Settings as SettingsIcon, Save, Eye, EyeOff, Package } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

const Instellingen: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('profiel');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [profileData, setProfileData] = useState({
    naam: user?.naam || '',
    email: user?.email || '',
  });

  // Update profile data when user loads
  React.useEffect(() => {
    if (user) {
      setProfileData({
        naam: user.naam || '',
        email: user.email || '',
      });
    }
  }, [user]);

  if (!user) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [moduleSettings, setModuleSettings] = useState<{
    module_invoicing: boolean;
    module_hourly_rates: boolean;
    module_damage_reports: boolean;
    module_inventory: boolean;
    module_notifications: boolean;
    module_email_notifications: boolean;
    module_time_registration: boolean;
    module_special_tools: boolean;
    module_financial_dashboard: boolean;
    csv_separator: ',' | ';';
  }>({
    module_invoicing: true,
    module_hourly_rates: true,
    module_damage_reports: true,
    module_inventory: true,
    module_notifications: true,
    module_email_notifications: true,
    module_time_registration: true,
    module_special_tools: true,
    module_financial_dashboard: true,
    csv_separator: ';',
  });

  useEffect(() => {
    if (activeTab === 'systeem') {
      loadModuleSettings();
    }
  }, [activeTab]);

  const loadModuleSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Ensure csv_separator is a valid value
        const csvSeparator = data.csv_separator === ',' || data.csv_separator === ';'
          ? data.csv_separator
          : ';';

        setModuleSettings({
          module_invoicing: data.module_invoicing,
          module_hourly_rates: data.module_hourly_rates,
          module_damage_reports: data.module_damage_reports,
          module_inventory: data.module_inventory,
          module_notifications: data.module_notifications,
          module_email_notifications: data.module_email_notifications,
          module_time_registration: data.module_time_registration,
          module_special_tools: data.module_special_tools,
          module_financial_dashboard: data.module_financial_dashboard,
          csv_separator: csvSeparator,
        });
      }
    } catch (error) {
      console.error('Error loading module settings:', error);
    }
  };

  const saveModuleSettings = async () => {
    try {
      console.log('Saving module settings:', moduleSettings);

      const { data, error } = await supabase
        .from('system_settings')
        .update({
          ...moduleSettings,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .select();

      if (error) {
        console.error('Supabase request failed', error);
        throw error;
      }

      console.log('Settings saved successfully:', data);
      setSuccessMessage('Module instellingen opgeslagen!');
      setTimeout(() => setSuccessMessage(''), 3000);

      // Reload de pagina om menu items te updaten
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error saving module settings:', error);
      setErrorMessage('Fout bij het opslaan van instellingen');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ naam: profileData.naam })
        .eq('id', user?.id);

      if (error) throw error;

      setSuccessMessage(t('profielBijgewerkt'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrorMessage(t('foutOpgetreden'));
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrorMessage(t('wachtwoordenKomenNietOvereen'));
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setErrorMessage(t('wachtwoordMinimaal6'));
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      setSuccessMessage(t('wachtwoordGewijzigd'));
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error changing password:', error);
      setErrorMessage(t('foutOpgetreden'));
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {errorMessage}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">{t('instellingen')}</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('profiel')}
            className={`${
              activeTab === 'profiel'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
          >
            <User size={18} />
            <span>{t('profiel')}</span>
          </button>
          <button
            onClick={() => setActiveTab('beveiliging')}
            className={`${
              activeTab === 'beveiliging'
                ? 'border-red-600 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
          >
            <Lock size={18} />
            <span>{t('beveiliging')}</span>
          </button>
          {hasPermission('manage_settings') && (
            <button
              onClick={() => setActiveTab('systeem')}
              className={`${
                activeTab === 'systeem'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
            >
              <SettingsIcon size={18} />
              <span>{t('systeeminstellingen')}</span>
            </button>
          )}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profiel' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('profielInformatie')}</h2>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('naam')}</label>
              <input
                type="text"
                value={profileData.naam}
                onChange={(e) => setProfileData({ ...profileData, naam: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={profileData.email}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
              />
              <p className="text-sm text-gray-500 mt-1">{t('emailKanNietWordenGewijzigd')}</p>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <Save size={16} />
                <span>{t('opslaan')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'beveiliging' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('wachtwoordWijzigen')}</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('huidigWachtwoord')}</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('nieuwWachtwoord')}</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('bevestigNieuwWachtwoord')}</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <Save size={16} />
                <span>{t('wachtwoordWijzigen')}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* System Settings Tab (Admin only) */}
      {activeTab === 'systeem' && hasPermission('manage_settings') && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package size={20} className="text-red-600" />
              <h2 className="text-lg font-semibold text-gray-800">Module Beheer</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Schakel modules in of uit. Uitgeschakelde modules worden verborgen in de navigatie en zijn niet toegankelijk.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">Financieel Dashboard</p>
                  <p className="text-sm text-gray-500">Inzicht in omzet, kosten, winst en statistieken</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moduleSettings.module_financial_dashboard}
                    onChange={(e) => setModuleSettings({ ...moduleSettings, module_financial_dashboard: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">Urenregistratie</p>
                  <p className="text-sm text-gray-500">Registreer gewerkte uren op projecten</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moduleSettings.module_time_registration}
                    onChange={(e) => setModuleSettings({ ...moduleSettings, module_time_registration: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">Voorraadbeheer</p>
                  <p className="text-sm text-gray-500">Beheer voorraad en boek materiaal af</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moduleSettings.module_inventory}
                    onChange={(e) => setModuleSettings({ ...moduleSettings, module_inventory: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">Schademeldingen</p>
                  <p className="text-sm text-gray-500">Registreer en beheer schademeldingen</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moduleSettings.module_damage_reports}
                    onChange={(e) => setModuleSettings({ ...moduleSettings, module_damage_reports: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">Speciaal Gereedschap</p>
                  <p className="text-sm text-gray-500">Beheer speciaal gereedschap en onderhoud</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moduleSettings.module_special_tools}
                    onChange={(e) => setModuleSettings({ ...moduleSettings, module_special_tools: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">Factuur Generatie</p>
                  <p className="text-sm text-gray-500">Genereer facturen vanuit projecten</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moduleSettings.module_invoicing}
                    onChange={(e) => setModuleSettings({ ...moduleSettings, module_invoicing: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">Uurtarieven Instellingen</p>
                  <p className="text-sm text-gray-500">Beheer uurtarieven voor medewerkers</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moduleSettings.module_hourly_rates}
                    onChange={(e) => setModuleSettings({ ...moduleSettings, module_hourly_rates: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">Meldingen</p>
                  <p className="text-sm text-gray-500">Systeem meldingen en beheer</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moduleSettings.module_notifications}
                    onChange={(e) => setModuleSettings({ ...moduleSettings, module_notifications: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">E-mail Notificaties</p>
                  <p className="text-sm text-gray-500">Automatische e-mail notificaties</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={moduleSettings.module_email_notifications}
                    onChange={(e) => setModuleSettings({ ...moduleSettings, module_email_notifications: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center gap-2 mb-4">
              <SettingsIcon size={20} className="text-red-600" />
              <h2 className="text-lg font-semibold text-gray-800">CSV Export/Import Instellingen</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Kies het scheidingsteken voor CSV bestanden. Puntkomma (;) werkt het beste voor Excel in Europa.
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-800">CSV Scheidingsteken</p>
                  <p className="text-sm text-gray-500">
                    {moduleSettings.csv_separator === ';'
                      ? 'Puntkomma (;) - Aanbevolen voor Excel'
                      : 'Komma (,) - Standaard CSV format'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setModuleSettings({ ...moduleSettings, csv_separator: ';' })}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      moduleSettings.csv_separator === ';'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Puntkomma (;)
                  </button>
                  <button
                    onClick={() => setModuleSettings({ ...moduleSettings, csv_separator: ',' })}
                    className={`px-4 py-2 rounded-md transition-colors ${
                      moduleSettings.csv_separator === ','
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Komma (,)
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={saveModuleSettings}
              className="flex items-center space-x-2 px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              <Save size={16} />
              <span>Instellingen Opslaan</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Instellingen;
