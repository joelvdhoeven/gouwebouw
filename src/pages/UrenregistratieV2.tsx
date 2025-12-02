import React, { useState, useEffect } from 'react';
import { Download, Plus, Calendar, X, Trash2, Pencil, Minus, Info, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { supabase } from '../lib/supabase';
import { exportUrenRegistraties } from '../utils/exportUtils';
import { formatDate } from '../utils/dateUtils';
import Modal from '../components/Modal';
import DatePickerField from '../components/DatePickerField';

interface WorkCode {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

interface MaterialLine {
  type: 'product' | 'description';
  product_id?: string;
  product_name?: string;
  description?: string;
  quantity: number;
  unit?: string;
}

interface WorkLine {
  work_code_id: string;
  work_code_name: string;
  werkomschrijving: string;
  aantal_uren: number;
  materials?: MaterialLine[];
}

const UrenregistratieV2: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission, user, profile } = useAuth();
  const { settings } = useSystemSettings();

  // State for data
  const [registraties, setRegistraties] = useState<any[]>([]);
  const [projecten, setProjecten] = useState<any[]>([]);
  const [gebruikers, setGebruikers] = useState<any[]>([]);
  const [workCodes, setWorkCodes] = useState<WorkCode[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin and kantoorpersoneel can see all registrations, others only their own
  const canViewAll = profile?.role === 'admin' || profile?.role === 'kantoorpersoneel' || profile?.role === 'superuser';

  // UI State
  const [showNewRegistration, setShowNewRegistration] = useState(true);
  const [showOverview, setShowOverview] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [mutationLoading, setMutationLoading] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [startDateFilter, setStartDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [endDateFilter, setEndDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [workCodeFilter, setWorkCodeFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('custom');
  const [userFilter, setUserFilter] = useState(canViewAll ? '' : (user?.id || ''));

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Form state
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [formData, setFormData] = useState({
    datum: new Date().toISOString().split('T')[0],
    voortgang: '',
    kilometers: '',
  });

  const [workLines, setWorkLines] = useState<WorkLine[]>([
    { work_code_id: '', work_code_name: '', werkomschrijving: '', aantal_uren: 0, materials: [] }
  ]);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState<any>(null);

  // Quick project modal state
  const [showConfirmProjectModal, setShowConfirmProjectModal] = useState(false);
  const [showQuickProjectModal, setShowQuickProjectModal] = useState(false);
  const [showProjectCreatingModal, setShowProjectCreatingModal] = useState(false);
  const [quickProjectName, setQuickProjectName] = useState('');

  // Load all data
  useEffect(() => {
    loadData();
  }, [user?.id, canViewAll]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load registrations
      let query = supabase
        .from('time_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (!canViewAll && user?.id) {
        query = query.eq('user_id', user.id);
      }

      const [registrationsRes, projectsRes, usersRes, workCodesRes, productsRes] = await Promise.all([
        query,
        supabase.from('projects').select('*').eq('status', 'actief'),
        supabase.from('profiles').select('id, naam, email'),
        supabase.from('work_codes').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('inventory_products').select('id, name, sku, unit')
      ]);

      if (registrationsRes.data) setRegistraties(registrationsRes.data);
      if (projectsRes.data) setProjecten(projectsRes.data);
      if (usersRes.data) setGebruikers(usersRes.data);
      if (workCodesRes.data) setWorkCodes(workCodesRes.data);
      if (productsRes.data) setProducts(productsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formError) setFormError('');
  };

  const handleDateRangeChange = (range: string) => {
    setDateRangeFilter(range);
    const today = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (range) {
      case 'deze-week':
        const dayOfWeek = today.getDay();
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        startDate = new Date(today);
        startDate.setDate(today.getDate() + diffToMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case 'deze-maand':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'dit-jaar':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = new Date(today.getFullYear(), 11, 31);
        break;
      case 'custom':
        return;
    }

    setStartDateFilter(startDate.toISOString().split('T')[0]);
    setEndDateFilter(endDate.toISOString().split('T')[0]);
  };

  const addWorkLine = () => {
    setWorkLines([...workLines, { work_code_id: '', work_code_name: '', werkomschrijving: '', aantal_uren: 0, materials: [] }]);
  };

  const removeWorkLine = (index: number) => {
    if (workLines.length > 1) {
      setWorkLines(workLines.filter((_, i) => i !== index));
    }
  };

  const updateWorkLine = (index: number, field: keyof WorkLine, value: string | number) => {
    const updated = [...workLines];
    if (field === 'work_code_id') {
      const workCode = workCodes.find(wc => wc.id === value);
      updated[index] = {
        ...updated[index],
        work_code_id: value as string,
        work_code_name: workCode?.name || ''
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setWorkLines(updated);
    if (formError) setFormError('');
  };

  const addMaterialToWorkLine = (workLineIndex: number) => {
    const updated = [...workLines];
    if (!updated[workLineIndex].materials) {
      updated[workLineIndex].materials = [];
    }
    updated[workLineIndex].materials!.push({
      type: 'product',
      product_id: '',
      product_name: '',
      quantity: 0,
      unit: ''
    });
    setWorkLines(updated);
  };

  const removeMaterialFromWorkLine = (workLineIndex: number, materialIndex: number) => {
    const updated = [...workLines];
    updated[workLineIndex].materials = updated[workLineIndex].materials?.filter((_, i) => i !== materialIndex);
    setWorkLines(updated);
  };

  const updateMaterial = (workLineIndex: number, materialIndex: number, field: keyof MaterialLine, value: string | number) => {
    const updated = [...workLines];
    if (updated[workLineIndex].materials) {
      updated[workLineIndex].materials![materialIndex] = {
        ...updated[workLineIndex].materials![materialIndex],
        [field]: value
      };

      if (field === 'product_id' && typeof value === 'string') {
        const product = products.find((p: any) => p.id === value);
        if (product) {
          updated[workLineIndex].materials![materialIndex].product_name = product.name;
          updated[workLineIndex].materials![materialIndex].unit = product.unit;
        }
      }
    }
    setWorkLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.datum || !selectedProject) {
      setFormError('Datum en project zijn verplicht');
      return;
    }

    for (let i = 0; i < workLines.length; i++) {
      const line = workLines[i];
      if (!line.work_code_id || !line.werkomschrijving || !line.aantal_uren) {
        setFormError(`Vul alle velden in voor werkregel ${i + 1}`);
        return;
      }
      if (line.aantal_uren <= 0) {
        setFormError(`Aantal uren moet groter zijn dan 0 voor werkregel ${i + 1}`);
        return;
      }
      if (line.aantal_uren > 24) {
        setFormError(`Aantal uren kan niet meer dan 24 zijn voor werkregel ${i + 1}`);
        return;
      }
    }

    const totalHours = workLines.reduce((sum, line) => sum + line.aantal_uren, 0);
    if (totalHours > 24) {
      setFormError('Totaal aantal uren kan niet meer dan 24 uur per dag zijn');
      return;
    }

    setFormError('');
    setMutationLoading(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser?.id) {
        setFormError('Gebruiker niet ingelogd');
        setMutationLoading(false);
        return;
      }

      const kilometers = formData.kilometers ? parseFloat(formData.kilometers) : 0;

      const registrations = workLines.map(line => ({
        user_id: currentUser.id,
        project_id: selectedProject?.id || null,
        project_naam: selectedProject?.naam,
        datum: formData.datum,
        werktype: line.work_code_name, // Store work code name as werktype for compatibility
        werk_code_id: line.work_code_id,
        aantal_uren: line.aantal_uren,
        werkomschrijving: line.werkomschrijving,
        driven_kilometers: kilometers,
        status: 'submitted',
        progress_percentage: formData.voortgang ? parseInt(formData.voortgang) : null,
        materials: line.materials && line.materials.length > 0 ? line.materials : []
      }));

      const { error: insertError } = await supabase.from('time_registrations').insert(registrations);

      if (insertError) throw insertError;

      // Update project progress if provided
      if (selectedProject?.id && formData.voortgang) {
        const { data: currentProject } = await supabase
          .from('projects')
          .select('progress_percentage')
          .eq('id', selectedProject.id)
          .single();

        const newPercentage = parseInt(formData.voortgang);
        const currentPercentage = currentProject?.progress_percentage || 0;

        if (newPercentage > currentPercentage) {
          await supabase
            .from('projects')
            .update({ progress_percentage: newPercentage })
            .eq('id', selectedProject.id);
        }
      }

      // Reset form
      setFormData({
        datum: new Date().toISOString().split('T')[0],
        voortgang: '',
        kilometers: '',
      });
      setWorkLines([{ work_code_id: '', work_code_name: '', werkomschrijving: '', aantal_uren: 0, materials: [] }]);
      setSelectedProject(null);

      setSuccessMessage(t('registratieOpgeslagen'));
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
        setSuccessMessage('');
      }, 3000);

      loadData();
    } catch (error) {
      console.error('Error creating registration:', error);
      setFormError('Er is een fout opgetreden bij het opslaan van de registratie.');
    } finally {
      setMutationLoading(false);
    }
  };

  const isRegistrationEditable = (registratie: any) => {
    if (registratie.user_id === user?.id) return true;
    return hasPermission('approve_hours');
  };

  const handleEditRegistration = (registratie: any) => {
    if (!isRegistrationEditable(registratie)) {
      alert('Je hebt geen rechten om deze registratie te bewerken.');
      return;
    }

    setEditingRegistration({
      id: registratie.id,
      datum: registratie.datum,
      werk_code_id: registratie.werk_code_id || '',
      werktype: registratie.werktype,
      aantalUren: registratie.aantal_uren.toString(),
      werkomschrijving: registratie.werkomschrijving,
      project_id: registratie.project_id || '',
      voortgang: registratie.progress_percentage?.toString() || '',
      kilometers: registratie.driven_kilometers?.toString() || '',
      user_id: registratie.user_id,
    });
    setShowEditModal(true);
  };

  const handleUpdateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingRegistration) return;

    if (!editingRegistration.datum || !editingRegistration.aantalUren || !editingRegistration.werkomschrijving) {
      alert(t('vulVerplichtVelden'));
      return;
    }

    try {
      const workCode = workCodes.find(wc => wc.id === editingRegistration.werk_code_id);

      const { error } = await supabase
        .from('time_registrations')
        .update({
          datum: editingRegistration.datum,
          werktype: workCode?.name || editingRegistration.werktype,
          werk_code_id: editingRegistration.werk_code_id,
          aantal_uren: parseFloat(editingRegistration.aantalUren),
          werkomschrijving: editingRegistration.werkomschrijving,
          project_id: editingRegistration.project_id || null,
          progress_percentage: editingRegistration.voortgang ? parseInt(editingRegistration.voortgang) : null,
          driven_kilometers: editingRegistration.kilometers ? parseFloat(editingRegistration.kilometers) : 0,
        })
        .eq('id', editingRegistration.id);

      if (error) throw error;

      setShowEditModal(false);
      setEditingRegistration(null);
      setSuccessMessage('Registratie succesvol bijgewerkt!');
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
        setSuccessMessage('');
      }, 3000);
      loadData();
    } catch (error) {
      console.error('Error updating registration:', error);
      alert('Er is een fout opgetreden bij het bijwerken van de registratie.');
    }
  };

  const handleDeleteRegistration = async (id: string) => {
    if (window.confirm(t('weetJeZeker'))) {
      try {
        const { error } = await supabase.from('time_registrations').delete().eq('id', id);
        if (error) throw error;

        setSuccessMessage(t('registratieVerwijderd'));
        setShowSuccessMessage(true);
        setTimeout(() => {
          setShowSuccessMessage(false);
          setSuccessMessage('');
        }, 3000);
        loadData();
      } catch (error) {
        console.error('Error deleting registration:', error);
        alert('Er is een fout opgetreden bij het verwijderen van de registratie.');
      }
    }
  };

  const handleQuickProjectCreate = async () => {
    if (!quickProjectName.trim()) {
      alert('Vul een projectnaam in');
      return;
    }

    try {
      setShowQuickProjectModal(false);
      setShowProjectCreatingModal(true);

      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          naam: quickProjectName,
          beschrijving: 'Aangemaakt door medewerker - nog in te vullen',
          start_datum: new Date().toISOString().split('T')[0],
          created_by: user?.id,
          status: 'actief',
          progress_percentage: 0,
        })
        .select()
        .single();

      if (error) {
        setShowProjectCreatingModal(false);
        alert('Fout bij aanmaken project');
        setShowQuickProjectModal(true);
        return;
      }

      setQuickProjectName('');
      setSelectedProject(newProject);
      window.dispatchEvent(new CustomEvent('projectsUpdated'));

      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      setShowProjectCreatingModal(false);
      alert('Er is een fout opgetreden');
      setShowQuickProjectModal(true);
    }
  };

  const handleExport = () => {
    if (filteredRegistraties.length === 0) {
      alert('Geen registraties om te exporteren');
      return;
    }
    const separator = settings?.csv_separator || ';';

    const enrichedRegistraties = filteredRegistraties.map(reg => {
      const gebruiker = gebruikers.find((g: any) => g.id === reg.user_id);
      return {
        ...reg,
        user_naam: gebruiker?.naam || gebruiker?.email || 'Onbekend'
      };
    });

    exportUrenRegistraties(enrichedRegistraties, separator);
  };

  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Filter registrations
  const processedRegistraties = registraties.filter(registratie => {
    if (hasPermission('view_reports') && userFilter && registratie.user_id !== userFilter) {
      return false;
    }

    const registratieDate = new Date(registratie.datum);
    const startDate = new Date(startDateFilter);
    const endDate = new Date(endDateFilter);
    endDate.setHours(23, 59, 59, 999);

    if (registratieDate < startDate || registratieDate > endDate) {
      return false;
    }

    if (workCodeFilter !== 'all') {
      const workCode = workCodes.find(wc => wc.id === workCodeFilter);
      if (workCode && registratie.werktype !== workCode.name && registratie.werk_code_id !== workCodeFilter) {
        return false;
      }
    }

    return true;
  });

  const filteredRegistraties = processedRegistraties.filter(registratie => {
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();

    if (registratie.project_id) {
      const project = projecten.find(p => p.id === registratie.project_id);
      if (project) {
        if (project.naam.toLowerCase().includes(searchLower)) return true;
        if (project.project_nummer && project.project_nummer.toLowerCase().includes(searchLower)) return true;
      }
    }

    if (registratie.project_naam && registratie.project_naam.toLowerCase().includes(searchLower)) return true;
    if (registratie.werkomschrijving.toLowerCase().includes(searchLower)) return true;

    return false;
  });

  // Pagination
  const totalItems = filteredRegistraties.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRegistraties = filteredRegistraties.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDateFilter, endDateFilter, workCodeFilter, userFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 rounded-md">
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {formError && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{formError}</p>
            </div>
          </div>
        </div>
      )}

      {/* New Registration Form */}
      {showNewRegistration && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('nieuweRegistratie')} (V2)</h1>
            <button
              onClick={() => {
                setShowNewRegistration(false);
                setShowOverview(true);
              }}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              <span>{t('overzicht')}</span>
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-md font-medium text-gray-700 dark:text-gray-300 mb-4">{t('basisInformatie')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('datum')} *</label>
                    <input
                      type="date"
                      name="datum"
                      value={formData.datum}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('project')} *</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={selectedProject?.id || ''}
                        onChange={(e) => {
                          const project = projecten.find(p => p.id === e.target.value);
                          setSelectedProject(project || null);
                        }}
                        required
                        className="flex-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                      >
                        <option value="">Selecteer een project</option>
                        {projecten.map((project: any) => (
                          <option key={project.id} value={project.id}>
                            {project.naam} {project.project_nummer ? `(#${project.project_nummer})` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowConfirmProjectModal(true)}
                        className="w-full sm:w-auto px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center justify-center"
                        title="Snel nieuw project aanmaken"
                      >
                        <Plus size={20} />
                        <span className="ml-2 sm:hidden">Nieuw Project</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Voortgang project (%)</label>
                  <input
                    type="number"
                    name="voortgang"
                    value={formData.voortgang}
                    onChange={handleInputChange}
                    min="0"
                    max="100"
                    placeholder="0-100"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('optioneelGeefAanHoeveelProcent')}</p>
                </div>

                {/* Kilometers */}
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gereden kilometers</label>
                    <div className="group relative">
                      <Info size={16} className="text-gray-400 cursor-help" />
                      <div className="invisible group-hover:visible absolute z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded-md shadow-lg -top-2 left-6">
                        Dit zijn kilometers die niet met een zakelijke auto gereden worden en ook geen woon-werk kilometers zijn.
                      </div>
                    </div>
                  </div>
                  <input
                    type="number"
                    name="kilometers"
                    value={formData.kilometers}
                    onChange={handleInputChange}
                    min="0"
                    step="0.1"
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
              </div>

              {/* Work Lines with Bewakingscodes */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Werkregels (Bewakingscodes)</h3>
                  <button
                    type="button"
                    onClick={addWorkLine}
                    className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                  >
                    <Plus size={16} />
                    Regel toevoegen
                  </button>
                </div>

                <div className="space-y-3">
                  {workLines.map((line, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Regel {index + 1}</span>
                        {workLines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeWorkLine(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Minus size={18} />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Bewakingscode *</label>
                          <select
                            value={line.work_code_id}
                            onChange={(e) => updateWorkLine(index, 'work_code_id', e.target.value)}
                            required
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          >
                            <option value="">Selecteer bewakingscode</option>
                            {workCodes.map((wc) => (
                              <option key={wc.id} value={wc.id}>
                                {wc.code} - {wc.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('aantalUren')} *</label>
                          <input
                            type="number"
                            value={line.aantal_uren || ''}
                            onChange={(e) => updateWorkLine(index, 'aantal_uren', parseFloat(e.target.value) || 0)}
                            step="0.5"
                            min="0"
                            required
                            placeholder="bv. 8 of 4.5"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          />
                        </div>

                        <div className="md:col-span-1">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('werkomschrijving')} *</label>
                          <input
                            type="text"
                            value={line.werkomschrijving}
                            onChange={(e) => updateWorkLine(index, 'werkomschrijving', e.target.value)}
                            required
                            placeholder="Beschrijf het uitgevoerde werk"
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          />
                        </div>
                      </div>

                      {/* Materials Section */}
                      <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Materialen (optioneel)</label>
                          <button
                            type="button"
                            onClick={() => addMaterialToWorkLine(index)}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                          >
                            <Plus size={14} />
                            Materiaal
                          </button>
                        </div>

                        {line.materials && line.materials.length > 0 && (
                          <div className="space-y-2">
                            {line.materials.map((material, matIdx) => (
                              <div key={matIdx} className="border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
                                <div className="p-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => updateMaterial(index, matIdx, 'type', material.type === 'product' ? 'description' : 'product')}
                                      className={`px-2 py-1 text-xs rounded ${material.type === 'product' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'}`}
                                    >
                                      Product
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateMaterial(index, matIdx, 'type', material.type === 'description' ? 'product' : 'description')}
                                      className={`px-2 py-1 text-xs rounded ${material.type === 'description' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'}`}
                                    >
                                      Omschrijving
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeMaterialFromWorkLine(index, matIdx)}
                                    className="text-red-600 hover:text-red-800"
                                  >
                                    <X size={16} />
                                  </button>
                                </div>

                                <div className="p-2">
                                  {material.type === 'product' ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <div className="md:col-span-2">
                                        <select
                                          value={material.product_id || ''}
                                          onChange={(e) => updateMaterial(index, matIdx, 'product_id', e.target.value)}
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        >
                                          <option value="">Selecteer product</option>
                                          {products.map((product: any) => (
                                            <option key={product.id} value={product.id}>
                                              {product.name} ({product.sku})
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div className="flex gap-2 items-center">
                                        <input
                                          type="number"
                                          value={material.quantity || ''}
                                          onChange={(e) => updateMaterial(index, matIdx, 'quantity', parseFloat(e.target.value) || 0)}
                                          placeholder="Aantal"
                                          min="0"
                                          step="0.1"
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <span className="text-xs text-gray-600 dark:text-gray-400 min-w-[40px]">{material.unit || '-'}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                      <div className="md:col-span-2">
                                        <input
                                          type="text"
                                          value={material.description || ''}
                                          onChange={(e) => updateMaterial(index, matIdx, 'description', e.target.value)}
                                          placeholder="Beschrijving materiaal"
                                          className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                      </div>
                                      <div className="flex gap-2 items-center">
                                        <input
                                          type="number"
                                          value={material.quantity || ''}
                                          onChange={(e) => updateMaterial(index, matIdx, 'quantity', parseFloat(e.target.value) || 0)}
                                          placeholder="Aantal"
                                          min="0"
                                          step="0.1"
                                          className="w-20 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                        <input
                                          type="text"
                                          value={material.unit || ''}
                                          onChange={(e) => updateMaterial(index, matIdx, 'unit', e.target.value)}
                                          placeholder="Eenheid"
                                          className="w-20 px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total Hours */}
                <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    <strong>Totaal uren:</strong> {workLines.reduce((sum, line) => sum + (line.aantal_uren || 0), 0).toFixed(1)} uur
                  </p>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewRegistration(false);
                    setShowOverview(true);
                  }}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('annuleren')}
                </button>
                <button
                  type="submit"
                  disabled={mutationLoading}
                  className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {mutationLoading ? 'Opslaan...' : t('registratieOpslaan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Overview */}
      {showOverview && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('urenregistratie')} V2</h1>
            <div className="flex space-x-3">
              {hasPermission('export_data') && (
                <button
                  onClick={handleExport}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Download size={16} />
                  <span>{t('exporteren')}</span>
                </button>
              )}
              <button
                onClick={() => {
                  setShowNewRegistration(true);
                  setShowOverview(false);
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <Plus size={16} />
                <span>{t('nieuweRegistratie')}</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {hasPermission('view_reports') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gebruiker</label>
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value="">Alle gebruikers</option>
                    {gebruikers.map((gebruiker: any) => (
                      <option key={gebruiker.id} value={gebruiker.id}>
                        {gebruiker.naam}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Periode</label>
                <select
                  value={dateRangeFilter}
                  onChange={(e) => handleDateRangeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="custom">Aangepast</option>
                  <option value="deze-week">Deze week</option>
                  <option value="deze-maand">Deze maand</option>
                  <option value="dit-jaar">Dit jaar</option>
                </select>
              </div>
              <DatePickerField
                label={t('vanDatum')}
                value={startDateFilter}
                onChange={(date) => {
                  setStartDateFilter(date);
                  setDateRangeFilter('custom');
                }}
                placeholder={t('dateInputPlaceholder')}
              />
              <DatePickerField
                label={t('totDatum')}
                value={endDateFilter}
                onChange={(date) => {
                  setEndDateFilter(date);
                  setDateRangeFilter('custom');
                }}
                placeholder={t('dateInputPlaceholder')}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bewakingscode</label>
                <select
                  value={workCodeFilter}
                  onChange={(e) => setWorkCodeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="all">Alle codes</option>
                  {workCodes.map((wc) => (
                    <option key={wc.id} value={wc.id}>
                      {wc.code} - {wc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <input
                type="text"
                placeholder={t('zoekProjectOfOrdernummer')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-80 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>

          {/* Registrations Table */}
          {filteredRegistraties.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow mt-6">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  {searchTerm ? `Zoekresultaten (${filteredRegistraties.length})` : `Registraties (${filteredRegistraties.length})`}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('datum')}</th>
                      {hasPermission('view_reports') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Gebruiker</th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Project</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bewakingscode</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('aantalUren')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('werkomschrijving')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('acties')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedRegistraties.map((registratie) => {
                      const hasExtraInfo = (registratie.driven_kilometers && registratie.driven_kilometers > 0) ||
                                          (registratie.materials && registratie.materials.length > 0);
                      const isExpanded = expandedRows.has(registratie.id);

                      return (
                        <React.Fragment key={registratie.id}>
                          <tr className={`${isExpanded ? 'bg-gray-50 dark:bg-gray-900' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {formatDate(registratie.datum)}
                            </td>
                            {hasPermission('view_reports') && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {gebruikers.find((g: any) => g.id === registratie.user_id)?.naam || 'Onbekend'}
                              </td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {registratie.project_id ?
                                projecten.find(p => p.id === registratie.project_id)?.naam || 'Onbekend project' :
                                '-'
                              }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {registratie.werktype}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {registratie.aantal_uren.toString().replace('.', ',')}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs">
                              <div className="break-words">{registratie.werkomschrijving}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2 items-center">
                                {hasExtraInfo && (
                                  <button
                                    onClick={() => toggleRowExpansion(registratie.id)}
                                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                                    title={isExpanded ? 'Verberg details' : 'Toon details'}
                                  >
                                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                  </button>
                                )}
                                {isRegistrationEditable(registratie) && (
                                  <>
                                    <button
                                      onClick={() => handleEditRegistration(registratie)}
                                      className="text-blue-600 hover:text-blue-900"
                                      title="Bewerken"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    {hasPermission('approve_hours') && (
                                      <button
                                        onClick={() => handleDeleteRegistration(registratie.id)}
                                        className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                                        title="Verwijderen"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && hasExtraInfo && (
                            <tr className="bg-gray-50 dark:bg-gray-900">
                              <td colSpan={hasPermission('view_reports') ? 7 : 6} className="px-6 py-4">
                                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {registratie.driven_kilometers && registratie.driven_kilometers > 0 && (
                                      <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-4 rounded-lg shadow-sm">
                                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Kilometers</div>
                                        <div className="text-2xl font-bold text-gray-900 dark:text-white">
                                          {registratie.driven_kilometers.toString().replace('.', ',')} km
                                        </div>
                                      </div>
                                    )}
                                    {registratie.materials && registratie.materials.length > 0 && (
                                      <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-4 rounded-lg shadow-sm">
                                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-3">Materialen</div>
                                        <div className="space-y-2">
                                          {registratie.materials.map((mat: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 dark:border-gray-600 last:border-0">
                                              <span className="font-medium text-gray-900 dark:text-white">
                                                {mat.type === 'product' ? mat.product_name : mat.description}
                                              </span>
                                              <span className="text-gray-600 dark:text-gray-400 font-semibold">{mat.quantity} {mat.unit}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-700 dark:text-gray-300">Toon:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-gray-700 dark:text-gray-300">resultaten per pagina</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Pagina {currentPage} van {totalPages} ({totalItems} resultaten)
                  </span>

                  <div className="flex space-x-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                    >
                      «
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-gray-700 dark:text-gray-300"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-gray-700 dark:text-gray-300"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
                    >
                      »
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {filteredRegistraties.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">Geen registraties gevonden voor de geselecteerde filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingRegistration(null);
        }}
        title="Urenregistratie bewerken"
      >
        {editingRegistration && (
          <form onSubmit={handleUpdateRegistration} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('datum')} *</label>
              <input
                type="date"
                value={editingRegistration.datum}
                onChange={(e) => setEditingRegistration({ ...editingRegistration, datum: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('project')}</label>
              <select
                value={editingRegistration.project_id || ''}
                onChange={(e) => setEditingRegistration({ ...editingRegistration, project_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Selecteer een project</option>
                {projecten.map((project: any) => (
                  <option key={project.id} value={project.id}>
                    {project.naam}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bewakingscode *</label>
              <select
                value={editingRegistration.werk_code_id || ''}
                onChange={(e) => setEditingRegistration({ ...editingRegistration, werk_code_id: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Selecteer bewakingscode</option>
                {workCodes.map((wc) => (
                  <option key={wc.id} value={wc.id}>
                    {wc.code} - {wc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('aantalUren')} *</label>
              <input
                type="number"
                step="0.5"
                value={editingRegistration.aantalUren}
                onChange={(e) => setEditingRegistration({ ...editingRegistration, aantalUren: e.target.value })}
                required
                min="0.5"
                max="24"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('werkomschrijving')} *</label>
              <textarea
                value={editingRegistration.werkomschrijving}
                onChange={(e) => setEditingRegistration({ ...editingRegistration, werkomschrijving: e.target.value })}
                rows={4}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRegistration(null);
                }}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('annuleren')}
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                {t('opslaan')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmProjectModal}
        onClose={() => setShowConfirmProjectModal(false)}
        title="Project Niet Gevonden?"
      >
        <div className="space-y-6">
          <p className="text-gray-700 dark:text-gray-300">
            Weet je zeker dat het project niet in het keuzemenu staat?
          </p>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowConfirmProjectModal(false)}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Nee
            </button>
            <button
              onClick={() => {
                setShowConfirmProjectModal(false);
                setShowQuickProjectModal(true);
              }}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Ja
            </button>
          </div>
        </div>
      </Modal>

      {/* Quick Project Modal */}
      <Modal
        isOpen={showQuickProjectModal}
        onClose={() => {
          setShowQuickProjectModal(false);
          setQuickProjectName('');
        }}
        title="Snel Project Aanmaken"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Maak snel een nieuw project aan. Kantoorpersoneel zal later de details aanvullen.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Projectnaam *</label>
            <input
              type="text"
              value={quickProjectName}
              onChange={(e) => setQuickProjectName(e.target.value)}
              placeholder="Bijv: Renovatie Hoofdstraat 123"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleQuickProjectCreate();
                }
              }}
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowQuickProjectModal(false);
                setQuickProjectName('');
              }}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Annuleren
            </button>
            <button
              onClick={handleQuickProjectCreate}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Aanmaken
            </button>
          </div>
        </div>
      </Modal>

      {/* Project Creating Modal */}
      <Modal
        isOpen={showProjectCreatingModal}
        onClose={() => {}}
        title="Project Aanmaken"
      >
        <div className="py-8">
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-red-200 rounded-full"></div>
              <div className="absolute top-0 left-0 w-20 h-20 border-4 border-red-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Project wordt aangemaakt...</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Even geduld, we maken het project aan.</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">De pagina wordt automatisch ververst...</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UrenregistratieV2;
