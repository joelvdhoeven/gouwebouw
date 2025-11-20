import React, { useState, useEffect } from 'react';
import { Download, Plus, Calendar, X, Trash2, Pencil, Minus, Info, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSystemSettings } from '../contexts/SystemSettingsContext';
import { useSupabaseQuery, useSupabaseMutation } from '../hooks/useSupabase';
import { supabase } from '../lib/supabase';
import { UrenRegistratie, Project, WorkLine, MaterialLine } from '../types';
import { exportUrenRegistraties } from '../utils/exportUtils';
import { formatDate } from '../utils/dateUtils';
import ProtectedRoute from '../components/ProtectedRoute';
import Modal from '../components/Modal';
import DatePickerField from '../components/DatePickerField';

const Urenregistratie: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission, user, profile } = useAuth();
  const { settings } = useSystemSettings();

  // Admin and kantoorpersoneel can see all registrations, others only their own
  const canViewAll = profile?.role === 'admin' || profile?.role === 'kantoorpersoneel' || profile?.role === 'superuser';
  const registrationFilters = canViewAll ? {} : { user_id: user?.id };

  const { data: registraties, loading, refetch } = useSupabaseQuery<any>(
    'time_registrations',
    'id, user_id, project_id, datum, werktype, aantal_uren, werkomschrijving, project_naam, locatie, status, created_at, updated_at, progress_percentage, driven_kilometers, materials',
    registrationFilters,
    { order: { column: 'created_at', ascending: false } }
  );

  const { data: allProjecten, refetch: refetchProjects } = useSupabaseQuery<any>('projects');
  // Filter only active projects for time registration
  const projecten = (allProjecten || []).filter((p: any) => p.status === 'actief');

  // Listen for project updates from other pages
  useEffect(() => {
    const handleProjectsUpdated = () => {
      refetchProjects();
    };

    window.addEventListener('projectsUpdated', handleProjectsUpdated);
    return () => {
      window.removeEventListener('projectsUpdated', handleProjectsUpdated);
    };
  }, [refetchProjects]);
  const { data: gebruikers = [] } = useSupabaseQuery<any>('profiles', 'id, naam, email');
  const { data: products = [] } = useSupabaseQuery<any>('inventory_products', 'id, name, sku, unit');
  const { insert: insertRegistration, update: updateRegistration, remove: deleteRegistration, loading: mutationLoading } = useSupabaseMutation('time_registrations');
  const { insert: insertProject } = useSupabaseMutation('projects');
  const [showModal, setShowModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [newProjectModalError, setNewProjectModalError] = useState('');
  const [showProjectCreatingModal, setShowProjectCreatingModal] = useState(false);
  const [showNewRegistration, setShowNewRegistration] = useState(true);
  const [showOverview, setShowOverview] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDateFilter, setStartDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [endDateFilter, setEndDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [typeFilter, setTypeFilter] = useState('alleTypes');
  const [dateRangeFilter, setDateRangeFilter] = useState('custom');
  const [userFilter, setUserFilter] = useState(canViewAll ? '' : (user?.id || ''));
  const [editingRegistration, setEditingRegistration] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pendingTimeRegistration, setPendingTimeRegistration] = useState<any>(null);
  const [newProjectDetails, setNewProjectDetails] = useState({
    naam: '',
    locatie: '',
    beschrijving: '',
  });
  const [showQuickProjectModal, setShowQuickProjectModal] = useState(false);
  const [showConfirmProjectModal, setShowConfirmProjectModal] = useState(false);
  const [quickProjectName, setQuickProjectName] = useState('');
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState({
    datum: new Date().toISOString().split('T')[0],
    ordernummer: '',
    voortgang: '',
    kilometers: '',
  });

  const [workLines, setWorkLines] = useState<WorkLine[]>([
    { werktype: '', werkomschrijving: '', aantal_uren: 0, materials: [] }
  ]);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (formError) {
      setFormError('');
    }
  };

  const handleNewProjectDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewProjectDetails(prev => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (newProjectModalError) {
      setNewProjectModalError('');
    }
  };

  const handleDateRangeChange = (range: string) => {
    setDateRangeFilter(range);
    const today = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (range) {
      case 'deze-week':
        // Get Monday of current week
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
        // Keep current dates
        return;
    }

    setStartDateFilter(startDate.toISOString().split('T')[0]);
    setEndDateFilter(endDate.toISOString().split('T')[0]);
  };

  const addWorkLine = () => {
    setWorkLines([...workLines, { werktype: '', werkomschrijving: '', aantal_uren: 0, materials: [] }]);
  };

  const removeWorkLine = (index: number) => {
    if (workLines.length > 1) {
      setWorkLines(workLines.filter((_, i) => i !== index));
    }
  };

  const updateWorkLine = (index: number, field: keyof WorkLine, value: string | number) => {
    const updated = [...workLines];
    updated[index] = { ...updated[index], [field]: value };
    setWorkLines(updated);
    if (formError) {
      setFormError('');
    }
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.datum || !selectedProject) {
      setFormError('Datum en project zijn verplicht');
      return;
    }

    // Validate all work lines
    for (let i = 0; i < workLines.length; i++) {
      const line = workLines[i];
      if (!line.werktype || !line.werkomschrijving || !line.aantal_uren) {
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
    
    // Clear any existing errors
    setFormError('');

    // Use selectedProject from state
    const selectedProjectId = selectedProject?.id || null;
    const projectName = selectedProject?.naam || null;

    // Use direct Supabase call instead of hook
    const submitRegistration = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user?.id) {
          setFormError('Gebruiker niet ingelogd');
          return;
        }

        // Convert kilometers to number, default to 0 if empty
        const kilometers = formData.kilometers ? parseFloat(formData.kilometers) : 0;

        // Insert each work line as a separate time registration
        const registrations = workLines.map(line => ({
          user_id: user.id,
          project_id: selectedProjectId || null,
          project_naam: projectName,
          datum: formData.datum,
          werktype: line.werktype,
          aantal_uren: line.aantal_uren,
          werkomschrijving: line.werkomschrijving,
          driven_kilometers: kilometers,
          status: 'submitted',
          progress_percentage: formData.voortgang ? parseInt(formData.voortgang) : null,
          materials: line.materials && line.materials.length > 0 ? line.materials : []
        }));

        console.log('Submitting registrations:', registrations);

        const { data: insertedData, error: insertError } = await supabase.from('time_registrations').insert(registrations);

        if (insertError) {
          console.error('Insert error details:', insertError);
          throw insertError;
        }

        console.log('Successfully inserted:', insertedData);

        // Update project progress if voortgang provided and project exists
        if (selectedProjectId && formData.voortgang) {
          // Get current project progress
          const { data: currentProject } = await supabase
            .from('projects')
            .select('progress_percentage')
            .eq('id', selectedProjectId)
            .single();

          const newPercentage = parseInt(formData.voortgang);
          const currentPercentage = currentProject?.progress_percentage || 0;

          // Only update if new percentage is higher
          if (newPercentage > currentPercentage) {
            await supabase
              .from('projects')
              .update({ progress_percentage: newPercentage })
              .eq('id', selectedProjectId);
          }
        }

        // Reset form and show success
        setFormData({
          datum: new Date().toISOString().split('T')[0],
          ordernummer: '',
          voortgang: '',
          kilometers: '',
        });
        setWorkLines([{ werktype: '', werkomschrijving: '', aantal_uren: 0, materials: [] }]);
        setSelectedProject(null);
        
        setShowModal(false);
        setSuccessMessage(t('registratieOpgeslagen'));
        setShowSuccessMessage(true);
        setTimeout(() => {
          setShowSuccessMessage(false);
          setSuccessMessage('');
        }, 3000);
        refetch();
      } catch (error) {
        console.error('Error creating registration:', error);
        setFormError('Er is een fout opgetreden bij het opslaan van de registratie.');
      }
    };

    submitRegistration();
  };

  // Check if registration is editable by current user
  const isRegistrationEditable = (registratie: any) => {
    // User can always edit their own registrations
    if (registratie.user_id === user?.id) {
      return true;
    }

    // Admin and kantoor_medewerker can edit all registrations
    return hasPermission('approve_hours');
  };

  const handleEditRegistration = (registratie: any) => {
    // Check if editable
    if (!isRegistrationEditable(registratie)) {
      alert('Je hebt geen rechten om deze registratie te bewerken.');
      return;
    }

    setEditingRegistration({
      id: registratie.id,
      datum: registratie.datum,
      werktype: registratie.werktype,
      aantalUren: registratie.aantal_uren.toString(),
      werkomschrijving: registratie.werkomschrijving,
      project_id: registratie.project_id || '',
      locatie: registratie.locatie || '',
      voortgang: registratie.progress_percentage?.toString() || '',
      kilometers: registratie.driven_kilometers?.toString() || '',
      user_id: registratie.user_id,
    });
    setShowEditModal(true);
  };

  const handleUpdateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingRegistration) return;

    // Validation
    if (!editingRegistration.datum || !editingRegistration.werktype || !editingRegistration.aantalUren || !editingRegistration.werkomschrijving) {
      alert(t('vulVerplichtVelden'));
      return;
    }

    if (parseFloat(editingRegistration.aantalUren) <= 0) {
      alert('Aantal uren moet groter zijn dan 0');
      return;
    }

    if (parseFloat(editingRegistration.aantalUren) > 24) {
      alert('Aantal uren kan niet meer dan 24 uur per dag zijn');
      return;
    }

    try {
      // Use project_id directly from editingRegistration
      const selectedProjectId = editingRegistration.project_id || null;

      await updateRegistration(
        editingRegistration.id,
        {
          datum: editingRegistration.datum,
          werktype: editingRegistration.werktype,
          aantal_uren: parseFloat(editingRegistration.aantalUren),
          werkomschrijving: editingRegistration.werkomschrijving,
          project_id: selectedProjectId,
          locatie: editingRegistration.locatie,
          progress_percentage: editingRegistration.voortgang ? parseInt(editingRegistration.voortgang) : null,
          driven_kilometers: editingRegistration.kilometers ? parseFloat(editingRegistration.kilometers) : 0,
        }
      );

      // Update project progress if voortgang provided and project exists
      if (selectedProjectId && editingRegistration.voortgang) {
        const { data: currentProject } = await supabase
          .from('projects')
          .select('progress_percentage')
          .eq('id', selectedProjectId)
          .maybeSingle();

        const newPercentage = parseInt(editingRegistration.voortgang);
        const currentPercentage = currentProject?.progress_percentage || 0;

        if (newPercentage > currentPercentage) {
          await supabase
            .from('projects')
            .update({ progress_percentage: newPercentage })
            .eq('id', selectedProjectId);
        }
      }

      setShowEditModal(false);
      setEditingRegistration(null);
      setSuccessMessage('Registratie succesvol bijgewerkt!');
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
        setSuccessMessage('');
      }, 3000);
      refetch();
    } catch (error) {
      console.error('Error updating registration:', error);
      alert('Er is een fout opgetreden bij het bijwerken van de registratie.');
    }
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditingRegistration((prev: any) => ({ ...prev, [name]: value }));
  };

  // Quick project creation by employees/ZZPers
  const handleQuickProjectCreate = async () => {
    if (!quickProjectName.trim()) {
      alert('Vul een projectnaam in');
      return;
    }

    try {
      // Close the form modal and show loading modal
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
        console.error('Error creating quick project:', error);
        setShowProjectCreatingModal(false);
        alert('Fout bij aanmaken project');
        setShowQuickProjectModal(true);
        return;
      }

      setQuickProjectName('');
      setSelectedProject(newProject);

      // Trigger event to notify other components
      window.dispatchEvent(new CustomEvent('projectsUpdated'));

      // Wait 3 seconds then reload page
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      console.error('Error:', error);
      setShowProjectCreatingModal(false);
      alert('Er is een fout opgetreden');
      setShowQuickProjectModal(true);
    }
  };
  
  // Apply all filters to registrations
  const processedRegistraties = registraties.filter(registratie => {
    // User filter (for admins/kantoorpersoneel)
    if (hasPermission('view_reports') && userFilter && registratie.user_id !== userFilter) {
      return false;
    }

    // Date filters
    const registratieDate = new Date(registratie.datum);
    const startDate = new Date(startDateFilter);
    const endDate = new Date(endDateFilter);
    endDate.setHours(23, 59, 59, 999); // Include the entire end date

    if (registratieDate < startDate || registratieDate > endDate) {
      return false;
    }

    // Type filter
    if (typeFilter !== 'alleTypes' && registratie.werktype !== typeFilter) {
      return false;
    }

    return true;
  });
  
  // Filter processed registrations based on search term (project name or order number)
  const filteredRegistraties = processedRegistraties.filter(registratie => {
    if (!searchTerm.trim()) return true;
    
    const searchLower = searchTerm.toLowerCase();
    
    // Search by project name if project_id exists
    if (registratie.project_id) {
      const project = projecten.find(p => p.id === registratie.project_id);
      if (project) {
        // Check project name
        if (project.naam.toLowerCase().includes(searchLower)) {
          return true;
        }
        // Check project number/ordernummer
        if (project.project_nummer && project.project_nummer.toLowerCase().includes(searchLower)) {
          return true;
        }
      }
    }
    
    // Search by direct project name in registration
    if (registratie.project_naam && registratie.project_naam.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    // Search by work description
    if (registratie.werkomschrijving.toLowerCase().includes(searchLower)) {
      return true;
    }
    
    return false;
  });

  // Pagination logic
  const totalItems = filteredRegistraties.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRegistraties = filteredRegistraties.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDateFilter, endDateFilter, typeFilter, userFilter]);

  const handleExport = () => {
    if (filteredRegistraties.length === 0) {
      alert('Geen registraties om te exporteren');
      return;
    }
    const separator = settings.csv_separator || ';';

    // Enrich registrations with user names
    const enrichedRegistraties = filteredRegistraties.map(reg => {
      const gebruiker = gebruikers.find((g: any) => g.id === reg.user_id);
      return {
        ...reg,
        user_naam: gebruiker?.naam || gebruiker?.email || 'Onbekend'
      };
    });

    exportUrenRegistraties(enrichedRegistraties, separator);
  };

  const handleDeleteRegistration = (id: string) => {
    if (window.confirm(t('weetJeZeker'))) {
      deleteRegistration(id)
        .then(() => {
          setSuccessMessage(t('registratieVerwijderd'));
          setShowSuccessMessage(true);
          setTimeout(() => {
            setShowSuccessMessage(false);
            setSuccessMessage('');
          }, 3000);
          refetch();
        })
        .catch((error) => {
          console.error('Error deleting registration:', error);
          alert('Er is een fout opgetreden bij het verwijderen van de registratie.');
        });
    }
  };

  const handleNewRegistration = () => {
    setFormData({
      datum: new Date().toISOString().split('T')[0],
      ordernummer: '',
      werktype: '',
      aantalUren: '',
      werkomschrijving: '',
      locatie: '',
      voortgang: '',
      kilometers: '',
    });
    setSelectedProject(null);
    setFormError('');
    setShowNewRegistration(true);
    setShowOverview(false);
  };

  const handleNewProjectAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newProjectDetails.naam || !newProjectDetails.locatie || !newProjectDetails.beschrijving) {
      setNewProjectModalError('Vul alle verplichte velden in');
      return;
    }

    if (!pendingTimeRegistration) {
      setNewProjectModalError('Geen tijdregistratie gevonden om te verwerken');
      return;
    }

    try {
      // Clear any existing errors
      setNewProjectModalError('');

      // Close the form modal and show loading modal
      setShowNewProjectModal(false);
      setShowProjectCreatingModal(true);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.id) {
        setShowProjectCreatingModal(false);
        setNewProjectModalError('Gebruiker niet ingelogd');
        setShowNewProjectModal(true);
        return;
      }

      // Create new project
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          naam: newProjectDetails.naam,
          beschrijving: newProjectDetails.beschrijving,
          locatie: newProjectDetails.locatie,
          project_nummer: pendingTimeRegistration.ordernummer,
          start_datum: new Date().toISOString().split('T')[0],
          created_by: user.id,
          status: 'actief'
        })
        .select()
        .single();

      if (projectError) {
        console.error('Error creating project:', projectError);
        setShowProjectCreatingModal(false);
        setNewProjectModalError('Er is een fout opgetreden bij het aanmaken van het project.');
        setShowNewProjectModal(true);
        return;
      }

      // Now create the time registration with the new project
      const { error: registrationError } = await supabase
        .from('time_registrations')
        .insert({
          user_id: user.id,
          project_id: newProject.id,
          project_naam: newProject.naam,
          datum: pendingTimeRegistration.datum,
          werktype: pendingTimeRegistration.werktype,
          aantal_uren: parseFloat(pendingTimeRegistration.aantalUren),
          werkomschrijving: pendingTimeRegistration.werkomschrijving,
          locatie: (pendingTimeRegistration.werktype === 'meerwerk' || pendingTimeRegistration.werktype === 'regie') ? pendingTimeRegistration.locatie : null,
          status: 'submitted'
        });

      // Update project progress if voortgang provided
      if (pendingTimeRegistration.voortgang) {
        await supabase
          .from('projects')
          .update({ progress_percentage: parseInt(pendingTimeRegistration.voortgang) })
          .eq('id', newProject.id);
      }

      if (registrationError) {
        console.error('Error creating registration:', registrationError);
        setShowProjectCreatingModal(false);
        setNewProjectModalError('Er is een fout opgetreden bij het opslaan van de registratie.');
        setShowNewProjectModal(true);
        return;
      }

      // Success! Reset state
      setPendingTimeRegistration(null);
      setNewProjectDetails({ naam: '', locatie: '', beschrijving: '' });
      setFormData({
        datum: '',
        ordernummer: '',
        werktype: '',
        aantalUren: '',
        werkomschrijving: '',
        locatie: '',
        voortgang: '',
        kilometers: '',
      });

      // Trigger event to notify other components
      window.dispatchEvent(new CustomEvent('projectsUpdated'));

      // Wait 3 seconds then reload page
      setTimeout(() => {
        window.location.reload();
      }, 3000);

    } catch (error) {
      console.error('Unexpected error:', error);
      setShowProjectCreatingModal(false);
      setNewProjectModalError('Er is een onverwachte fout opgetreden.');
      setShowNewProjectModal(true);
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
          {successMessage}
        </div>
      )}
      
      {formError && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
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
      
      {showNewRegistration && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">{t('nieuweRegistratie')}</h1>
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

          <div className="bg-white rounded-lg shadow p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <h3 className="text-md font-medium text-gray-700 mb-4">{t('basisInformatie')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('datum')} *</label>
                    <input
                      type="date"
                      name="datum"
                      value={formData.datum}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('project')} *</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        name="project_id"
                        value={selectedProject?.id || ''}
                        onChange={(e) => {
                          const project = projecten.find(p => p.id === e.target.value);
                          setSelectedProject(project || null);
                        }}
                        required
                        className="flex-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                    {selectedProject && selectedProject.calculated_hours && (
                      <p className="text-xs text-blue-600 mt-1">
                        Gecalculeerde uren: {selectedProject.calculated_hours} uur
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Voortgang project (%)</label>
                  <input
                    type="number"
                    name="voortgang"
                    value={formData.voortgang}
                    onChange={handleInputChange}
                    min="0"
                    max="100"
                    placeholder="0-100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('optioneelGeefAanHoeveelProcent')}</p>
                </div>

                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-sm font-medium text-gray-700">Gereden kilometers</label>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optioneel - vul alleen in indien van toepassing</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Werkregels</h3>
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
                    <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">Regel {index + 1}</span>
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
                          <label className="block text-xs font-medium text-gray-700 mb-1">{t('werktype')} *</label>
                          <select
                            value={line.werktype}
                            onChange={(e) => updateWorkLine(index, 'werktype', e.target.value)}
                            required
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          >
                            <option value="">{t('selecteerType')}</option>
                            <option value="projectbasis">{t('projectbasis')}</option>
                            <option value="meerwerk">{t('meerwerk')}</option>
                            <option value="regie">{t('regie')}</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">{t('aantalUren')} *</label>
                          <input
                            type="number"
                            value={line.aantal_uren || ''}
                            onChange={(e) => updateWorkLine(index, 'aantal_uren', parseFloat(e.target.value) || 0)}
                            step="0.5"
                            min="0"
                            required
                            placeholder="bv. 8 of 4.5"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          />
                        </div>

                        <div className="md:col-span-1">
                          <label className="block text-xs font-medium text-gray-700 mb-1">{t('werkomschrijving')} *</label>
                          <input
                            type="text"
                            value={line.werkomschrijving}
                            onChange={(e) => updateWorkLine(index, 'werkomschrijving', e.target.value)}
                            required
                            placeholder="Beschrijf het uitgevoerde werk"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          />
                        </div>
                      </div>

                      {(line.werktype === 'regie' || line.werktype === 'meerwerk') && (
                        <div className="mt-4 pt-4 border-t border-gray-300">
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-semibold text-gray-700">Materialen</label>
                            <button
                              type="button"
                              onClick={() => addMaterialToWorkLine(index)}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                              <Plus size={14} />
                              Materiaal toevoegen
                            </button>
                          </div>

                          {line.materials && line.materials.length > 0 && (
                            <div className="space-y-2">
                              {line.materials.map((material, matIdx) => (
                                <div key={matIdx} className="border border-gray-200 rounded bg-white">
                                  <div className="p-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => updateMaterial(index, matIdx, 'type', material.type === 'product' ? 'description' : 'product')}
                                        className={`px-2 py-1 text-xs rounded ${material.type === 'product' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                                      >
                                        Product
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateMaterial(index, matIdx, 'type', material.type === 'description' ? 'product' : 'description')}
                                        className={`px-2 py-1 text-xs rounded ${material.type === 'description' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
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
                                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          />
                                          <span className="text-xs text-gray-600 min-w-[40px]">{material.unit || '-'}</span>
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
                                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                                            className="w-20 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          />
                                          <input
                                            type="text"
                                            value={material.unit || ''}
                                            onChange={(e) => updateMaterial(index, matIdx, 'unit', e.target.value)}
                                            placeholder="Eenheid"
                                            className="w-20 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800">
                    <strong>Totaal uren:</strong> {workLines.reduce((sum, line) => sum + (line.aantal_uren || 0), 0).toFixed(1)} uur
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button 
                  type="button"
                  onClick={() => {
                    setShowNewRegistration(false);
                    setShowOverview(true);
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  {t('annuleren')}
                </button>
                <button 
                  type="submit"
                  disabled={mutationLoading}
                  className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  {mutationLoading ? 'Opslaan...' : t('registratieOpslaan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {showOverview && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">{t('urenregistratie')}</h1>
            <div className="flex space-x-3">
              <ProtectedRoute permission="export_data">
                <button 
                  onClick={handleExport}
                  className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  <Download size={16} />
                  <span>{t('exporteren')}</span>
                </button>
              </ProtectedRoute>
              <button 
                onClick={handleNewRegistration}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <Plus size={16} />
                <span>{t('nieuweRegistratie')}</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow mb-6 p-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {hasPermission('view_reports') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gebruiker</label>
                  <select
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Periode</label>
                <select
                  value={dateRangeFilter}
                  onChange={(e) => handleDateRangeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('type')}</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="alleTypes">{t('alleTypes')}</option>
                  <option value="projectbasis">{t('projectbasis')}</option>
                  <option value="meerwerk">{t('meerwerk')}</option>
                  <option value="regie">{t('regie')}</option>
                </select>
              </div>
            </div>
            <div className="mt-4">
              <input
                type="text"
                placeholder={t('zoekProjectOfOrdernummer')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-80 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>

          {/* Registraties overzicht */}
          {filteredRegistraties.length > 0 && (
            <div className="bg-white rounded-lg shadow mt-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">
                  {searchTerm ? `Zoekresultaten (${filteredRegistraties.length})` : `Registraties (${filteredRegistraties.length})`}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('datum')}</th>
                      {hasPermission('view_reports') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gebruiker</th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('werktype')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('aantalUren')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('werkomschrijving')}</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('acties')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedRegistraties.map((registratie) => {
                      const hasExtraInfo = (registratie.driven_kilometers && registratie.driven_kilometers > 0) ||
                                          (registratie.materials && registratie.materials.length > 0) ||
                                          (registratie.verbruikt_materiaal && registratie.verbruikt_materiaal.trim() !== '');
                      const isExpanded = expandedRows.has(registratie.id);

                      return (
                        <React.Fragment key={registratie.id}>
                          <tr className={isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(registratie.datum)}
                            </td>
                            {hasPermission('view_reports') && (
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {gebruikers.find((g: any) => g.id === registratie.user_id)?.naam || 'Onbekend'}
                              </td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {registratie.project_id ?
                                projecten.find(p => p.id === registratie.project_id)?.naam || 'Onbekend project' :
                                '-'
                              }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {registratie.werktype}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {registratie.aantal_uren.toString().replace('.', ',')}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                              <div className="break-words">{registratie.werkomschrijving}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex space-x-2 items-center">
                                {hasExtraInfo && (
                                  <button
                                    onClick={() => toggleRowExpansion(registratie.id)}
                                    className="text-gray-600 hover:text-gray-900 transition-colors"
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
                                        className="text-gray-600 hover:text-gray-900"
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
                            <tr className="bg-gray-50">
                              <td colSpan={hasPermission('view_reports') ? 7 : 6} className="px-6 py-4">
                                <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {registratie.driven_kilometers && registratie.driven_kilometers > 0 && (
                                      <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Kilometers</div>
                                        <div className="text-2xl font-bold text-gray-900">
                                          {registratie.driven_kilometers.toString().replace('.', ',')} km
                                        </div>
                                      </div>
                                    )}
                                    {registratie.materials && registratie.materials.length > 0 && (
                                      <div className="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                                        <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Materialen</div>
                                        <div className="space-y-2">
                                          {registratie.materials.map((mat: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-gray-100 last:border-0">
                                              <span className="font-medium text-gray-900">
                                                {mat.type === 'product' ? mat.product_name : mat.description}
                                              </span>
                                              <span className="text-gray-600 font-semibold">{mat.quantity} {mat.unit}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {registratie.verbruikt_materiaal && registratie.verbruikt_materiaal.trim() !== '' && (
                                      <div className="bg-amber-50 p-3 rounded-lg md:col-span-2">
                                        <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Verbruikt Materiaal</div>
                                        <div className="text-sm text-amber-900">
                                          {registratie.verbruikt_materiaal}
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

              {/* Pagination Controls */}
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-700">Toon:</label>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-gray-700">
                    resultaten per pagina
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-700">
                    Pagina {currentPage} van {totalPages} ({totalItems} resultaten)
                  </span>

                  <div className="flex space-x-1">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Eerste pagina"
                    >
                      «
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      title="Vorige pagina"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNumber}
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`px-3 py-1 border rounded-md ${
                            currentPage === pageNumber
                              ? 'bg-red-600 text-white border-red-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                      title="Volgende pagina"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Laatste pagina"
                    >
                      »
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={t('nieuweRegistratie')}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h3 className="text-md font-medium text-gray-700 mb-4">{t('basisInformatie')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('datum')} *</label>
                <input
                  type="date"
                  name="datum"
                  value={formData.datum}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('project')}</label>
                <input
                  type="text"
                  name="ordernummer"
                  value={formData.ordernummer}
                  onChange={handleInputChange}
                  placeholder={t('projectOrdernummerPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('werktype')} *</label>
                <select
                  name="werktype"
                  value={formData.werktype}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">{t('selecteerType')}</option>
                  <option value="projectbasis">{t('projectbasis')}</option>
                  <option value="meerwerk">{t('meerwerk')}</option>
                  <option value="regie">{t('regie')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('aantalUren')} *</label>
                <input
                  type="number"
                  name="aantalUren"
                  value={formData.aantalUren}
                  onChange={handleInputChange}
                  step="0.5"
                  min="0"
                  required
                  placeholder="bv. 8 of 4.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            {/* Conditional Location field for Meerwerk */}
            {(formData.werktype === 'meerwerk' || formData.werktype === 'regie') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('verbruiktMateriaal')} *</label>
                <input
                  type="text"
                  name="locatie"
                  value={formData.locatie}
                  onChange={handleInputChange}
                  required={formData.werktype === 'meerwerk' || formData.werktype === 'regie'}
                  placeholder={t('verbruiktMateriaalPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Voortgang project (%)</label>
            <input
              type="number"
              name="voortgang"
              value={formData.voortgang}
              onChange={handleInputChange}
              min="0"
              max="100"
              placeholder="0-100"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
            <p className="text-xs text-gray-500 mt-1">Optioneel: geef aan hoeveel procent van het project is voltooid</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('werkomschrijving')} *</label>
            <textarea
              name="werkomschrijving"
              value={formData.werkomschrijving}
              onChange={handleInputChange}
              rows={4}
              required
              placeholder={formData.werktype === 'meerwerk' ? t('beschrijfMeerwerk') : t('beschrijfWerk')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
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
              disabled={mutationLoading}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              {mutationLoading ? 'Opslaan...' : t('registratieOpslaan')}
            </button>
          </div>
        </form>
      </Modal>
      
      {/* New Project Modal */}
      <Modal
        isOpen={showNewProjectModal}
        onClose={() => {
          setShowNewProjectModal(false);
          setPendingTimeRegistration(null);
          setNewProjectDetails({ naam: '', locatie: '', beschrijving: '' });
        }}
        title={t('nieuwProjectAanmaken')}
      >
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">{t('projectNietGevonden')}</h3>
              <p className="text-sm text-yellow-700 mt-1">
                {t('projectNietGevondenBeschrijving')}
              </p>
              <p className="text-sm font-medium text-yellow-800 mt-2">
                {t('projectNummer')}: {pendingTimeRegistration?.ordernummer}
              </p>
            </div>
          </div>
        </div>
        
        {newProjectModalError && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{newProjectModalError}</p>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleNewProjectAndRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('projectNaam')} *</label>
            <input
              type="text"
              name="naam"
              value={newProjectDetails.naam}
              onChange={handleNewProjectDetailsChange}
              required
              placeholder="Bijv. Renovatie kantoorpand"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('projectLocatie')} *</label>
            <input
              type="text"
              name="locatie"
              value={newProjectDetails.locatie}
              onChange={handleNewProjectDetailsChange}
              required
              placeholder="Bijv. Amsterdam, Damrak 1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('projectBeschrijving')} *</label>
            <textarea
              name="beschrijving"
              value={newProjectDetails.beschrijving}
              onChange={handleNewProjectDetailsChange}
              rows={3}
              required
              placeholder={t('beschrijfProject')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button"
              onClick={() => {
                setShowNewProjectModal(false);
                setPendingTimeRegistration(null);
                setNewProjectDetails({ naam: '', locatie: '', beschrijving: '' });
              }}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              {t('annuleren')}
            </button>
            <button 
              type="submit"
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              {t('projectAanmakenEnRegistreren')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Registration Modal */}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('datum')} *</label>
              <input
                type="date"
                name="datum"
                value={editingRegistration.datum}
                onChange={handleEditInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('project')} *</label>
              <select
                name="project_id"
                value={editingRegistration.project_id || ''}
                onChange={handleEditInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">Selecteer een project</option>
                {projecten.map((project: any) => (
                  <option key={project.id} value={project.id}>
                    {project.naam} {project.project_nummer ? `(#${project.project_nummer})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('werktype')} *</label>
              <select
                name="werktype"
                value={editingRegistration.werktype}
                onChange={handleEditInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="">{t('selecteerType')}</option>
                <option value="projectbasis">{t('projectbasis')}</option>
                <option value="meerwerk">{t('meerwerk')}</option>
                <option value="regie">{t('regie')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('aantalUren')} *</label>
              <input
                type="number"
                step="0.5"
                name="aantalUren"
                value={editingRegistration.aantalUren}
                onChange={handleEditInputChange}
                required
                min="0.5"
                max="24"
                placeholder={t('aantalUrenPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {(editingRegistration.werktype === 'meerwerk' || editingRegistration.werktype === 'regie') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('locatie')}</label>
                <input
                  type="text"
                  name="locatie"
                  value={editingRegistration.locatie}
                  onChange={handleEditInputChange}
                  placeholder={t('locatiePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('voortgang')} (%)</label>
              <input
                type="number"
                name="voortgang"
                value={editingRegistration.voortgang}
                onChange={handleEditInputChange}
                min="0"
                max="100"
                placeholder="0-100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <p className="text-xs text-gray-500 mt-1">{t('optioneelGeefAanHoeveelProcent')}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">Gereden kilometers</label>
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
                value={editingRegistration.kilometers}
                onChange={handleEditInputChange}
                min="0"
                step="0.1"
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <p className="text-xs text-gray-500 mt-1">Optioneel - vul alleen in indien van toepassing</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('werkomschrijving')} *</label>
              <textarea
                name="werkomschrijving"
                value={editingRegistration.werkomschrijving}
                onChange={handleEditInputChange}
                rows={4}
                required
                placeholder={t('werkomschrijvingPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRegistration(null);
                }}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
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
          <p className="text-gray-700">
            Weet je zeker dat het project niet in het keuzemenu staat?
          </p>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowConfirmProjectModal(false)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
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

      {/* Quick Project Creation Modal */}
      <Modal
        isOpen={showQuickProjectModal}
        onClose={() => {
          setShowQuickProjectModal(false);
          setQuickProjectName('');
        }}
        title="Snel Project Aanmaken"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Maak snel een nieuw project aan. Kantoorpersoneel zal later de details aanvullen.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Projectnaam *</label>
            <input
              type="text"
              value={quickProjectName}
              onChange={(e) => setQuickProjectName(e.target.value)}
              placeholder="Bijv: Renovatie Hoofdstraat 123"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
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
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
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

      {/* Project Creating Loading Modal */}
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
              <h3 className="text-lg font-semibold text-gray-800">Project wordt aangemaakt...</h3>
              <p className="text-sm text-gray-600">Even geduld, we maken het project aan en slaan je urenregistratie op.</p>
              <p className="text-xs text-gray-500 mt-4">De pagina wordt automatisch ververst...</p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Urenregistratie;