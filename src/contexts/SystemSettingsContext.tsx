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
  module_special_tools: boolean;
  csv_separator: ',' | ';';
}

interface SystemSettingsContextType {
  settings: SystemSettings | null;
  loading: boolean;
  isModuleEnabled: (module: keyof SystemSettings) => boolean;
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
          module_special_tools: data.module_special_tools,
          csv_separator: data.csv_separator || ';',
        });
      } else {
        // Default: alle modules aan
        setSettings({
          module_invoicing: true,
          module_hourly_rates: true,
          module_damage_reports: true,
          module_inventory: true,
          module_notifications: true,
          module_email_notifications: true,
          module_time_registration: true,
          module_special_tools: true,
          csv_separator: ';',
        });
      }
    } catch (error) {
      console.error('Error loading system settings:', error);
      // Default: alle modules aan bij error
      setSettings({
        module_invoicing: true,
        module_hourly_rates: true,
        module_damage_reports: true,
        module_inventory: true,
        module_notifications: true,
        module_email_notifications: true,
        module_time_registration: true,
        module_special_tools: true,
        csv_separator: ';',
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

  const refreshSettings = async () => {
    await loadSettings();
  };

  const getCsvSeparator = (): string => {
    return settings?.csv_separator || ';';
  };

  return (
    <SystemSettingsContext.Provider value={{ settings, loading, isModuleEnabled, refreshSettings, getCsvSeparator }}>
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
