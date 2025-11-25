import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WorkCode {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

const WorkCodesManagement: React.FC = () => {
  const [workCodes, setWorkCodes] = useState<WorkCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCode, setEditingCode] = useState<WorkCode | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [newCode, setNewCode] = useState({
    code: '',
    name: '',
    description: '',
    is_active: true,
    sort_order: 0
  });

  // Load work codes on mount
  useEffect(() => {
    loadWorkCodes();
  }, []);

  const loadWorkCodes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('work_codes')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;

      setWorkCodes(data || []);
    } catch (error) {
      console.error('Error loading work codes:', error);
      setErrorMessage('Fout bij het laden van bewakingscodes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newCode.code || !newCode.name) {
      setErrorMessage('Code en naam zijn verplicht');
      return;
    }

    try {
      const { error } = await supabase
        .from('work_codes')
        .insert({
          code: newCode.code,
          name: newCode.name,
          description: newCode.description,
          is_active: newCode.is_active,
          sort_order: newCode.sort_order
        });

      if (error) throw error;

      setSuccessMessage('Bewakingscode toegevoegd!');
      setTimeout(() => setSuccessMessage(''), 3000);

      setNewCode({
        code: '',
        name: '',
        description: '',
        is_active: true,
        sort_order: 0
      });
      setShowAddForm(false);
      loadWorkCodes();
    } catch (error: any) {
      console.error('Error adding work code:', error);
      if (error.code === '23505') {
        setErrorMessage('Deze code bestaat al');
      } else {
        setErrorMessage('Fout bij het toevoegen van bewakingscode');
      }
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleUpdateCode = async (code: WorkCode) => {
    try {
      const { error } = await supabase
        .from('work_codes')
        .update({
          code: code.code,
          name: code.name,
          description: code.description,
          is_active: code.is_active,
          sort_order: code.sort_order
        })
        .eq('id', code.id);

      if (error) throw error;

      setSuccessMessage('Bewakingscode bijgewerkt!');
      setTimeout(() => setSuccessMessage(''), 3000);

      setEditingCode(null);
      loadWorkCodes();
    } catch (error: any) {
      console.error('Error updating work code:', error);
      if (error.code === '23505') {
        setErrorMessage('Deze code bestaat al');
      } else {
        setErrorMessage('Fout bij het bijwerken van bewakingscode');
      }
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!window.confirm('Weet je zeker dat je deze bewakingscode wilt verwijderen?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('work_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage('Bewakingscode verwijderd!');
      setTimeout(() => setSuccessMessage(''), 3000);

      loadWorkCodes();
    } catch (error) {
      console.error('Error deleting work code:', error);
      setErrorMessage('Fout bij het verwijderen van bewakingscode');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const toggleActiveStatus = async (code: WorkCode) => {
    try {
      const { error } = await supabase
        .from('work_codes')
        .update({ is_active: !code.is_active })
        .eq('id', code.id);

      if (error) throw error;

      loadWorkCodes();
    } catch (error) {
      console.error('Error toggling active status:', error);
      setErrorMessage('Fout bij het wijzigen van status');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded flex items-center gap-2">
          <CheckCircle size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Bewakingscodes Beheer</h2>
        <p className="text-sm text-gray-600 mb-6">
          Beheer algemene bewakingscodes (groepcodes). Deze codes worden gebruikt bij urenregistratie om werk te categoriseren en zijn beschikbaar voor alle projecten.
        </p>

        {/* Add New Code Button */}
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            {showAddForm ? <X size={16} /> : <Plus size={16} />}
            <span>{showAddForm ? 'Annuleren' : 'Nieuwe Bewakingscode'}</span>
          </button>
        </div>

        {/* Add New Code Form */}
        {showAddForm && (
          <form onSubmit={handleAddCode} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="text-md font-semibold text-gray-800 mb-4">Nieuwe Bewakingscode Toevoegen</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code * <span className="text-xs text-gray-500">(bijv. "001", "MW01", "999")</span>
                </label>
                <input
                  type="text"
                  value={newCode.code}
                  onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                  placeholder="001"
                  required
                  maxLength={50}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Naam *
                </label>
                <input
                  type="text"
                  value={newCode.name}
                  onChange={(e) => setNewCode({ ...newCode, name: e.target.value })}
                  placeholder="Voorbereiding"
                  required
                  maxLength={255}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschrijving
                </label>
                <textarea
                  value={newCode.description}
                  onChange={(e) => setNewCode({ ...newCode, description: e.target.value })}
                  placeholder="Voorbereidende werkzaamheden"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sorteervolgorde
                </label>
                <input
                  type="number"
                  value={newCode.sort_order}
                  onChange={(e) => setNewCode({ ...newCode, sort_order: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCode.is_active}
                    onChange={(e) => setNewCode({ ...newCode, is_active: e.target.checked })}
                    className="mr-2 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Actief</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Annuleren
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <Save size={16} />
                <span>Opslaan</span>
              </button>
            </div>
          </form>
        )}

        {/* Work Codes List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        ) : workCodes.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>Geen bewakingscodes gevonden.</p>
            <p className="text-sm mt-2">Klik op "Nieuwe Bewakingscode" om er een toe te voegen.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {workCodes.map((code) => (
              <div
                key={code.id}
                className={`border rounded-lg p-4 ${
                  code.is_active ? 'border-gray-200 bg-white' : 'border-gray-300 bg-gray-50'
                }`}
              >
                {editingCode?.id === code.id ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Code *</label>
                        <input
                          type="text"
                          value={editingCode.code}
                          onChange={(e) => setEditingCode({ ...editingCode, code: e.target.value.toUpperCase() })}
                          maxLength={50}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Naam *</label>
                        <input
                          type="text"
                          value={editingCode.name}
                          onChange={(e) => setEditingCode({ ...editingCode, name: e.target.value })}
                          maxLength={255}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Beschrijving</label>
                        <textarea
                          value={editingCode.description}
                          onChange={(e) => setEditingCode({ ...editingCode, description: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Sorteervolgorde</label>
                        <input
                          type="number"
                          value={editingCode.sort_order}
                          onChange={(e) => setEditingCode({ ...editingCode, sort_order: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div className="flex items-center">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingCode.is_active}
                            onChange={(e) => setEditingCode({ ...editingCode, is_active: e.target.checked })}
                            className="mr-2 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                          />
                          <span className="text-xs font-medium text-gray-700">Actief</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                      <button
                        onClick={() => setEditingCode(null)}
                        className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Annuleren
                      </button>
                      <button
                        onClick={() => handleUpdateCode(editingCode)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                      >
                        <Save size={14} />
                        <span>Opslaan</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 text-sm font-semibold rounded ${
                          code.is_active ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {code.code}
                        </span>
                        <h3 className="text-md font-semibold text-gray-800">{code.name}</h3>
                        {!code.is_active && (
                          <span className="text-xs bg-gray-300 text-gray-600 px-2 py-0.5 rounded">
                            Inactief
                          </span>
                        )}
                      </div>
                      {code.description && (
                        <p className="text-sm text-gray-600 mb-1">{code.description}</p>
                      )}
                      <p className="text-xs text-gray-500">Sorteervolgorde: {code.sort_order}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActiveStatus(code)}
                        className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                          code.is_active
                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                      >
                        {code.is_active ? 'Deactiveren' : 'Activeren'}
                      </button>
                      <button
                        onClick={() => setEditingCode(code)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Bewerken"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteCode(code.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Verwijderen"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">ℹ️ Tips voor Bewakingscodes</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Gebruik duidelijke en herkenbare codes (bijv. "001", "MW01", "999")</li>
          <li>Code "999" wordt vaak gebruikt als fallback voor "Niet gespecificeerd"</li>
          <li>Codes met "MW" kunnen staan voor meerwerk (bijv. MW01, MW02)</li>
          <li>De sorteervolgorde bepaalt de volgorde in de dropdown bij urenregistratie</li>
          <li>Inactieve codes zijn niet zichtbaar voor medewerkers bij urenregistratie</li>
        </ul>
      </div>
    </div>
  );
};

export default WorkCodesManagement;
