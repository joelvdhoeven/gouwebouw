import React from 'react';
import { useState } from 'react';
import { Search, Package, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { RetourItem } from '../types';
import { formatDate } from '../utils/dateUtils';

const Retourboekingen: React.FC = () => {
  const { t } = useLanguage();
  const [retourItems, setRetourItems] = useLocalStorage<RetourItem[]>('retourItems', [
    {
      id: '1',
      naam: 'Boormachine Makita',
      artikelnummer: 'MAK-001',
      categorie: 'gereedschap',
      reden: 'Defect - motor draait niet meer',
      datum: '2024-01-15',
      status: 'in-behandeling',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      naam: 'Veiligheidshelm',
      artikelnummer: 'VH-003',
      categorie: 'veiligheid',
      reden: 'Beschadigd - barst in helm',
      datum: '2024-01-14',
      status: 'goedgekeurd',
      createdAt: new Date().toISOString(),
    },
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredItems = retourItems.filter(item =>
    item.naam.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.artikelnummer && item.artikelnummer.toLowerCase().includes(searchTerm.toLowerCase())) ||
    item.reden.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-3">
          <Package className="text-red-600" />
          <span>{t('retourboekingen')}</span>
        </h1>
        <button className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">
          <Plus size={16} />
          <span>{t('nieuw')}</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('zoekRetourItems')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>
      </div>

      {/* Retour Items Overview */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">{t('retourboekingOverzicht')}</h2>
          <p className="text-sm text-gray-600">{t('beheerRetouren')}</p>
        </div>
        <div className="p-6">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg">{t('geenRetouren')}</p>
              <p className="text-gray-400 text-sm mt-2">
                {t('voegRetourenToe')}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Naam</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artikelnummer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categorie</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reden</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.naam}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.artikelnummer || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.categorie}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {item.reden}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(item.datum)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          item.status === 'goedgekeurd' ? 'bg-green-100 text-green-800' :
                          item.status === 'afgekeurd' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.status === 'goedgekeurd' ? t('goedgekeurd') :
                           item.status === 'afgekeurd' ? t('afgekeurd') :
                           item.status === 'in-behandeling' ? t('inBehandeling') : item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Retourboekingen;