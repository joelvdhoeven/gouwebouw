import React from 'react';
import { Package, Clock } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const MagazijnVoorraad: React.FC = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Package className="h-16 w-16 text-gray-400" />
              <div className="absolute -top-1 -right-1 bg-yellow-500 rounded-full p-1">
                <Clock className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            {t('magazijnVoorraad')}
          </h1>
          
          <div className="inline-flex items-center px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium mb-4">
            <Clock className="h-4 w-4 mr-2" />
            {t('comingSoon')}
          </div>
          
          <p className="text-gray-600 mb-6">
            {t('comingSoonMessage')}
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Geplande functies:
            </h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Voorraad beheer</li>
              <li>• Barcode scanning</li>
              <li>• Automatische bestellingen</li>
              <li>• Rapportages</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MagazijnVoorraad;