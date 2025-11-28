import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MaterialGroup {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

const MaterialGroupsManagement: React.FC = () => {
  const [materialGroups, setMaterialGroups] = useState<MaterialGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingGroup, setEditingGroup] = useState<MaterialGroup | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [newGroup, setNewGroup] = useState({
    code: '',
    name: '',
    description: '',
    is_active: true,
    sort_order: 0
  });

  // Load material groups on mount
  useEffect(() => {
    loadMaterialGroups();
  }, []);

  const loadMaterialGroups = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('material_groups')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        // Check if table doesn't exist (migration not run yet)
        if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
          setErrorMessage('De materiaalgroepen tabel bestaat nog niet. Voer eerst de database migratie uit.');
          console.error('Error loading material groups:', error);
          return;
        }
        throw error;
      }

      setMaterialGroups(data || []);
    } catch (error: any) {
      console.error('Error loading material groups:', error);
      setErrorMessage('Fout bij het laden van materiaalgroepen: ' + (error.message || 'Onbekende fout'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newGroup.code || !newGroup.name) {
      setErrorMessage('Code en naam zijn verplicht');
      return;
    }

    // Validate code is 2 digits
    if (!/^\d{2}$/.test(newGroup.code)) {
      setErrorMessage('Code moet 2 cijfers zijn (bijv. 01, 09, 10)');
      return;
    }

    try {
      const { error } = await supabase
        .from('material_groups')
        .insert({
          code: newGroup.code,
          name: newGroup.name,
          description: newGroup.description,
          is_active: newGroup.is_active,
          sort_order: newGroup.sort_order
        });

      if (error) throw error;

      setSuccessMessage('Materiaalgroep toegevoegd!');
      setTimeout(() => setSuccessMessage(''), 3000);

      setNewGroup({
        code: '',
        name: '',
        description: '',
        is_active: true,
        sort_order: 0
      });
      setShowAddForm(false);
      loadMaterialGroups();
    } catch (error: any) {
      console.error('Error adding material group:', error);
      if (error.code === '23505') {
        setErrorMessage('Deze code bestaat al');
      } else {
        setErrorMessage('Fout bij het toevoegen van materiaalgroep');
      }
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleUpdateGroup = async (group: MaterialGroup) => {
    try {
      const { error } = await supabase
        .from('material_groups')
        .update({
          code: group.code,
          name: group.name,
          description: group.description,
          is_active: group.is_active,
          sort_order: group.sort_order
        })
        .eq('id', group.id);

      if (error) throw error;

      setSuccessMessage('Materiaalgroep bijgewerkt!');
      setTimeout(() => setSuccessMessage(''), 3000);

      setEditingGroup(null);
      loadMaterialGroups();
    } catch (error: any) {
      console.error('Error updating material group:', error);
      if (error.code === '23505') {
        setErrorMessage('Deze code bestaat al');
      } else {
        setErrorMessage('Fout bij het bijwerken van materiaalgroep');
      }
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!window.confirm('Weet je zeker dat je deze materiaalgroep wilt verwijderen?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('material_groups')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccessMessage('Materiaalgroep verwijderd!');
      setTimeout(() => setSuccessMessage(''), 3000);

      loadMaterialGroups();
    } catch (error) {
      console.error('Error deleting material group:', error);
      setErrorMessage('Fout bij het verwijderen van materiaalgroep');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const toggleActiveStatus = async (group: MaterialGroup) => {
    try {
      const { error } = await supabase
        .from('material_groups')
        .update({ is_active: !group.is_active })
        .eq('id', group.id);

      if (error) throw error;

      loadMaterialGroups();
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
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Materiaalgroepen Beheer</h2>
        <p className="text-sm text-gray-600 mb-6">
          Beheer de materiaalgroepen voor voorraadclassificatie. Deze groepen worden gebruikt om producten te categoriseren in het voorraadbeheer.
        </p>

        {/* Add New Group Button */}
        <div className="mb-4 flex justify-end">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            {showAddForm ? <X size={16} /> : <Plus size={16} />}
            <span>{showAddForm ? 'Annuleren' : 'Nieuwe Materiaalgroep'}</span>
          </button>
        </div>

        {/* Add New Group Form */}
        {showAddForm && (
          <form onSubmit={handleAddGroup} className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
            <h3 className="text-md font-semibold text-gray-800 mb-4">Nieuwe Materiaalgroep Toevoegen</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code * <span className="text-xs text-gray-500">(2 cijfers, bijv. "09", "10")</span>
                </label>
                <input
                  type="text"
                  value={newGroup.code}
                  onChange={(e) => setNewGroup({ ...newGroup, code: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
                  placeholder="09"
                  required
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Naam *
                </label>
                <input
                  type="text"
                  value={newGroup.name}
                  onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                  placeholder="Elektra materialen"
                  required
                  maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschrijving
                </label>
                <textarea
                  value={newGroup.description}
                  onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                  placeholder="Beschrijf welke materialen in deze groep vallen"
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
                  value={newGroup.sort_order}
                  onChange={(e) => setNewGroup({ ...newGroup, sort_order: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newGroup.is_active}
                    onChange={(e) => setNewGroup({ ...newGroup, is_active: e.target.checked })}
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

        {/* Material Groups List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          </div>
        ) : materialGroups.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>Geen materiaalgroepen gevonden.</p>
            <p className="text-sm mt-2">Klik op "Nieuwe Materiaalgroep" om er een toe te voegen.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {materialGroups.map((group) => (
              <div
                key={group.id}
                className={`border rounded-lg p-4 ${
                  group.is_active ? 'border-gray-200 bg-white' : 'border-gray-300 bg-gray-50'
                }`}
              >
                {editingGroup?.id === group.id ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Code *</label>
                        <input
                          type="text"
                          value={editingGroup.code}
                          onChange={(e) => setEditingGroup({ ...editingGroup, code: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
                          maxLength={2}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Naam *</label>
                        <input
                          type="text"
                          value={editingGroup.name}
                          onChange={(e) => setEditingGroup({ ...editingGroup, name: e.target.value })}
                          maxLength={100}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Beschrijving</label>
                        <textarea
                          value={editingGroup.description}
                          onChange={(e) => setEditingGroup({ ...editingGroup, description: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Sorteervolgorde</label>
                        <input
                          type="number"
                          value={editingGroup.sort_order}
                          onChange={(e) => setEditingGroup({ ...editingGroup, sort_order: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>

                      <div className="flex items-center">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingGroup.is_active}
                            onChange={(e) => setEditingGroup({ ...editingGroup, is_active: e.target.checked })}
                            className="mr-2 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                          />
                          <span className="text-xs font-medium text-gray-700">Actief</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                      <button
                        onClick={() => setEditingGroup(null)}
                        className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        Annuleren
                      </button>
                      <button
                        onClick={() => handleUpdateGroup(editingGroup)}
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
                          group.is_active ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {group.code}
                        </span>
                        <h3 className="text-md font-semibold text-gray-800">{group.name}</h3>
                        {!group.is_active && (
                          <span className="text-xs bg-gray-300 text-gray-600 px-2 py-0.5 rounded">
                            Inactief
                          </span>
                        )}
                      </div>
                      {group.description && (
                        <p className="text-sm text-gray-600 mb-1">{group.description}</p>
                      )}
                      <p className="text-xs text-gray-500">Sorteervolgorde: {group.sort_order}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActiveStatus(group)}
                        className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                          group.is_active
                            ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                      >
                        {group.is_active ? 'Deactiveren' : 'Activeren'}
                      </button>
                      <button
                        onClick={() => setEditingGroup(group)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Bewerken"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
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
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Info over Materiaalgroepen</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Materiaalgroepen worden gebruikt om producten te categoriseren in het voorraadbeheer</li>
          <li>De code moet 2 cijfers zijn (bijv. 01, 02, ..., 09, 10)</li>
          <li>Standaard groepen: 01 Diversen, 02 Pur & Kit, 03 Montage, 04 Afwerking, etc.</li>
          <li>De sorteervolgorde bepaalt de volgorde in dropdowns en lijsten</li>
          <li>Inactieve groepen zijn niet zichtbaar bij het aanmaken van nieuwe producten</li>
        </ul>
      </div>
    </div>
  );
};

export default MaterialGroupsManagement;
