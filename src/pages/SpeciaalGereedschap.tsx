import React, { useState } from 'react';
import { Search, Plus, Wrench, CreditCard as Edit, Trash2, Calendar, MapPin, Camera } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { nl } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { SpeciaalGereedschap, Project } from '../types';
import { formatDate } from '../utils/dateUtils';
import Modal from '../components/Modal';

const SpeciaalGereedschapPage: React.FC = () => {
  const { t } = useLanguage();
  const [gereedschappen, setGereedschappen] = useLocalStorage<SpeciaalGereedschap[]>('speciaalGereedschap', [
    {
      id: '1',
      naam: 'Hijskraan 50 ton',
      beschrijving: 'Mobiele hijskraan voor zware constructiewerken',
      status: 'beschikbaar',
      locatie: 'Hoofddepot',
      laatsteOnderhoud: '2024-01-10',
      volgendeOnderhoud: '2024-04-10',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      naam: 'Betonmixer 500L',
      beschrijving: 'Professionele betonmixer voor grote projecten',
      status: 'in-gebruik',
      locatie: 'Project Amsterdam',
      projectId: '1',
      laatsteOnderhoud: '2024-01-05',
      volgendeOnderhoud: '2024-03-05',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      naam: 'Lasapparaat TIG 300A',
      beschrijving: 'Professioneel TIG lasapparaat voor precisiewerk',
      status: 'onderhoud',
      locatie: 'Werkplaats',
      laatsteOnderhoud: '2024-01-20',
      volgendeOnderhoud: '2024-02-20',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  const [projecten] = useLocalStorage<Project[]>('projecten', []);
  const [showModal, setShowModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [editingItem, setEditingItem] = useState<SpeciaalGereedschap | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    naam: '',
    beschrijving: '',
    status: 'beschikbaar' as const,
    locatie: '',
    laatsteOnderhoud: '',
    volgendeOnderhoud: '',
    projectId: '',
    fotoUrl: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.naam || !formData.beschrijving || !formData.locatie) {
      alert(t('vulVerplichtVelden'));
      return;
    }
    
    if (editingItem) {
      // Update existing item
      const updatedItem: SpeciaalGereedschap = {
        ...editingItem,
        naam: formData.naam,
        beschrijving: formData.beschrijving,
        status: formData.status,
        locatie: formData.locatie,
        laatsteOnderhoud: formData.laatsteOnderhoud || undefined,
        volgendeOnderhoud: formData.volgendeOnderhoud || undefined,
        projectId: formData.projectId || undefined,
        fotoUrl: formData.fotoUrl || undefined,
        updatedAt: new Date().toISOString(),
      };
      
      setGereedschappen(prev => prev.map(item => item.id === editingItem.id ? updatedItem : item));
    } else {
      // Create new item
      const newItem: SpeciaalGereedschap = {
        id: Date.now().toString(),
        naam: formData.naam,
        beschrijving: formData.beschrijving,
        status: formData.status,
        locatie: formData.locatie,
        laatsteOnderhoud: formData.laatsteOnderhoud || undefined,
        volgendeOnderhoud: formData.volgendeOnderhoud || undefined,
        projectId: formData.projectId || undefined,
        fotoUrl: formData.fotoUrl || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      setGereedschappen(prev => [newItem, ...prev]);
    }
    
    resetForm();
    setShowModal(false);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const resetForm = () => {
    setFormData({
      naam: '',
      beschrijving: '',
      status: 'beschikbaar',
      locatie: '',
      laatsteOnderhoud: '',
      volgendeOnderhoud: '',
      projectId: '',
      fotoUrl: '',
    });
    setEditingItem(null);
  };

  const handleEditItem = (item: SpeciaalGereedschap) => {
    setFormData({
      naam: item.naam,
      beschrijving: item.beschrijving,
      status: item.status,
      locatie: item.locatie,
      laatsteOnderhoud: item.laatsteOnderhoud || '',
      volgendeOnderhoud: item.volgendeOnderhoud || '',
      projectId: item.projectId || '',
      fotoUrl: item.fotoUrl || '',
    });
    setEditingItem(item);
    setShowModal(true);
  };

  const handleDeleteItem = (id: string) => {
    if (window.confirm(t('weetJeZeker'))) {
      setGereedschappen(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleNewItem = () => {
    resetForm();
    setShowModal(true);
  };

  const filteredItems = gereedschappen.filter(item =>
    item.naam.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.beschrijving.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.locatie.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'beschikbaar':
        return 'bg-green-100 text-green-800';
      case 'in-gebruik':
        return 'bg-blue-100 text-blue-800';
      case 'onderhoud':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isMaintenanceDue = (nextMaintenance?: string) => {
    if (!nextMaintenance) return false;
    const today = new Date();
    const maintenanceDate = new Date(nextMaintenance);
    const diffTime = maintenanceDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7; // Due within 7 days
  };

  return (
    <div>
      {showSuccessMessage && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
          {t('gereedschapOpgeslagen')}
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-3">
          <Wrench className="text-red-600" />
          <span>{t('specialGereedschap')}</span>
        </h1>
        <button 
          onClick={handleNewItem}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          <Plus size={16} />
          <span>{t('nieuwGereedschap')}</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('zoekGereedschap')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>
      </div>

      {/* Tools Overview */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">{t('specialGereedschapOverzicht')}</h2>
          <p className="text-sm text-gray-600">{t('beheerSpecialGereedschap')}</p>
        </div>
        <div className="p-6">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg">{t('geenSpecialGereedschap')}</p>
              <p className="text-gray-400 text-sm mt-2">
                {t('nieuwGereedschap')}
              </p>
              <button 
                onClick={handleNewItem}
                className="mt-4 flex items-center space-x-2 mx-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <Plus size={16} />
                <span>{t('nieuwGereedschap')}</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Naam</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Beschrijving</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Locatie</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Onderhoud</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('acties')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {item.fotoUrl && (
                            <img 
                              src={item.fotoUrl} 
                              alt={item.naam}
                              className="h-10 w-10 rounded-full object-cover mr-3"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{item.naam}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                        <div className="break-words">{item.beschrijving}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                          {item.status === 'beschikbaar' ? t('beschikbaar') :
                           item.status === 'in-gebruik' ? t('inGebruik') :
                           item.status === 'onderhoud' ? t('onderhoud') : item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <MapPin size={14} className="mr-1 text-gray-400" />
                          {item.locatie}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.projectId ? 
                          projecten.find(p => p.id === item.projectId)?.naam || 'Onbekend project' : 
                          '-'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.volgendeOnderhoud ? (
                          <div className={`flex items-center ${isMaintenanceDue(item.volgendeOnderhoud) ? 'text-red-600' : 'text-gray-600'}`}>
                            <Calendar size={14} className="mr-1" />
                            {formatDate(item.volgendeOnderhoud)}
                            {isMaintenanceDue(item.volgendeOnderhoud) && (
                              <span className="ml-1 text-xs bg-red-100 text-red-800 px-1 rounded">!</span>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditItem(item)}
                            className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                          >
                            <Edit size={16} />
                            <span>{t('bewerken')}</span>
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="text-red-600 hover:text-red-900 flex items-center space-x-1"
                          >
                            <Trash2 size={16} />
                            <span>{t('verwijderen')}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* New/Edit Tool Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? t('bewerken') + ' Gereedschap' : t('nieuwGereedschap')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('gereedschapNaam')} *</label>
              <input
                type="text"
                name="naam"
                value={formData.naam}
                onChange={handleInputChange}
                required
                placeholder="Bijv. Hijskraan 50 ton"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('gereedschapStatus')} *</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="beschikbaar">{t('beschikbaar')}</option>
                <option value="in-gebruik">{t('inGebruik')}</option>
                <option value="onderhoud">{t('onderhoud')}</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('gereedschapBeschrijving')} *</label>
            <textarea
              name="beschrijving"
              value={formData.beschrijving}
              onChange={handleInputChange}
              rows={3}
              required
              placeholder="Beschrijf het gereedschap en zijn gebruik..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('gereedschapLocatie')} *</label>
              <input
                type="text"
                name="locatie"
                value={formData.locatie}
                onChange={handleInputChange}
                required
                placeholder="Bijv. Hoofddepot, Werkplaats"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('gekoppeldProject')}</label>
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">{t('selecteerProject')}</option>
                {projecten.filter(p => p.status === 'actief').map(project => (
                  <option key={project.id} value={project.id}>{project.naam}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('laatsteOnderhoud')}</label>
              <DatePicker
                selected={formData.laatsteOnderhoud ? new Date(formData.laatsteOnderhoud) : null}
                onChange={(date) => {
                  const dateString = date ? date.toISOString().split('T')[0] : '';
                  setFormData(prev => ({ ...prev, laatsteOnderhoud: dateString }));
                }}
                dateFormat="dd/MM/yyyy"
                className="w-full"
                wrapperClassName="w-full"
                portalId="root-portal"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('fotoUrl')}</label>
            <div className="flex">
              <input
                type="url"
                name="fotoUrl"
                value={formData.fotoUrl}
                onChange={handleInputChange}
                placeholder="https://example.com/foto.jpg"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <div className="px-3 py-2 bg-gray-50 border border-l-0 border-gray-300 rounded-r-md flex items-center">
                <Camera size={16} className="text-gray-400" />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button"
              onClick={() => setShowModal(false)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              {t('annuleren')}
            </button>
            <button 
              type="submit"
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              {editingItem ? t('opslaan') : t('nieuwGereedschap')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SpeciaalGereedschapPage;