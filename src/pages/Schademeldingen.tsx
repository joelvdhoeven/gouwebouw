import React, { useState } from 'react';
import { AlertTriangle, Plus, Upload, X, Download, User, CreditCard as Edit, Trash2, Archive } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery, useSupabaseMutation } from '../hooks/useSupabase';
import { supabase } from '../lib/supabase';
import { formatDate } from '../utils/dateUtils';
import Modal from '../components/Modal';
import DatePickerField from '../components/DatePickerField';

const Schademeldingen: React.FC = () => {
  const { t } = useLanguage();
  const { user, hasPermission } = useAuth();

  // Admins and kantoorpersoneel see all reports, others see only their own
  const canManageAll = hasPermission('manage_damage_reports') && (user?.role === 'admin' || user?.role === 'kantoorpersoneel');
  const filter = canManageAll ? {} : { created_by: user?.id };

  const { data: schademeldingen = [], loading, refetch } = useSupabaseQuery<any>(
    'damage_reports',
    'id, type_item, omschrijving, beschrijving_schade, datum, foto_urls, created_at, created_by, status',
    filter,
    { order: { column: 'created_at', ascending: false } }
  );
  const { data: profiles = [] } = useSupabaseQuery<any>('profiles', 'id, naam');
  const { insert: insertDamageReport, update: updateDamageReport, remove: deleteDamageReport } = useSupabaseMutation('damage_reports');

  const [showModal, setShowModal] = useState(false);
  const [editingMelding, setEditingMelding] = useState<any>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [showArchive, setShowArchive] = useState(false);

  const [formData, setFormData] = useState({
    typeItem: '',
    omschrijving: '',
    beschrijvingSchade: '',
    datum: new Date().toISOString().split('T')[0],
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDownloadPhotos = async (photos: string[], meldingId: string) => {
    for (let i = 0; i < photos.length; i++) {
      try {
        const response = await fetch(photos[i]);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `schademelding_${meldingId}_foto_${i + 1}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Error downloading photo:', error);
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      // For now, we'll skip photo upload if storage bucket doesn't exist
      // You can create the bucket later in Supabase dashboard
      console.log('Photo upload feature - requires storage bucket setup');
      alert('Foto upload is momenteel nog niet beschikbaar. Neem contact op met de beheerder.');
    } catch (error) {
      console.error('Error uploading photos:', error);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id) {
      alert('Gebruiker niet ingelogd. Probeer opnieuw in te loggen.');
      return;
    }

    if (!formData.typeItem || !formData.omschrijving || !formData.beschrijvingSchade || !formData.datum) {
      alert('Vul alle verplichte velden in.');
      return;
    }

    try {
      if (editingMelding) {
        await updateDamageReport(editingMelding.id, {
          type_item: formData.typeItem,
          omschrijving: formData.omschrijving,
          beschrijving_schade: formData.beschrijvingSchade,
          datum: formData.datum,
          foto_urls: uploadedPhotos.length > 0 ? uploadedPhotos : null,
        });
      } else {
        await insertDamageReport({
          type_item: formData.typeItem,
          omschrijving: formData.omschrijving,
          beschrijving_schade: formData.beschrijvingSchade,
          datum: formData.datum,
          foto_urls: uploadedPhotos.length > 0 ? uploadedPhotos : null,
          created_by: user.id,
        });
      }

      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
      setShowModal(false);
      setEditingMelding(null);
      setFormData({
        typeItem: '',
        omschrijving: '',
        beschrijvingSchade: '',
        datum: new Date().toISOString().split('T')[0],
      });
      setUploadedPhotos([]);
      refetch();
    } catch (error) {
      console.error('Error saving damage report:', error);
      alert('Er is een fout opgetreden bij het opslaan van de schademelding.');
    }
  };

  const handleEditMelding = (melding: any) => {
    setEditingMelding(melding);
    setFormData({
      typeItem: melding.type_item,
      omschrijving: melding.omschrijving,
      beschrijvingSchade: melding.beschrijving_schade,
      datum: melding.datum,
    });
    setUploadedPhotos(melding.foto_urls || []);
    setShowModal(true);
  };

  const handleStatusChange = async (meldingId: string, newStatus: string) => {
    try {
      await updateDamageReport(meldingId, { status: newStatus });
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
      refetch();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Er is een fout opgetreden bij het wijzigen van de status.');
    }
  };

  const handleDeleteMelding = async (meldingId: string) => {
    if (!window.confirm('Weet je zeker dat je deze schademelding wilt verwijderen?')) {
      return;
    }

    try {
      await deleteDamageReport(meldingId);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
      refetch();
    } catch (error) {
      console.error('Error deleting damage report:', error);
      alert('Er is een fout opgetreden bij het verwijderen van de schademelding.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div>
      {showSuccessMessage && (
        <div className="mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
          {t('schademeldingOpgeslagen')}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('schademeldingen')}</h1>
          <p className="text-gray-600">
            {canManageAll
              ? showArchive ? 'Archief - Verwerkte schademeldingen' : 'Overzicht van alle schademeldingen'
              : 'Mijn schademeldingen'}
          </p>
        </div>
        <div className="flex space-x-3">
          {canManageAll && (
            <button
              onClick={() => setShowArchive(!showArchive)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
            >
              <Archive size={18} />
              <span>{showArchive ? 'Toon Actieve' : 'Archief'}</span>
            </button>
          )}
          <button
            onClick={() => {
              setEditingMelding(null);
              setFormData({
                typeItem: '',
                omschrijving: '',
                beschrijvingSchade: '',
                datum: new Date().toISOString().split('T')[0],
              });
              setUploadedPhotos([]);
              setShowModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            <Plus size={18} />
            <span>{t('nieuweSchademelding')}</span>
          </button>
        </div>
      </div>

      {/* Damage Reports List */}
      {schademeldingen.filter((m: any) => showArchive ? m.status === 'opgelost' : m.status !== 'opgelost').length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">Geen schademeldingen gevonden</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schademeldingen.filter((m: any) => showArchive ? m.status === 'opgelost' : m.status !== 'opgelost').map((melding: any) => {
            const creator = profiles.find((p: any) => p.id === melding.created_by);
            return (
              <div key={melding.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      {melding.type_item === 'bus' ? 'Bus' : melding.type_item === 'materiaal' ? 'Materiaal' : 'Gereedschap'}
                    </h3>
                    <p className="text-sm text-gray-500">{formatDate(melding.datum)}</p>
                    {canManageAll && creator && (
                      <div className="flex items-center text-xs text-gray-600 mt-1">
                        <User size={12} className="mr-1" />
                        <span>{creator.naam}</span>
                      </div>
                    )}
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    melding.status === 'gemeld' ? 'bg-red-100 text-red-800' :
                    melding.status === 'in-behandeling' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {melding.status === 'gemeld' ? 'Gemeld' :
                     melding.status === 'in-behandeling' ? 'In behandeling' :
                     'Opgelost'}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{t('omschrijving')}:</p>
                    <p className="text-sm text-gray-600">{melding.omschrijving}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">{t('beschrijvingSchade')}:</p>
                    <p className="text-sm text-gray-600">{melding.beschrijving_schade}</p>
                  </div>
                </div>

                {melding.foto_urls && melding.foto_urls.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-700">{t('fotoS')} ({melding.foto_urls.length}):</p>
                      {canManageAll && (
                        <button
                          onClick={() => handleDownloadPhotos(melding.foto_urls, melding.id)}
                          className="flex items-center space-x-1 px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                        >
                          <Download size={12} />
                          <span>Download</span>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {melding.foto_urls.slice(0, 3).map((url: string, index: number) => (
                        <img
                          key={index}
                          src={url}
                          alt={`Schade foto ${index + 1}`}
                          className="w-full h-20 object-cover rounded"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {canManageAll && !showArchive && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEditMelding(melding)}
                        className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                      >
                        <Edit size={14} />
                        <span>Bewerk</span>
                      </button>
                      <button
                        onClick={() => handleDeleteMelding(melding.id)}
                        className="flex items-center justify-center px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs font-medium text-gray-700 mb-1">Status wijzigen:</p>
                      <button
                        onClick={() => handleStatusChange(melding.id, 'in-behandeling')}
                        disabled={melding.status === 'in-behandeling'}
                        className="w-full px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded text-xs hover:bg-yellow-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Mee Bezig
                      </button>
                      <button
                        onClick={() => handleStatusChange(melding.id, 'opgelost')}
                        className="w-full px-3 py-1.5 bg-green-100 text-green-800 rounded text-xs hover:bg-green-200 transition-colors"
                      >
                        Verwerkt (→ Archief)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Damage Report Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setFormData({
            typeItem: '',
            omschrijving: '',
            beschrijvingSchade: '',
            datum: new Date().toISOString().split('T')[0],
          });
          setUploadedPhotos([]);
        }}
        title={editingMelding ? 'Schademelding Bewerken' : 'Nieuwe Schademelding'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('typeItem')} <span className="text-red-600">*</span>
            </label>
            <select
              name="typeItem"
              value={formData.typeItem}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">{t('selecteerType')}</option>
              <option value="gereedschap">{t('gereedschap')}</option>
              <option value="materiaal">{t('materiaal')}</option>
              <option value="bus">{t('bus')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('omschrijving')} <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              name="omschrijving"
              value={formData.omschrijving}
              onChange={handleInputChange}
              placeholder="Bijv. Boormachine, Bedrijfsbus, Hout planken"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <DatePickerField
            label={t('datum')}
            value={formData.datum}
            onChange={(date) => setFormData(prev => ({ ...prev, datum: date }))}
            required
            placeholder="Selecteer datum"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('beschrijvingSchade')} <span className="text-red-600">*</span>
            </label>
            <textarea
              name="beschrijvingSchade"
              value={formData.beschrijvingSchade}
              onChange={handleInputChange}
              rows={4}
              placeholder={t('beschrijfSchade')}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fotoS')} <span className="text-gray-500">({t('optioneel')})</span>
            </label>
            <div className="mt-1">
              <label className="flex items-center justify-center w-full px-4 py-6 border-2 border-gray-300 border-dashed rounded-md cursor-pointer hover:border-red-500 transition-colors">
                <div className="space-y-1 text-center">
                  <Upload className="mx-auto h-8 w-8 text-gray-400" />
                  <div className="text-sm text-gray-600">
                    {uploading ? t('uploaden') : t('klikOmFotoSTeUploaden')}
                  </div>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            {uploadedPhotos.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {uploadedPhotos.map((url, index) => (
                  <div key={index} className="relative">
                    <img
                      src={url}
                      alt={`Upload ${index + 1}`}
                      className="w-full h-24 object-cover rounded"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowModal(false);
                setFormData({
                  typeItem: '',
                  omschrijving: '',
                  beschrijvingSchade: '',
                  datum: new Date().toISOString().split('T')[0],
                });
                setUploadedPhotos([]);
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:bg-gray-400"
            >
              {editingMelding ? 'Bijwerken' : 'Opslaan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Schademeldingen;
