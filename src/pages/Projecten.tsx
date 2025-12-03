import React, { useState, useEffect } from 'react';
import { FolderOpen, Plus, Calendar, Users, Clock, BarChart3, Eye, Search, Archive, Check } from 'lucide-react';
import DatePicker from 'react-datepicker';
import { nl } from 'date-fns/locale';
import { useLanguage } from '../contexts/LanguageContext';
import { useSupabaseQuery, useSupabaseMutation } from '../hooks/useSupabase';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Project, UrenRegistratie } from '../types';
import { formatDate } from '../utils/dateUtils';
import Modal from '../components/Modal';
import SupabaseErrorHelper from '../components/SupabaseErrorHelper';
import ProjectDetailsModal from '../components/ProjectDetailsModal';
import ProjectWorkCodesSelector from '../components/ProjectWorkCodesSelector';

interface WorkCode {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

const Projecten: React.FC = () => {
  const { t } = useLanguage();
  const { user, hasPermission } = useAuth();
  const { data: allProjecten, loading, refetch } = useSupabaseQuery<any>('projects');
  const { data: urenRegistraties = [] } = useSupabaseQuery<any>('time_registrations', 'id, user_id, project_id, datum, aantal_uren, werktype, werkomschrijving, locatie, status, project_naam, progress_percentage, created_at, updated_at, driven_kilometers');
  const { data: gebruikers = [] } = useSupabaseQuery<any>('profiles', 'id, naam');
  const { data: systemSettings = [] } = useSupabaseQuery<any>('system_settings');

  // Work codes for new project creation
  const [allWorkCodes, setAllWorkCodes] = useState<WorkCode[]>([]);
  const [selectedWorkCodeIds, setSelectedWorkCodeIds] = useState<string[]>([]);
  const [workCodesLoading, setWorkCodesLoading] = useState(false);

  // Filter projects based on user role and status
  const filteredByRole = hasPermission('view_reports')
    ? (allProjecten || [])
    : (allProjecten || []).filter((project: any) =>
        urenRegistraties.some((reg: any) => reg.project_id === project.id && reg.user_id === user?.id)
      );

  // Filter active vs archived projects
  const projecten = filteredByRole.filter((project: any) => project.status === 'actief');
  const archivedProjecten = filteredByRole.filter((project: any) =>
    project.status === 'gepauzeerd' || project.status === 'voltooid'
  );

  // Debug logging
  useEffect(() => {
    console.log('All projecten:', allProjecten);
    console.log('Active projecten:', projecten);
    console.log('Archived projecten:', archivedProjecten);
  }, [allProjecten, projecten, archivedProjecten]);

  // Load work codes for new project creation
  const loadWorkCodes = async () => {
    setWorkCodesLoading(true);
    try {
      const { data, error } = await supabase
        .from('work_codes')
        .select('*')
        .eq('is_active', true)
        .order('code', { ascending: true });

      if (error) throw error;
      setAllWorkCodes(data || []);
      // Select all work codes by default for new projects
      setSelectedWorkCodeIds((data || []).map((wc: WorkCode) => wc.id));
    } catch (err) {
      console.error('Error loading work codes:', err);
    } finally {
      setWorkCodesLoading(false);
    }
  };

  // Load work codes when modal opens for new project
  useEffect(() => {
    if (showModal && !editingProject) {
      loadWorkCodes();
    }
  }, [showModal, editingProject]);
  const { insert: insertProject, update: updateProject, remove: deleteProject, loading: mutationLoading } = useSupabaseMutation('projects');
  const [showModal, setShowModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [lastError, setLastError] = useState<any>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deleteConfirmProject, setDeleteConfirmProject] = useState<string | null>(null);
  const [selectedProjectForDetails, setSelectedProjectForDetails] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [archiveSearchTerm, setArchiveSearchTerm] = useState('');
  const [showArchive, setShowArchive] = useState(false);

  const [formData, setFormData] = useState({
    naam: '',
    beschrijving: '',
    startDatum: '',
    status: 'actief' as const,
    project_nummer: '',
    progressPercentage: '',
    calculatedHours: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.naam || !formData.beschrijving || !formData.startDatum) {
      alert(t('vulVerplichtVelden'));
      return;
    }

    const baseProjectData = {
      naam: formData.naam,
      beschrijving: formData.beschrijving,
      start_datum: formData.startDatum,
      status: formData.status,
      estimated_hours: null,
      progress_percentage: formData.progressPercentage ? parseInt(formData.progressPercentage) : (editingProject ? editingProject.progress_percentage || 0 : 0),
      project_nummer: formData.project_nummer || null,
      calculated_hours: formData.calculatedHours ? parseInt(formData.calculatedHours) : null,
    };

    // Only include created_by for new projects (INSERT), not for updates
    const projectData = editingProject
      ? baseProjectData
      : { ...baseProjectData, created_by: user?.id };

    const action = editingProject
      ? updateProject(editingProject.id, projectData)
      : insertProject(projectData);

    action
      .then(async (result) => {
        // If this is a new project and work codes were selected, save them
        if (!editingProject && result && selectedWorkCodeIds.length > 0) {
          try {
            const newProjectId = result.id;
            const workCodeInserts = selectedWorkCodeIds.map(workCodeId => ({
              project_id: newProjectId,
              work_code_id: workCodeId
            }));

            const { error: workCodeError } = await supabase
              .from('project_work_codes')
              .insert(workCodeInserts);

            if (workCodeError) {
              console.error('Error saving work codes:', workCodeError);
              // Don't fail the whole operation, just log the error
            }
          } catch (err) {
            console.error('Error saving work codes:', err);
          }
        }

        setLastError(null);
        setEditingProject(null);
        setFormData({
          naam: '',
          beschrijving: '',
          startDatum: '',
          status: 'actief',
          project_nummer: '',
          progressPercentage: '',
          calculatedHours: '',
        });
        setSelectedWorkCodeIds([]);

        setShowModal(false);
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
        refetch();

        // Trigger a custom event to notify other components that projects were updated
        window.dispatchEvent(new CustomEvent('projectsUpdated'));
      })
      .catch((error) => {
        console.error('Error creating project:', error);
        setLastError(error);
        alert('Er is een fout opgetreden bij het opslaan van het project.');
      });
  };

  const handleNewProject = () => {
    setEditingProject(null);
    setFormData({
      naam: '',
      beschrijving: '',
      startDatum: new Date().toISOString().split('T')[0],
      status: 'actief',
      project_nummer: '',
      progressPercentage: '',
      calculatedHours: '',
    });
    setSelectedWorkCodeIds([]);
    setShowModal(true);
  };

  // Toggle work code selection for new projects
  const toggleWorkCodeSelection = (workCodeId: string) => {
    setSelectedWorkCodeIds(prev => {
      if (prev.includes(workCodeId)) {
        return prev.filter(id => id !== workCodeId);
      } else {
        return [...prev, workCodeId];
      }
    });
  };

  // Select/deselect all work codes
  const toggleAllWorkCodes = () => {
    if (selectedWorkCodeIds.length === allWorkCodes.length) {
      setSelectedWorkCodeIds([]);
    } else {
      setSelectedWorkCodeIds(allWorkCodes.map(wc => wc.id));
    }
  };

  const handleEditProject = (project: any) => {
    setEditingProject(project);
    setFormData({
      naam: project.naam,
      beschrijving: project.beschrijving,
      startDatum: project.start_datum,
      status: project.status,
      project_nummer: project.project_nummer || '',
      progressPercentage: project.progress_percentage?.toString() || '',
      calculatedHours: project.calculated_hours?.toString() || '',
    });
    setShowModal(true);
  };

  // Calculate total logged hours for a project
  const getTotalLoggedHours = (projectId: string): number => {
    return urenRegistraties
      .filter(reg => reg.project_id === projectId)
      .reduce((total, reg) => {
        // Convert aantal_uren to number (it comes as string from DB)
        const uren = parseFloat(reg.aantal_uren) || 0;
        return total + uren;
      }, 0);
  };

  // Get registrations for a specific project
  const getProjectRegistrations = (projectId: string) => {
    const allRegs = urenRegistraties.filter((reg: any) => reg.project_id === projectId);
    // Filter for current user if not admin/kantoorpersoneel
    if (!hasPermission('view_reports')) {
      return allRegs.filter((reg: any) => reg.user_id === user?.id);
    }
    return allRegs;
  };

  // Get unique users who worked on a project
  const getProjectUsers = (projectId: string) => {
    const registrations = getProjectRegistrations(projectId);
    const userIds = new Set(registrations.map((reg: any) => reg.user_id));
    return Array.from(userIds).map(userId => {
      const gebruiker = gebruikers.find((g: any) => g.id === userId);
      const userRegistrations = registrations.filter((reg: any) => reg.user_id === userId);
      const totalHours = userRegistrations.reduce((sum: number, reg: any) => {
        const uren = parseFloat(reg.aantal_uren) || 0;
        return sum + uren;
      }, 0);
      return {
        userId,
        naam: gebruiker?.naam || 'Onbekende gebruiker',
        totalHours,
        registrations: userRegistrations
      };
    });
  };

  // Get total kilometers for a project
  const getTotalKilometers = (projectId: string) => {
    const registrations = getProjectRegistrations(projectId);
    return registrations.reduce((sum: number, reg: any) => {
      const km = parseFloat(reg.driven_kilometers) || 0;
      return sum + km;
    }, 0);
  };

  // Get all materials used in a project
  const getProjectMaterials = (projectId: string) => {
    const registrations = getProjectRegistrations(projectId);
    const materialsMap = new Map();

    registrations.forEach((reg: any) => {
      if (reg.materials && Array.isArray(reg.materials)) {
        reg.materials.forEach((material: any) => {
          const key = material.product_id;
          if (materialsMap.has(key)) {
            const existing = materialsMap.get(key);
            existing.quantity += parseFloat(material.quantity) || 0;
          } else {
            materialsMap.set(key, {
              product_id: material.product_id,
              product_name: material.product_name,
              quantity: parseFloat(material.quantity) || 0,
              unit: material.unit
            });
          }
        });
      }
    });

    return Array.from(materialsMap.values());
  };

  // Check if project is incomplete (created by employees/ZZPers, awaiting admin completion)
  const isProjectIncomplete = (project: any) => {
    return (
      project.beschrijving === 'Aangemaakt door medewerker - nog in te vullen' ||
      !project.project_nummer
    );
  };

  const getMissingFields = (project: any): string[] => {
    const missing: string[] = [];

    if (project.beschrijving === 'Aangemaakt door medewerker - nog in te vullen') {
      missing.push('Beschrijving');
    }
    if (!project.project_nummer) {
      missing.push('Projectnummer');
    }

    return missing;
  };

  // Filter projects based on search term
  const filteredProjecten = projecten.filter((project: any) => {
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();
    return (
      project.naam?.toLowerCase().includes(searchLower) ||
      project.project_nummer?.toLowerCase().includes(searchLower) ||
      project.beschrijving?.toLowerCase().includes(searchLower)
    );
  });

  // Handle project deletion
  const handleDeleteProject = async (projectId: string) => {
    try {
      // First delete all time registrations associated with this project
      const { error: timeRegError } = await supabase
        .from('time_registrations')
        .delete()
        .eq('project_id', projectId);

      if (timeRegError) {
        console.error('Error deleting time registrations:', timeRegError);
        throw timeRegError;
      }

      // Then delete the project
      await deleteProject(projectId);
      setDeleteConfirmProject(null);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
      refetch();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Er is een fout opgetreden bij het verwijderen van het project.');
    }
  };

  const handleArchiveProject = async (projectId: string) => {
    try {
      const result = await updateProject(projectId, { status: 'voltooid' });
      console.log('Archive result:', result);

      setShowModal(false);
      setEditingProject(null);
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);

      // Force refetch to update the lists
      await refetch();
    } catch (error) {
      console.error('Error archiving project:', error);
      alert('Er is een fout opgetreden bij het archiveren van het project.');
    }
  };

