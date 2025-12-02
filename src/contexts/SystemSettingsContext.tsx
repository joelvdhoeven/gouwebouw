import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface SystemSettings {
  module_invoicing: boolean;
  module_hourly_rates: boolean;
  module_damage_reports: boolean;
  module_inventory: boolean;
  module_notifications: boolean;
  module_email_notifications: boolean;
  module_time_registration: boolean;
  module_time_registration_v2: boolean;
  module_special_tools: boolean;
  module_financial_dashboard: boolean;
  csv_separator: ',' | ';';
  // Demo mode fields - when true, module only visible to admins
  module_invoicing_demo: boolean;
  module_hourly_rates_demo: boolean;
  module_damage_reports_demo: boolean;
  module_inventory_demo: boolean;
  module_notifications_demo: boolean;
  module_email_notifications_demo: boolean;
  module_time_registration_demo: boolean;
  module_time_registration_v2_demo: boolean;
  module_special_tools_demo: boolean;
  module_financial_dashboard_demo: boolean;
}

interface SystemSettingsContextType {
  settings: SystemSettings | null;
  loading: boolean;
  isModuleEnabled: (module: keyof SystemSettings) => boolean;
  isModuleVisible: (module: string, userRole?: string) => boolean;
  refreshSettings: () => Promise<void>;
  getCsvSeparator: () => string;
}

const SystemSettingsContext = createContext<SystemSettingsContextType | undefined>(undefined);

export const SystemSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          module_invoicing: data.module_invoicing,
          module_hourly_rates: data.module_hourly_rates,
          module_damage_reports: data.module_damage_reports,
          module_inventory: data.module_inventory,
          module_notifications: data.module_notifications,
          module_email_notifications: data.module_email_notifications,
          module_time_registration: data.module_time_registration,
          module_time_registration_v2: data.module_time_registration_v2 ?? false,
          module_special_tools: data.module_special_tools,
          module_financial_dashboard: data.module_financial_dashboard,
          csv_separator: data.csv_separator || ';',
          module_invoicing_demo: data.module_invoicing_demo || false,
          module_hourly_rates_demo: data.module_hourly_rates_demo || false,
          module_damage_reports_demo: data.module_damage_reports_demo || false,
          module_inventory_demo: data.module_inventory_demo || false,
          module_notifications_demo: data.module_notifications_demo || false,
          module_email_notifications_demo: data.module_email_notifications_demo || false,
          module_time_registration_demo: data.module_time_registration_demo || false,
          module_time_registration_v2_demo: data.module_time_registration_v2_demo ?? false,
          module_special_tools_demo: data.module_special_tools_demo || false,
          module_financial_dashboard_demo: data.module_financial_dashboard_demo || false,
        });
      } else {
        // Default: alle modules aan, demo mode uit
        setSettings({
          module_invoicing: true,
          module_hourly_rates: true,
          module_damage_reports: true,
          module_inventory: true,
          module_notifications: true,
          module_email_notifications: true,
          module_time_registration: true,
          module_time_registration_v2: false,
          module_special_tools: true,
          module_financial_dashboard: true,
          csv_separator: ';',
          module_invoicing_demo: false,
          module_hourly_rates_demo: false,
          module_damage_reports_demo: false,
          module_inventory_demo: false,
          module_notifications_demo: false,
          module_email_notifications_demo: false,
          module_time_registration_demo: false,
          module_time_registration_v2_demo: false,
          module_special_tools_demo: false,
          module_financial_dashboard_demo: false,
        });
      }
    } catch (error) {
      console.error('Error loading system settings:', error);
      // Default: alle modules aan bij error, demo mode uit
      setSettings({
        module_invoicing: true,
        module_hourly_rates: true,
        module_damage_reports: true,
        module_inventory: true,
        module_notifications: true,
        module_email_notifications: true,
        module_time_registration: true,
        module_time_registration_v2: false,
        module_special_tools: true,
        module_financial_dashboard: true,
        csv_separator: ';',
        module_invoicing_demo: false,
        module_hourly_rates_demo: false,
        module_damage_reports_demo: false,
        module_inventory_demo: false,
        module_notifications_demo: false,
        module_email_notifications_demo: false,
        module_time_registration_demo: false,
        module_time_registration_v2_demo: false,
        module_special_tools_demo: false,
        module_financial_dashboard_demo: false,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();

    // Subscribe to changes
    const subscription = supabase
      .channel('system_settings_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'system_settings'
      }, () => {
        loadSettings();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isModuleEnabled = (module: keyof SystemSettings): boolean => {
    if (!settings) return true; // Default aan als settings nog niet geladen
    return settings[module];
  };

  /**
   * Check if a module is visible to the current user
   * @param module - Module name (e.g., 'time_registration', 'inventory')
   * @param userRole - User role ('admin', 'superuser', 'medewerker', etc.)
   * @returns true if module should be visible, false otherwise
   *
   * Logic:
   * - If DEMO MODE is ON: only admin/superuser can see it (regardless of enabled state)
   * - If DEMO MODE is OFF: everyone can see it (but only if module is enabled)
   */
  const isModuleVisible = (module: string, userRole?: string): boolean => {
    if (!settings) return true; // Default: visible if settings not loaded

    const moduleKey = `module_${module}` as keyof SystemSettings;
    const demoKey = `module_${module}_demo` as keyof SystemSettings;

    const isEnabled = settings[moduleKey];
    const isDemoMode = settings[demoKey];

    console.log(`[isModuleVisible] Module: ${module}, UserRole: ${userRole}`);
    console.log(`[isModuleVisible] IsEnabled: ${isEnabled}, IsDemoMode: ${isDemoMode}`);

    // DEMO MODE LOGIC: If demo mode is ON, only admin/superuser can see it
    if (isDemoMode) {
      const isAdminOrSuperuser = userRole === 'admin' || userRole === 'superuser';
      console.log(`[isModuleVisible] DEMO MODE ON - Only visible to admin/superuser: ${isAdminOrSuperuser}`);
      return isAdminOrSuperuser;
    }

    // NORMAL MODE LOGIC: If demo mode is OFF, check if module is enabled
    if (!isEnabled) {
      console.log(`[isModuleVisible] DEMO MODE OFF but module DISABLED - returning false`);
      return false;
    }

    console.log(`[isModuleVisible] DEMO MODE OFF and module ENABLED - returning true`);
    return true;
  };

  const refreshSettings = async () => {
    await loadSettings();
  };

  const getCsvSeparator = (): string => {
    return settings?.csv_separator || ';';
  };

  return (
    <SystemSettingsContext.Provider value={{ settings, loading, isModuleEnabled, isModuleVisible, refreshSettings, getCsvSeparator }}>
      {children}
    </SystemSettingsContext.Provider>
  );
};

export const useSystemSettings = () => {
  const context = useContext(SystemSettingsContext);
  if (context === undefined) {
    throw new Error('useSystemSettings must be used within a SystemSettingsProvider');
  }
  return context;
};
