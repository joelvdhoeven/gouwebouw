import React, { useState, useEffect } from 'react';
import { FileText, Save, Building2, Mail, Phone, Globe, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface InvoiceSettings {
  id: string;
  company_name: string;
  kvk_number: string;
  btw_number: string;
  iban: string;
  address_street: string;
  address_zip: string;
  address_city: string;
  phone: string;
  email: string;
  website: string;
  invoice_prefix: string;
  invoice_footer: string;
  payment_terms_days: number;
  logo_url: string;
}

const FactuurInstellingen: React.FC = () => {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const canManage = profile?.role === 'admin' || profile?.role === 'kantoorpersoneel';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('invoice_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading invoice settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings || !canManage) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('invoice_settings')
        .upsert({
          ...settings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setSuccessMessage('Instellingen succesvol opgeslagen!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Fout bij het opslaan van instellingen');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof InvoiceSettings, value: string | number) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Je hebt geen toegang tot deze pagina.</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Geen instellingen gevonden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={28} className="text-red-600" />
            Factuur Instellingen
          </h1>
          <p className="text-gray-600">Beheer bedrijfsgegevens en factuur opmaak</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-2 disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? 'Opslaan...' : 'Opslaan'}
        </button>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bedrijfsgegevens */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 size={20} className="text-red-600" />
            Bedrijfsgegevens
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bedrijfsnaam *
              </label>
              <input
                type="text"
                value={settings.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  KVK Nummer
                </label>
                <input
                  type="text"
                  value={settings.kvk_number}
                  onChange={(e) => handleChange('kvk_number', e.target.value)}
                  placeholder="12345678"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  BTW Nummer
                </label>
                <input
                  type="text"
                  value={settings.btw_number}
                  onChange={(e) => handleChange('btw_number', e.target.value)}
                  placeholder="NL123456789B01"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <CreditCard className="inline mr-1" size={14} />
                IBAN
              </label>
              <input
                type="text"
                value={settings.iban}
                onChange={(e) => handleChange('iban', e.target.value)}
                placeholder="NL00ABCD0123456789"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Straat en huisnummer
              </label>
              <input
                type="text"
                value={settings.address_street}
                onChange={(e) => handleChange('address_street', e.target.value)}
                placeholder="Straatnaam 123"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Postcode
                </label>
                <input
                  type="text"
                  value={settings.address_zip}
                  onChange={(e) => handleChange('address_zip', e.target.value)}
                  placeholder="1234 AB"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plaats
                </label>
                <input
                  type="text"
                  value={settings.address_city}
                  onChange={(e) => handleChange('address_city', e.target.value)}
                  placeholder="Amsterdam"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contactgegevens */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Contactgegevens
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="inline mr-1" size={14} />
                Telefoonnummer
              </label>
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+31 6 12345678"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="inline mr-1" size={14} />
                E-mailadres
              </label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="info@gouwebouw.nl"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Globe className="inline mr-1" size={14} />
                Website
              </label>
              <input
                type="text"
                value={settings.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="www.gouwebouw.nl"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logo URL
              </label>
              <input
                type="text"
                value={settings.logo_url}
                onChange={(e) => handleChange('logo_url', e.target.value)}
                placeholder="/gouwebouw-logo.svg"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Relatief pad naar logo bestand (bijv. /gouwebouw-logo.svg)
              </p>
            </div>
          </div>
        </div>

        {/* Factuur Opmaak */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Factuur Opmaak
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Factuur Prefix
              </label>
              <input
                type="text"
                value={settings.invoice_prefix}
                onChange={(e) => handleChange('invoice_prefix', e.target.value)}
                placeholder="FACT"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Prefix voor factuurnummers (bijv. FACT-2025-001)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Betalingstermijn (dagen)
              </label>
              <input
                type="number"
                value={settings.payment_terms_days}
                onChange={(e) => handleChange('payment_terms_days', parseInt(e.target.value) || 30)}
                min="1"
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Footer Tekst
              </label>
              <textarea
                value={settings.invoice_footer}
                onChange={(e) => handleChange('invoice_footer', e.target.value)}
                rows={3}
                placeholder="Betaling binnen 30 dagen..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Voorbeeld Factuur
          </h2>
          <div className="border border-gray-200 rounded-lg p-4 space-y-3 text-sm">
            <div className="flex justify-between items-start">
              <div>
                {settings.logo_url && (
                  <div className="text-xs text-gray-500 mb-2">[Logo]</div>
                )}
                <div className="font-bold text-lg">{settings.company_name}</div>
                <div className="text-gray-600 text-xs space-y-1 mt-2">
                  {settings.address_street && <div>{settings.address_street}</div>}
                  {(settings.address_zip || settings.address_city) && (
                    <div>{settings.address_zip} {settings.address_city}</div>
                  )}
                  {settings.phone && <div>Tel: {settings.phone}</div>}
                  {settings.email && <div>Email: {settings.email}</div>}
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="font-bold text-base">FACTUUR</div>
                <div className="mt-2 space-y-1">
                  <div>Nr: {settings.invoice_prefix}-2025-001</div>
                  <div>Datum: {new Date().toLocaleDateString('nl-NL')}</div>
                </div>
              </div>
            </div>

            <div className="border-t pt-3 mt-3">
              <div className="text-xs text-gray-600 space-y-1">
                {settings.kvk_number && <div>KVK: {settings.kvk_number}</div>}
                {settings.btw_number && <div>BTW: {settings.btw_number}</div>}
                {settings.iban && <div>IBAN: {settings.iban}</div>}
              </div>
            </div>

            <div className="border-t pt-3 mt-3 text-xs text-gray-500">
              {settings.invoice_footer}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FactuurInstellingen;