  const handleUnarchiveProject = async (projectId: string) => {
    try {
      const result = await updateProject(projectId, { status: 'actief' });
      console.log('Unarchive result:', result);

      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);

      // Force refetch to update the lists
      await refetch();
    } catch (error) {
      console.error('Error unarchiving project:', error);
      alert('Er is een fout opgetreden bij het herstellen van het project.');
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
          {t('projectOpgeslagen')}
        </div>
      )}
      
      <SupabaseErrorHelper 
        error={lastError} 
        table="projects" 
        operation="INSERT" 
      />
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center space-x-3">
          <FolderOpen className="text-red-600" />
          <span>{t('projecten')}</span>
        </h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowArchive(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          >
            <Archive size={16} />
            <span>Archief</span>
          </button>
          <button
            onClick={handleNewProject}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            <Plus size={16} />
            <span>{t('nieuwProject')}</span>
          </button>
        </div>
      </div>

      {/* Projecten Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{t('projectOverzicht')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">{t('beheerProjecten')}</p>
        </div>

        {/* Search Bar (Only for Admins and Kantoor) */}
        {hasPermission('view_reports') && projecten.length > 0 && (
          <div className="px-6 pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Zoek project op naam, nummer of beschrijving..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            {searchTerm && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {filteredProjecten.length} {filteredProjecten.length === 1 ? 'project gevonden' : 'projecten gevonden'}
              </p>
            )}
          </div>
        )}

        <div className="p-6">
          {projecten.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">{t('geenProjecten')}</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                {t('voegProjectToe')}
              </p>
              <button
                onClick={handleNewProject}
                className="mt-4 flex items-center space-x-2 mx-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <Plus size={16} />
                <span>{t('nieuwProject')}</span>
              </button>
            </div>
          ) : filteredProjecten.length === 0 ? (
            <div className="text-center py-12">
              <Search className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">Geen projecten gevonden</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
                Probeer een andere zoekterm
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjecten.map((project) => {
                const projectUsers = getProjectUsers(project.id);
                const totalHours = getTotalLoggedHours(project.id);
                const incomplete = isProjectIncomplete(project);
                const calculatedHours = project.calculated_hours || 0;
                const hoursPercentage = calculatedHours > 0 ? Math.min((totalHours / calculatedHours) * 100, 100) : 0;
                const isOverBudget = calculatedHours > 0 && totalHours > calculatedHours;

                return (
                  <div
                    key={project.id}
                    className={`rounded-xl border-2 overflow-hidden transition-all hover:shadow-lg cursor-pointer ${
                      incomplete
                        ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-600'
                    }`}
                    onClick={() => setSelectedProjectForDetails(project)}
                  >
                    {/* Main Content Row */}
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Left: Project Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3">
                            {/* Status Indicator */}
                            <div className={`flex-shrink-0 w-2 h-14 rounded-full ${
                              project.status === 'actief' ? 'bg-green-500' :
                              project.status === 'voltooid' ? 'bg-blue-500' :
                              'bg-yellow-500'
                            }`} />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                  {project.naam}
                                </h3>
                                <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                                  project.status === 'actief' ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' :
                                  project.status === 'voltooid' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' :
                                  'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
                                }`}>
                                  {t(project.status)}
                                </span>
                              </div>

                              <div className="flex items-center gap-4 mt-1 text-sm">
                                <span className="font-mono text-gray-600 dark:text-gray-400">
                                  #{project.project_nummer || <span className="text-red-500">Geen nummer</span>}
                                </span>
                                <span className="text-gray-400 dark:text-gray-500">•</span>
                                <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                  <Calendar size={14} />
                                  {formatDate(project.start_datum)}
                                </span>
                              </div>

                              {/* Description */}
                              <p className="text-gray-600 dark:text-gray-400 text-sm mt-2 line-clamp-1">
                                {project.beschrijving === 'Aangemaakt door medewerker - nog in te vullen'
                                  ? <span className="text-red-500 italic">Beschrijving nog in te vullen</span>
                                  : project.beschrijving
                                }
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Right: Stats */}
                        <div className="flex flex-wrap items-center gap-3 lg:gap-6">
                          {/* Hours */}
                          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2 min-w-[100px]">
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Uren</div>
                            <div className={`text-xl font-bold ${isOverBudget ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                              {totalHours.toFixed(1)}
                              {calculatedHours > 0 && (
                                <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                                  /{calculatedHours}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Progress */}
                          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2 min-w-[120px]">
                            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Voortgang</div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden w-16">
                                <div
                                  className="h-full bg-red-600 rounded-full transition-all"
                                  style={{ width: `${project.progress_percentage || 0}%` }}
                                />
                              </div>
                              <span className="text-lg font-bold text-gray-900 dark:text-white">
                                {project.progress_percentage || 0}%
                              </span>
                            </div>
                          </div>

                          {/* Users (only for admins) */}
                          {hasPermission('view_reports') && (
                            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Team</div>
                              <div className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-1">
                                <Users size={16} className="text-gray-400" />
                                {projectUsers.length}
                              </div>
                            </div>
                          )}

                          {/* View Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedProjectForDetails(project);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                          >
                            <Eye size={16} />
                            <span className="hidden sm:inline">Details</span>
                          </button>
                        </div>
                      </div>

                      {/* Warning Banner for Incomplete Projects */}
                      {incomplete && hasPermission('view_reports') && (
                        <div className="mt-3 flex items-center gap-2 p-2 bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 rounded-lg text-sm text-red-700 dark:text-red-300">
                          <span className="text-lg">⚠️</span>
                          <span className="font-medium">Actie vereist:</span>
                          <span>Vul ontbrekende velden in: {getMissingFields(project).join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* New Project Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingProject ? t('editProject') : t('nieuwProject')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('projectNaam')} *</label>
              <input
                type="text"
                name="naam"
                value={formData.naam}
                onChange={handleInputChange}
                required
                placeholder="Bijv. Renovatie kantoorpand"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('projectNumber')}</label>
              <input
                type="text"
                name="project_nummer"
                value={formData.project_nummer}
                onChange={handleInputChange}
                placeholder="Bijv. 2024-001"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('startDatum')} *</label>
              <div className="relative">
                <input
                  type="date"
                  name="startDatum"
                  value={formData.startDatum}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-3 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
                />
                <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-gray-400 dark:text-gray-500" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('projectStatus')} *</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="actief">{t('actief')}</option>
              <option value="gepauzeerd">{t('gepauzeerd')}</option>
              <option value="voltooid">{t('voltooid')}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Voortgang (%)</label>
            <input
              type="number"
              name="progressPercentage"
              value={formData.progressPercentage}
              onChange={handleInputChange}
              min="0"
              max="100"
              placeholder="0-100"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('optioneelGeefAanHoeveelProcent')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gecalculeerde Uren</label>
            <input
              type="number"
              name="calculatedHours"
              value={formData.calculatedHours}
              onChange={handleInputChange}
              min="0"
              placeholder="Geschatte uren voor dit project"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Optioneel: vul in hoeveel uren je verwacht nodig te hebben voor dit project</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('projectBeschrijving')} *</label>
            <textarea
              name="beschrijving"
              value={formData.beschrijving}
              onChange={handleInputChange}
              rows={4}
              required
              placeholder={t('beschrijfProject')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {/* Bewakingscodes per Project */}
          <div className="border-t pt-4">
            <h3 className="text-md font-semibold text-gray-800 dark:text-white mb-3">Bewakingscodes voor dit Project</h3>

            {editingProject ? (
              // Use existing ProjectWorkCodesSelector for editing
              <ProjectWorkCodesSelector
                projectId={editingProject.id}
                readOnly={!hasPermission('manage_projects')}
              />
            ) : (
              // Show simple selector for new projects
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Selecteer welke bewakingscodes beschikbaar zijn voor dit project. Standaard zijn alle codes geselecteerd.
                </p>

                {workCodesLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
                  </div>
                ) : allWorkCodes.length > 0 ? (
                  <>
                    {/* Select All / Deselect All button */}
                    <div className="flex justify-end mb-2">
                      <button
                        type="button"
                        onClick={toggleAllWorkCodes}
                        className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {selectedWorkCodeIds.length === allWorkCodes.length ? 'Alles deselecteren' : 'Alles selecteren'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {allWorkCodes.map(wc => {
                        const selected = selectedWorkCodeIds.includes(wc.id);
                        return (
                          <button
                            key={wc.id}
                            type="button"
                            onClick={() => toggleWorkCodeSelection(wc.id)}
                            className={`flex items-center justify-between p-2 rounded border text-left text-sm transition-colors ${
                              selected
                                ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200'
                                : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                            } cursor-pointer`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                                selected ? 'bg-red-200 dark:bg-red-800' : 'bg-gray-100 dark:bg-gray-600'
                              }`}>
                                {wc.code}
                              </span>
                              <span className="truncate">{wc.name}</span>
                            </div>
                            {selected && <Check size={16} className="text-red-600 dark:text-red-400 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {selectedWorkCodeIds.length} van {allWorkCodes.length} bewakingscode(s) geselecteerd
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic py-2">
                    Geen bewakingscodes beschikbaar. Voeg ze eerst toe via Instellingen → Bewakingscodes.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col space-y-3 pt-4">
            {editingProject && editingProject.status === 'actief' && hasPermission('manage_projects') && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Weet je zeker dat je dit project wilt voltooien en archiveren? Het project komt niet meer voor bij urenregistratie.')) {
                    await handleArchiveProject(editingProject.id);
                  }
                }}
                className="w-full px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Archive size={18} />
                <span>Voltooien en Archiveren</span>
              </button>
            )}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {t('annuleren')}
              </button>
              <button
                type="submit"
                disabled={mutationLoading}
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                {mutationLoading ? 'Opslaan...' : t('opslaan')}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deleteConfirmProject && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirmProject(null)}
          title="Project Verwijderen"
        >
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-gray-700 dark:text-gray-300">
                Weet je zeker dat je dit project wilt verwijderen?
              </p>
              <p className="text-red-600 dark:text-red-400 font-medium text-sm">
                Let op: Alle urenregistraties die aan dit project gekoppeld zijn worden ook permanent verwijderd. Deze actie kan niet ongedaan worden gemaakt.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmProject(null)}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={() => handleDeleteProject(deleteConfirmProject)}
                className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Project Details Modal */}
      {selectedProjectForDetails && (
        <ProjectDetailsModal
          isOpen={true}
          onClose={() => setSelectedProjectForDetails(null)}
          project={selectedProjectForDetails}
          totalHours={getTotalLoggedHours(selectedProjectForDetails.id)}
          projectUsers={getProjectUsers(selectedProjectForDetails.id)}
          projectRegistrations={getProjectRegistrations(selectedProjectForDetails.id)}
          onEdit={() => {
            handleEditProject(selectedProjectForDetails);
            setSelectedProjectForDetails(null);
          }}
          onDelete={() => {
            setDeleteConfirmProject(selectedProjectForDetails.id);
            setSelectedProjectForDetails(null);
          }}
          gebruikers={gebruikers}
          hasEditPermission={hasPermission('manage_projects')}
        />
      )}

      {/* Archive Modal */}
      <Modal
        isOpen={showArchive}
        onClose={() => setShowArchive(false)}
        title="Projecten Archief"
      >
        <div className="space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Zoek in gearchiveerde projecten..."
              value={archiveSearchTerm}
              onChange={(e) => setArchiveSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          {archivedProjecten.filter((project: any) => {
            if (!archiveSearchTerm.trim()) return true;
            const searchLower = archiveSearchTerm.toLowerCase();
            return (
              project.naam?.toLowerCase().includes(searchLower) ||
              project.project_nummer?.toLowerCase().includes(searchLower) ||
              project.beschrijving?.toLowerCase().includes(searchLower)
            );
          }).length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              {archiveSearchTerm ? 'Geen gearchiveerde projecten gevonden met deze zoekopdracht' : 'Geen gearchiveerde projecten gevonden'}
            </p>
          ) : (
            <div className="max-h-[600px] overflow-y-auto space-y-4">
              {archivedProjecten.filter((project: any) => {
                if (!archiveSearchTerm.trim()) return true;
                const searchLower = archiveSearchTerm.toLowerCase();
                return (
                  project.naam?.toLowerCase().includes(searchLower) ||
                  project.project_nummer?.toLowerCase().includes(searchLower) ||
                  project.beschrijving?.toLowerCase().includes(searchLower)
                );
              }).map((project: any) => {
                const totalHours = getTotalLoggedHours(project.id);
                const totalKm = getTotalKilometers(project.id);
                const projectUsers = getProjectUsers(project.id);
                const materials = getProjectMaterials(project.id);
                const inventoryEnabled = systemSettings.find((s: any) => s.module_name === 'voorraad')?.is_enabled;

                return (
                  <div
                    key={project.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-lg">{project.naam}</h3>
                        {project.project_nummer && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">#{project.project_nummer}</p>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-medium rounded-full ${
                          project.status === 'voltooid'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {project.status === 'voltooid' ? t('voltooid') : t('gepauzeerd')}
                      </span>
                    </div>

                    <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">{project.beschrijving}</p>

                    {/* Project Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 mb-4 bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                      <div className="flex items-center space-x-2">
                        <Calendar size={16} className="text-gray-500 dark:text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Start datum</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(project.start_datum)}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock size={16} className="text-gray-500 dark:text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Totaal uren</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{totalHours.toFixed(1)}h</p>
                        </div>
                      </div>
                      {totalKm > 0 && (
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Kilometers</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{totalKm.toFixed(1)} km</p>
                          </div>
                        </div>
                      )}
                      {hasPermission('view_reports') && (
                        <div className="flex items-center space-x-2">
                          <Users size={16} className="text-gray-500 dark:text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Medewerkers</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{projectUsers.length}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Materials Used */}
                    {inventoryEnabled && materials.length > 0 && (
                      <div className="mb-4 border-t border-gray-200 dark:border-gray-700 pt-3">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Gebruikte materialen:</h4>
                        <div className="space-y-1">
                          {materials.slice(0, 3).map((material: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs">
                              <span className="text-gray-600 dark:text-gray-300">{material.product_name}</span>
                              <span className="text-gray-900 dark:text-white font-medium">{material.quantity} {material.unit}</span>
                            </div>
                          ))}
                          {materials.length > 3 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 italic">+ {materials.length - 3} meer...</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex space-x-2 mt-4">
                      <button
                        onClick={() => {
                          setSelectedProjectForDetails(project);
                          setShowArchive(false);
                        }}
                        className="flex-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm flex items-center justify-center space-x-1"
                      >
                        <Eye size={16} />
                        <span>Details</span>
                      </button>
                      {hasPermission('manage_projects') && (
                        <button
                          onClick={() => {
                            if (window.confirm('Weet je zeker dat je dit project wilt terugzetten naar actief?')) {
                              handleUnarchiveProject(project.id);
                            }
                          }}
                          className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm flex items-center space-x-1"
                        >
                          <Archive size={16} />
                          <span>Heractiveren</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Projecten;