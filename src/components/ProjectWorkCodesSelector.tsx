import React, { useState, useEffect } from 'react';
import { Plus, X, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WorkCode {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

interface ProjectWorkCode {
  id: string;
  project_id: string;
  work_code_id: string | null;
  custom_code: string | null;
  custom_name: string | null;
  custom_description: string | null;
  work_codes?: WorkCode;
}

interface Props {
  projectId: string | null;
  onChange?: (selectedCodes: ProjectWorkCode[]) => void;
  readOnly?: boolean;
}

const ProjectWorkCodesSelector: React.FC<Props> = ({ projectId, onChange, readOnly = false }) => {
  const [allWorkCodes, setAllWorkCodes] = useState<WorkCode[]>([]);
  const [projectWorkCodes, setProjectWorkCodes] = useState<ProjectWorkCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customCode, setCustomCode] = useState({ code: '', name: '', description: '' });
  const [error, setError] = useState('');

  // Load all active work codes
  useEffect(() => {
    const loadWorkCodes = async () => {
      try {
        const { data, error } = await supabase
          .from('work_codes')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (error) throw error;
        setAllWorkCodes(data || []);
      } catch (err) {
        console.error('Error loading work codes:', err);
      }
    };
    loadWorkCodes();
  }, []);

  // Load project work codes when projectId changes
  useEffect(() => {
    if (projectId) {
      loadProjectWorkCodes();
    } else {
      setProjectWorkCodes([]);
    }
  }, [projectId]);

  const loadProjectWorkCodes = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_work_codes')
        .select(`
          id,
          project_id,
          work_code_id,
          custom_code,
          custom_name,
          custom_description,
          work_codes (id, code, name, description, is_active)
        `)
        .eq('project_id', projectId);

      if (error) {
        // Table might not exist yet
        if (error.code === 'PGRST116' || error.message?.includes('does not exist')) {
          console.log('project_work_codes table does not exist yet');
          setProjectWorkCodes([]);
          return;
        }
        throw error;
      }

      setProjectWorkCodes(data || []);
      if (onChange) {
        onChange(data || []);
      }
    } catch (err) {
      console.error('Error loading project work codes:', err);
    } finally {
      setLoading(false);
    }
  };

  // Check if a work code is selected for this project
  const isCodeSelected = (workCodeId: string): boolean => {
    return projectWorkCodes.some(pwc => pwc.work_code_id === workCodeId);
  };

  // Toggle a standard work code
  const toggleWorkCode = async (workCode: WorkCode) => {
    if (!projectId || readOnly) return;

    try {
      if (isCodeSelected(workCode.id)) {
        // Remove
        const { error } = await supabase
          .from('project_work_codes')
          .delete()
          .eq('project_id', projectId)
          .eq('work_code_id', workCode.id);

        if (error) throw error;
      } else {
        // Add
        const { error } = await supabase
          .from('project_work_codes')
          .insert({
            project_id: projectId,
            work_code_id: workCode.id
          });

        if (error) throw error;
      }

      await loadProjectWorkCodes();
    } catch (err) {
      console.error('Error toggling work code:', err);
      setError('Fout bij het wijzigen van bewakingscode');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Add a custom work code
  const handleAddCustomCode = async () => {
    if (!projectId || readOnly) return;

    if (!customCode.code || !customCode.name) {
      setError('Code en naam zijn verplicht');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Check if code already exists in project
    const existingCustom = projectWorkCodes.find(pwc => pwc.custom_code === customCode.code);
    if (existingCustom) {
      setError('Deze code bestaat al voor dit project');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      const { error } = await supabase
        .from('project_work_codes')
        .insert({
          project_id: projectId,
          custom_code: customCode.code,
          custom_name: customCode.name,
          custom_description: customCode.description || null
        });

      if (error) throw error;

      setCustomCode({ code: '', name: '', description: '' });
      setShowAddCustom(false);
      await loadProjectWorkCodes();
    } catch (err) {
      console.error('Error adding custom code:', err);
      setError('Fout bij het toevoegen van aangepaste code');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Remove a project work code (custom or standard)
  const removeProjectWorkCode = async (pwcId: string) => {
    if (!projectId || readOnly) return;

    try {
      const { error } = await supabase
        .from('project_work_codes')
        .delete()
        .eq('id', pwcId);

      if (error) throw error;
      await loadProjectWorkCodes();
    } catch (err) {
      console.error('Error removing work code:', err);
      setError('Fout bij het verwijderen van bewakingscode');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Get custom codes
  const customCodes = projectWorkCodes.filter(pwc => pwc.custom_code !== null);

  if (!projectId) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-500 italic">
          Sla het project eerst op om bewakingscodes te kunnen toewijzen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Standard Work Codes Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Standaard Bewakingscodes
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Selecteer welke bewakingscodes beschikbaar zijn voor dit project. Alleen geselecteerde codes kunnen worden gebruikt bij urenregistratie.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {allWorkCodes.map(wc => {
              const selected = isCodeSelected(wc.id);
              return (
                <button
                  key={wc.id}
                  type="button"
                  onClick={() => toggleWorkCode(wc)}
                  disabled={readOnly}
                  className={`flex items-center justify-between p-2 rounded border text-left text-sm transition-colors ${
                    selected
                      ? 'bg-red-50 border-red-300 text-red-800'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  } ${readOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                      selected ? 'bg-red-200' : 'bg-gray-100'
                    }`}>
                      {wc.code}
                    </span>
                    <span className="truncate">{wc.name}</span>
                  </div>
                  {selected && <Check size={16} className="text-red-600 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {allWorkCodes.length === 0 && !loading && (
          <p className="text-sm text-gray-500 italic py-2">
            Geen bewakingscodes beschikbaar. Voeg ze eerst toe via Instellingen → Bewakingscodes.
          </p>
        )}
      </div>

      {/* Custom Project-Specific Codes */}
      <div className="border-t pt-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            Project-specifieke Codes
          </label>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setShowAddCustom(!showAddCustom)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              {showAddCustom ? <X size={14} /> : <Plus size={14} />}
              {showAddCustom ? 'Annuleren' : 'Voeg toe'}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Voeg aangepaste bewakingscodes toe die alleen voor dit project gelden (bijv. ruimte-codes of calculatie-specifieke codes).
        </p>

        {/* Add Custom Code Form */}
        {showAddCustom && !readOnly && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
              <input
                type="text"
                placeholder="Code (bijv. R01)"
                value={customCode.code}
                onChange={(e) => setCustomCode({ ...customCode, code: e.target.value.toUpperCase() })}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <input
                type="text"
                placeholder="Naam"
                value={customCode.name}
                onChange={(e) => setCustomCode({ ...customCode, name: e.target.value })}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
              />
              <input
                type="text"
                placeholder="Beschrijving (optioneel)"
                value={customCode.description}
                onChange={(e) => setCustomCode({ ...customCode, description: e.target.value })}
                className="px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAddCustomCode}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Toevoegen
              </button>
            </div>
          </div>
        )}

        {/* List of Custom Codes */}
        {customCodes.length > 0 ? (
          <div className="space-y-2">
            {customCodes.map(pwc => (
              <div
                key={pwc.id}
                className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-blue-200 rounded text-xs font-mono text-blue-800">
                    {pwc.custom_code}
                  </span>
                  <span className="text-blue-900">{pwc.custom_name}</span>
                  {pwc.custom_description && (
                    <span className="text-blue-600 text-xs">- {pwc.custom_description}</span>
                  )}
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeProjectWorkCode(pwc.id)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">
            Geen project-specifieke codes toegevoegd.
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="border-t pt-3">
        <p className="text-xs text-gray-600">
          <strong>Samenvatting:</strong> {projectWorkCodes.length} bewakingscode(s) gekoppeld aan dit project
          {projectWorkCodes.length === 0 && (
            <span className="text-orange-600 ml-1">
              (alle standaard codes zijn beschikbaar als er geen specifieke selectie is)
            </span>
          )}
        </p>
      </div>
    </div>
  );
};

export default ProjectWorkCodesSelector;
