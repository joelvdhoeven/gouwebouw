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

interface ProjectWorkCode {
  id: string;
  project_id: string;
  work_code_id: string | null;
  custom_code: string | null;
  custom_name: string | null;
  custom_description: string | null;
  work_codes?: WorkCode;
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

interface ProjectBlock {
  id: string;
  project: any | null;
  voortgang: string;
  kilometers: string;
  workLines: WorkLine[];
  isCollapsed: boolean;
  availableWorkCodes: WorkCode[]; // Project-specific work codes (or all if none configured)
  hasProjectSpecificCodes: boolean; // Whether this project has specific codes configured
}

const UrenregistratieV2: React.FC = () => {
  const { t } = useLanguage();
  const { hasPermission, user, profile } = useAuth();
  const { settings } = useSystemSettings();

  // State for data
  const [registraties, setRegistraties] = useState<any[]>([]);
  const [projecten, setProjecten] = useState<any[]>([]);
  const [allProjecten, setAllProjecten] = useState<any[]>([]); // For export (includes archived)
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

  // Multi-project form state
  const [datum, setDatum] = useState(new Date().toISOString().split('T')[0]);
  const [projectBlocks, setProjectBlocks] = useState<ProjectBlock[]>([
    {
      id: crypto.randomUUID(),
      project: null,
      voortgang: '',
      kilometers: '',
      workLines: [{ work_code_id: '', work_code_name: '', werkomschrijving: '', aantal_uren: 0, materials: [] }],
      isCollapsed: false,
      availableWorkCodes: [],
      hasProjectSpecificCodes: false
    }
  ]);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRegistration, setEditingRegistration] = useState<any>(null);

  // Quick project modal state
  const [showConfirmProjectModal, setShowConfirmProjectModal] = useState(false);
  const [showQuickProjectModal, setShowQuickProjectModal] = useState(false);
  const [showProjectCreatingModal, setShowProjectCreatingModal] = useState(false);
  const [quickProjectName, setQuickProjectName] = useState('');
  const [quickProjectBlockId, setQuickProjectBlockId] = useState<string | null>(null);

  // Project search modal state
  const [showProjectSearchModal, setShowProjectSearchModal] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [searchingForBlockId, setSearchingForBlockId] = useState<string | null>(null);

  // Work code search modal state
  const [showWorkCodeSearchModal, setShowWorkCodeSearchModal] = useState(false);
  const [workCodeSearchQuery, setWorkCodeSearchQuery] = useState('');
  const [workCodeSearchBlockId, setWorkCodeSearchBlockId] = useState<string | null>(null);
  const [workCodeSearchLineIndex, setWorkCodeSearchLineIndex] = useState<number | null>(null);

  // Load all data
  useEffect(() => {
    loadData();
  }, [user?.id, canViewAll]);

  const loadData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('time_registrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (!canViewAll && user?.id) {
        query = query.eq('user_id', user.id);
      }

      const [registrationsRes, projectsRes, allProjectsRes, usersRes, workCodesRes, productsRes] = await Promise.all([
        query,
        supabase.from('projects').select('*').eq('status', 'actief'),
        supabase.from('projects').select('*'), // All projects for export
        supabase.from('profiles').select('id, naam, email'),
        supabase.from('work_codes').select('*').eq('is_active', true).order('code').order('name'),
        supabase.from('inventory_products').select('id, name, sku, unit')
      ]);

      if (registrationsRes.data) setRegistraties(registrationsRes.data);
      if (projectsRes.data) setProjecten(projectsRes.data);
      if (allProjectsRes.data) setAllProjecten(allProjectsRes.data);
      if (usersRes.data) setGebruikers(usersRes.data);
      if (workCodesRes.data) setWorkCodes(workCodesRes.data);
      if (productsRes.data) setProducts(productsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
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

  // Project Block functions
  // Load project-specific work codes for a project
  const loadProjectWorkCodes = async (projectId: string): Promise<{ codes: WorkCode[], hasSpecificCodes: boolean }> => {
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
          work_codes (id, code, name, description, is_active, sort_order)
        `)
        .eq('project_id', projectId);

      if (error) {
        // Table might not exist yet
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          console.log('project_work_codes table does not exist - using all work codes');
          return { codes: workCodes, hasSpecificCodes: false };
        }
        throw error;
      }

      if (!data || data.length === 0) {
        // No specific codes configured for this project - use all
        return { codes: workCodes, hasSpecificCodes: false };
      }

      // Build the list of available codes
      const availableCodes: WorkCode[] = [];

      data.forEach((pwc: any) => {
        if (pwc.work_code_id && pwc.work_codes) {
          // Standard work code
          availableCodes.push(pwc.work_codes);
        } else if (pwc.custom_code) {
          // Custom work code - create a synthetic WorkCode object
          availableCodes.push({
            id: pwc.id, // Use project_work_codes id as the identifier
            code: pwc.custom_code,
            name: pwc.custom_name || pwc.custom_code,
            description: pwc.custom_description || '',
            is_active: true,
            sort_order: 999 // Put custom codes at the end
          });
        }
      });

      // Sort by sort_order
      availableCodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      return { codes: availableCodes, hasSpecificCodes: true };
    } catch (err) {
      console.error('Error loading project work codes:', err);
      return { codes: workCodes, hasSpecificCodes: false };
    }
  };

  const addProjectBlock = () => {
    setProjectBlocks([...projectBlocks, {
      id: crypto.randomUUID(),
      project: null,
      voortgang: '',
      kilometers: '',
      workLines: [{ work_code_id: '', work_code_name: '', werkomschrijving: '', aantal_uren: 0, materials: [] }],
      isCollapsed: false,
      availableWorkCodes: workCodes, // Default to all work codes
      hasProjectSpecificCodes: false
    }]);
  };

  const removeProjectBlock = (blockId: string) => {
    if (projectBlocks.length > 1) {
      setProjectBlocks(projectBlocks.filter(b => b.id !== blockId));
    }
  };

  const toggleProjectBlockCollapse = (blockId: string) => {
    setProjectBlocks(projectBlocks.map(b =>
      b.id === blockId ? { ...b, isCollapsed: !b.isCollapsed } : b
    ));
  };

  const updateProjectBlock = async (blockId: string, field: keyof ProjectBlock, value: any) => {
    if (field === 'project' && value?.id) {
      // When project changes, load project-specific work codes
      const { codes, hasSpecificCodes } = await loadProjectWorkCodes(value.id);

      setProjectBlocks(projectBlocks.map(b => {
        if (b.id === blockId) {
          return {
            ...b,
            project: value,
            availableWorkCodes: codes,
            hasProjectSpecificCodes: hasSpecificCodes,
            // Reset work lines when project changes (since available codes may differ)
            workLines: [{ work_code_id: '', work_code_name: '', werkomschrijving: '', aantal_uren: 0, materials: [] }]
          };
        }
        return b;
      }));
    } else {
      setProjectBlocks(projectBlocks.map(b =>
        b.id === blockId ? { ...b, [field]: value } : b
      ));
    }
    if (formError) setFormError('');
  };

  // Work line functions for a specific project block
  const addWorkLineToBlock = (blockId: string) => {
    setProjectBlocks(projectBlocks.map(b =>
      b.id === blockId
        ? { ...b, workLines: [...b.workLines, { work_code_id: '', work_code_name: '', werkomschrijving: '', aantal_uren: 0, materials: [] }] }
        : b
    ));
  };

  const removeWorkLineFromBlock = (blockId: string, lineIndex: number) => {
    setProjectBlocks(projectBlocks.map(b => {
      if (b.id === blockId && b.workLines.length > 1) {
        return { ...b, workLines: b.workLines.filter((_, i) => i !== lineIndex) };
      }
      return b;
    }));
  };

  const updateWorkLineInBlock = (blockId: string, lineIndex: number, field: keyof WorkLine, value: string | number) => {
    setProjectBlocks(projectBlocks.map(b => {
      if (b.id === blockId) {
        const updated = [...b.workLines];
        if (field === 'work_code_id') {
          // Look up the work code from block's available codes first, then global
          const codesToSearch = b.availableWorkCodes.length > 0 ? b.availableWorkCodes : workCodes;
          const workCode = codesToSearch.find(wc => wc.id === value);
          updated[lineIndex] = {
            ...updated[lineIndex],
            work_code_id: value as string,
            work_code_name: workCode?.name || ''
          };
        } else {
          updated[lineIndex] = { ...updated[lineIndex], [field]: value };
        }
        return { ...b, workLines: updated };
      }
      return b;
    }));
    if (formError) setFormError('');
  };

  // Material functions
  const addMaterialToWorkLine = (blockId: string, lineIndex: number) => {
    setProjectBlocks(projectBlocks.map(b => {
      if (b.id === blockId) {
        const updated = [...b.workLines];
        if (!updated[lineIndex].materials) {
          updated[lineIndex].materials = [];
        }
        updated[lineIndex].materials!.push({
          type: 'product',
          product_id: '',
          product_name: '',
          quantity: 0,
          unit: ''
        });
        return { ...b, workLines: updated };
      }
      return b;
    }));
  };

  const removeMaterialFromWorkLine = (blockId: string, lineIndex: number, materialIndex: number) => {
    setProjectBlocks(projectBlocks.map(b => {
      if (b.id === blockId) {
        const updated = [...b.workLines];
        updated[lineIndex].materials = updated[lineIndex].materials?.filter((_, i) => i !== materialIndex);
        return { ...b, workLines: updated };
      }
      return b;
    }));
  };

  const updateMaterial = (blockId: string, lineIndex: number, materialIndex: number, field: keyof MaterialLine, value: string | number) => {
    setProjectBlocks(projectBlocks.map(b => {
      if (b.id === blockId) {
        const updated = [...b.workLines];
        if (updated[lineIndex].materials) {
          updated[lineIndex].materials![materialIndex] = {
            ...updated[lineIndex].materials![materialIndex],
            [field]: value
          };

          if (field === 'product_id' && typeof value === 'string') {
            const product = products.find((p: any) => p.id === value);
            if (product) {
              updated[lineIndex].materials![materialIndex].product_name = product.name;
              updated[lineIndex].materials![materialIndex].unit = product.unit;
            }
          }
        }
        return { ...b, workLines: updated };
      }
      return b;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all project blocks
    for (let blockIndex = 0; blockIndex < projectBlocks.length; blockIndex++) {
      const block = projectBlocks[blockIndex];

      if (!block.project) {
        setFormError(`Selecteer een project voor blok ${blockIndex + 1}`);
        return;
      }

      for (let lineIndex = 0; lineIndex < block.workLines.length; lineIndex++) {
        const line = block.workLines[lineIndex];
        if (!line.work_code_id || !line.werkomschrijving || !line.aantal_uren) {
          setFormError(`Vul alle velden in voor werkregel ${lineIndex + 1} in project "${block.project.naam}"`);
          return;
        }
        if (line.aantal_uren <= 0) {
          setFormError(`Aantal uren moet groter zijn dan 0 voor werkregel ${lineIndex + 1} in project "${block.project.naam}"`);
          return;
        }
        if (line.aantal_uren > 24) {
          setFormError(`Aantal uren kan niet meer dan 24 zijn voor werkregel ${lineIndex + 1}`);
          return;
        }
      }
    }

    // Calculate total hours across all blocks
    const totalHours = projectBlocks.reduce((sum, block) =>
      sum + block.workLines.reduce((lineSum, line) => lineSum + line.aantal_uren, 0), 0
    );

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

      // Create registrations for all project blocks
      const allRegistrations: any[] = [];

      for (const block of projectBlocks) {
        const kilometers = block.kilometers ? parseFloat(block.kilometers) : 0;

        for (const line of block.workLines) {
          // Find the work code to get both code and name
          const codesToSearch = block.availableWorkCodes.length > 0 ? block.availableWorkCodes : workCodes;
          const workCode = codesToSearch.find(wc => wc.id === line.work_code_id);

          allRegistrations.push({
            user_id: currentUser.id,
            project_id: block.project?.id || null,
            project_naam: block.project?.naam,
            datum: datum,
            // Store as "CODE - Name" format for export compatibility
            werktype: workCode ? `${workCode.code} - ${workCode.name}` : line.work_code_name,
            aantal_uren: line.aantal_uren,
            werkomschrijving: line.werkomschrijving,
            driven_kilometers: kilometers,
            status: 'submitted',
            progress_percentage: block.voortgang ? parseInt(block.voortgang) : null,
            materials: line.materials && line.materials.length > 0 ? line.materials : []
          });
        }

        // Update project progress if provided
        if (block.project?.id && block.voortgang) {
          const { data: currentProject } = await supabase
            .from('projects')
            .select('progress_percentage')
            .eq('id', block.project.id)
            .single();

          const newPercentage = parseInt(block.voortgang);
          const currentPercentage = currentProject?.progress_percentage || 0;

          if (newPercentage > currentPercentage) {
            await supabase
              .from('projects')
              .update({ progress_percentage: newPercentage })
              .eq('id', block.project.id);
          }
        }
      }

      const { error: insertError } = await supabase.from('time_registrations').insert(allRegistrations);

      if (insertError) throw insertError;

      // Reset form
      setDatum(new Date().toISOString().split('T')[0]);
      setProjectBlocks([{
        id: crypto.randomUUID(),
        project: null,
        voortgang: '',
        kilometers: '',
        workLines: [{ work_code_id: '', work_code_name: '', werkomschrijving: '', aantal_uren: 0, materials: [] }],
        isCollapsed: false,
        availableWorkCodes: workCodes,
        hasProjectSpecificCodes: false
      }]);

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
      const { error } = await supabase
        .from('time_registrations')
        .update({
          datum: editingRegistration.datum,
          werktype: editingRegistration.werktype,
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

      // Update the project block that triggered this
      if (quickProjectBlockId) {
        updateProjectBlock(quickProjectBlockId, 'project', newProject);
      }

      setQuickProjectName('');
      setQuickProjectBlockId(null);
      window.dispatchEvent(new CustomEvent('projectsUpdated'));

      setTimeout(() => {
        setShowProjectCreatingModal(false);
        loadData();
      }, 1500);
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

    // Use allProjecten to include archived projects for historical data
    const enrichedRegistraties = filteredRegistraties.map(reg => {
      const gebruiker = gebruikers.find((g: any) => g.id === reg.user_id);
      const project = allProjecten.find((p: any) => p.id === reg.project_id);
      return {
        ...reg,
        user_naam: gebruiker?.naam || gebruiker?.email || 'Onbekend',
        project_naam: reg.project_naam || project?.naam || ''
      };
    });

    exportUrenRegistraties(enrichedRegistraties, separator, workCodes);
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

  // Calculate total hours for a block
  const getBlockTotalHours = (block: ProjectBlock) => {
    return block.workLines.reduce((sum, line) => sum + (line.aantal_uren || 0), 0);
  };

  // Calculate grand total hours
  const getGrandTotalHours = () => {
    return projectBlocks.reduce((sum, block) => sum + getBlockTotalHours(block), 0);
  };

  // Filter projects for search modal
  const filteredProjectsForSearch = projecten.filter((project: any) => {
    if (!projectSearchQuery.trim()) return true;
    const query = projectSearchQuery.toLowerCase();
    return (
      project.naam?.toLowerCase().includes(query) ||
      project.project_nummer?.toLowerCase().includes(query) ||
      project.adres?.toLowerCase().includes(query) ||
      project.plaats?.toLowerCase().includes(query)
    );
  });

  // Handle selecting a project from search
  const handleSelectProjectFromSearch = (project: any) => {
    if (searchingForBlockId) {
      updateProjectBlock(searchingForBlockId, 'project', project);
    }
    setShowProjectSearchModal(false);
    setProjectSearchQuery('');
    setSearchingForBlockId(null);
  };

  // Open project search modal
  const openProjectSearch = (blockId: string) => {
    setSearchingForBlockId(blockId);
    setProjectSearchQuery('');
    setShowProjectSearchModal(true);
  };

  // Work code search functions
  const openWorkCodeSearch = (blockId: string, lineIndex: number) => {
    setWorkCodeSearchBlockId(blockId);
    setWorkCodeSearchLineIndex(lineIndex);
    setWorkCodeSearchQuery('');
    setShowWorkCodeSearchModal(true);
  };

  const handleSelectWorkCodeFromSearch = (workCode: WorkCode) => {
    if (workCodeSearchBlockId !== null && workCodeSearchLineIndex !== null) {
      updateWorkLineInBlock(workCodeSearchBlockId, workCodeSearchLineIndex, 'work_code_id', workCode.id);
    }
    setShowWorkCodeSearchModal(false);
    setWorkCodeSearchQuery('');
    setWorkCodeSearchBlockId(null);
    setWorkCodeSearchLineIndex(null);
  };

  // Get available work codes for search (from current block or all)
  const getWorkCodesForSearch = (): WorkCode[] => {
    if (workCodeSearchBlockId) {
      const block = projectBlocks.find(b => b.id === workCodeSearchBlockId);
      if (block && block.availableWorkCodes.length > 0) {
        return block.availableWorkCodes;
      }
    }
    return workCodes;
  };

  // Filter work codes for search
  const filteredWorkCodesForSearch = getWorkCodesForSearch()
    .filter(wc => {
      if (!workCodeSearchQuery) return true;
      const query = workCodeSearchQuery.toLowerCase();
      return (
        wc.code.toLowerCase().includes(query) ||
        wc.name.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      // Sort by code first (handles both numeric and alphabetic codes)
      return a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' });
    });

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
      if (workCode && registratie.werktype !== workCode.name) {
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

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Global Date - shared across all project blocks */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('datum')} *</label>
                <input
                  type="date"
                  value={datum}
                  onChange={(e) => setDatum(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>

            {/* Project Blocks */}
            {projectBlocks.map((block, blockIndex) => (
              <div key={block.id} className="bg-white dark:bg-gray-800 rounded-lg shadow">
                {/* Block Header */}
                <div
                  className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer"
                  onClick={() => toggleProjectBlockCollapse(block.id)}
                >
                  <div className="flex items-center space-x-3">
                    {block.isCollapsed ? <ChevronRight size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      Project {blockIndex + 1}: {block.project?.naam || 'Niet geselecteerd'}
                    </h3>
                    {block.project && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({getBlockTotalHours(block).toFixed(1)} uur)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {projectBlocks.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeProjectBlock(block.id);
                        }}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Verwijder dit project"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Block Content */}
                {!block.isCollapsed && (
                  <div className="p-6 space-y-4">
                    {/* Project Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('project')} *</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={block.project?.id || ''}
                          onChange={(e) => {
                            const project = projecten.find(p => p.id === e.target.value);
                            updateProjectBlock(block.id, 'project', project || null);
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
                        <div className="flex gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => openProjectSearch(block.id)}
                            className="flex-1 sm:flex-none px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
                            title="Zoek project"
                          >
                            <Search size={20} />
                            <span className="ml-2 sm:hidden">Zoeken</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickProjectBlockId(block.id);
                              setShowConfirmProjectModal(true);
                            }}
                            className="flex-1 sm:flex-none px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center justify-center"
                            title="Snel nieuw project aanmaken"
                          >
                            <Plus size={20} />
                            <span className="ml-2 sm:hidden">Nieuw</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Progress and Kilometers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Voortgang project (%)</label>
                        <input
                          type="number"
                          value={block.voortgang}
                          onChange={(e) => updateProjectBlock(block.id, 'voortgang', e.target.value)}
                          min="0"
                          max="100"
                          placeholder="0-100"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gereden kilometers</label>
                          <div className="group relative">
                            <Info size={16} className="text-gray-400 cursor-help" />
                            <div className="invisible group-hover:visible absolute z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded-md shadow-lg -top-2 left-6">
                              Dit zijn kilometers die niet met een zakelijke auto gereden worden.
                            </div>
                          </div>
                        </div>
                        <input
                          type="number"
                          value={block.kilometers}
                          onChange={(e) => updateProjectBlock(block.id, 'kilometers', e.target.value)}
                          min="0"
                          step="0.1"
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        />
                      </div>
                    </div>

                    {/* Work Lines */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Werkregels (Bewakingscodes)</h4>
                        <button
                          type="button"
                          onClick={() => addWorkLineToBlock(block.id)}
                          className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                        >
                          <Plus size={16} />
                          Regel toevoegen
                        </button>
                      </div>

                      <div className="space-y-3">
                        {block.workLines.map((line, lineIndex) => (
                          <div key={lineIndex} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                            <div className="flex items-start justify-between mb-3">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Regel {lineIndex + 1}</span>
                              {block.workLines.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeWorkLineFromBlock(block.id, lineIndex)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  <Minus size={18} />
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Bewakingscode *
                                  {block.hasProjectSpecificCodes && (
                                    <span className="ml-1 text-xs text-blue-600 dark:text-blue-400">(project-specifiek)</span>
                                  )}
                                </label>
                                <button
                                  type="button"
                                  onClick={() => openWorkCodeSearch(block.id, lineIndex)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-left focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 flex items-center justify-between"
                                >
                                  {line.work_code_id ? (
                                    <span className="text-gray-900 dark:text-white truncate">
                                      {(() => {
                                        const codes = block.availableWorkCodes.length > 0 ? block.availableWorkCodes : workCodes;
                                        const wc = codes.find(c => c.id === line.work_code_id);
                                        return wc ? `${wc.code} - ${wc.name}` : 'Selecteer code';
                                      })()}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-gray-500">Zoek bewakingscode...</span>
                                  )}
                                  <Search size={16} className="text-gray-400 flex-shrink-0 ml-2" />
                                </button>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('aantalUren')} *</label>
                                <input
                                  type="number"
                                  value={line.aantal_uren || ''}
                                  onChange={(e) => updateWorkLineInBlock(block.id, lineIndex, 'aantal_uren', parseFloat(e.target.value) || 0)}
                                  step="0.5"
                                  min="0"
                                  required
                                  placeholder="bv. 8"
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('werkomschrijving')} *</label>
                                <input
                                  type="text"
                                  value={line.werkomschrijving}
                                  onChange={(e) => updateWorkLineInBlock(block.id, lineIndex, 'werkomschrijving', e.target.value)}
                                  required
                                  placeholder="Beschrijf het werk"
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                />
                              </div>
                            </div>

                            {/* Materials */}
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Materialen</label>
                                <button
                                  type="button"
                                  onClick={() => addMaterialToWorkLine(block.id, lineIndex)}
                                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                >
                                  <Plus size={12} />
                                  Materiaal
                                </button>
                              </div>

                              {line.materials && line.materials.length > 0 && (
                                <div className="space-y-2">
                                  {line.materials.map((material, matIdx) => (
                                    <div key={matIdx} className="flex gap-2 items-center bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                                      <select
                                        value={material.product_id || ''}
                                        onChange={(e) => updateMaterial(block.id, lineIndex, matIdx, 'product_id', e.target.value)}
                                        className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      >
                                        <option value="">Product...</option>
                                        {products.map((p: any) => (
                                          <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                      </select>
                                      <input
                                        type="number"
                                        value={material.quantity || ''}
                                        onChange={(e) => updateMaterial(block.id, lineIndex, matIdx, 'quantity', parseFloat(e.target.value) || 0)}
                                        placeholder="Aantal"
                                        min="0"
                                        className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      />
                                      <span className="text-xs text-gray-500 w-12">{material.unit || ''}</span>
                                      <button
                                        type="button"
                                        onClick={() => removeMaterialFromWorkLine(block.id, lineIndex, matIdx)}
                                        className="text-red-500 hover:text-red-700"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Block Total */}
                      <div className="mt-3 p-2 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300">
                        <strong>Subtotaal:</strong> {getBlockTotalHours(block).toFixed(1)} uur
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add Another Project Button */}
            <button
              type="button"
              onClick={addProjectBlock}
              className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-red-500 hover:text-red-500 dark:hover:border-red-500 dark:hover:text-red-500 transition-colors flex items-center justify-center space-x-2"
            >
              <Plus size={20} />
              <span>Nog een project toevoegen</span>
            </button>

            {/* Grand Total and Submit */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold text-gray-800 dark:text-white">
                  Totaal: {getGrandTotalHours().toFixed(1)} uur
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {projectBlocks.length} project{projectBlocks.length !== 1 ? 'en' : ''}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
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
            </div>
          </form>
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Alle gebruikers</option>
                    {gebruikers.map((g: any) => (
                      <option key={g.id} value={g.id}>{g.naam}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Periode</label>
                <select
                  value={dateRangeFilter}
                  onChange={(e) => handleDateRangeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
              />
              <DatePickerField
                label={t('totDatum')}
                value={endDateFilter}
                onChange={(date) => {
                  setEndDateFilter(date);
                  setDateRangeFilter('custom');
                }}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bewakingscode</label>
                <select
                  value={workCodeFilter}
                  onChange={(e) => setWorkCodeFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">Alle codes</option>
                  {workCodes.map((wc) => (
                    <option key={wc.id} value={wc.id}>{wc.code} - {wc.name}</option>
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
                className="w-full md:w-80 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Table */}
          {filteredRegistraties.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Registraties ({filteredRegistraties.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{t('datum')}</th>
                      {hasPermission('view_reports') && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gebruiker</th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Project</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Uren</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Omschrijving</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {paginatedRegistraties.map((reg) => (
                      <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatDate(reg.datum)}</td>
                        {hasPermission('view_reports') && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {gebruikers.find((g: any) => g.id === reg.user_id)?.naam || 'Onbekend'}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {reg.project_naam || projecten.find(p => p.id === reg.project_id)?.naam || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{reg.werktype}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{reg.aantal_uren}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">{reg.werkomschrijving}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex space-x-2">
                            {isRegistrationEditable(reg) && (
                              <>
                                <button onClick={() => handleEditRegistration(reg)} className="text-blue-600 hover:text-blue-900">
                                  <Pencil size={16} />
                                </button>
                                {hasPermission('approve_hours') && (
                                  <button onClick={() => handleDeleteRegistration(reg.id)} className="text-red-600 hover:text-red-900">
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Pagina {currentPage} van {totalPages}
                  </span>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border rounded disabled:opacity-50 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border rounded disabled:opacity-50 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">Geen registraties gevonden.</p>
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Registratie bewerken">
        {editingRegistration && (
          <form onSubmit={handleUpdateRegistration} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Datum</label>
              <input
                type="date"
                value={editingRegistration.datum}
                onChange={(e) => setEditingRegistration({ ...editingRegistration, datum: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bewakingscode</label>
              <select
                value={editingRegistration.werktype}
                onChange={(e) => setEditingRegistration({ ...editingRegistration, werktype: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {workCodes.map((wc) => (
                  <option key={wc.id} value={wc.name}>{wc.code} - {wc.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Aantal uren</label>
              <input
                type="number"
                step="0.5"
                value={editingRegistration.aantalUren}
                onChange={(e) => setEditingRegistration({ ...editingRegistration, aantalUren: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Omschrijving</label>
              <textarea
                value={editingRegistration.werkomschrijving}
                onChange={(e) => setEditingRegistration({ ...editingRegistration, werkomschrijving: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300">
                Annuleren
              </button>
              <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
                Opslaan
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Confirm Project Modal */}
      <Modal isOpen={showConfirmProjectModal} onClose={() => setShowConfirmProjectModal(false)} title="Nieuw project?">
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          Weet je zeker dat het project niet in de lijst staat?
        </p>
        <div className="flex justify-end space-x-3">
          <button onClick={() => setShowConfirmProjectModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300">
            Nee
          </button>
          <button
            onClick={() => {
              setShowConfirmProjectModal(false);
              setShowQuickProjectModal(true);
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Ja
          </button>
        </div>
      </Modal>

      {/* Quick Project Modal */}
      <Modal isOpen={showQuickProjectModal} onClose={() => setShowQuickProjectModal(false)} title="Snel project aanmaken">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Kantoorpersoneel vult later de details aan.
          </p>
          <input
            type="text"
            value={quickProjectName}
            onChange={(e) => setQuickProjectName(e.target.value)}
            placeholder="Projectnaam"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            onKeyPress={(e) => e.key === 'Enter' && handleQuickProjectCreate()}
          />
          <div className="flex justify-end space-x-3">
            <button onClick={() => setShowQuickProjectModal(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300">
              Annuleren
            </button>
            <button onClick={handleQuickProjectCreate} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">
              Aanmaken
            </button>
          </div>
        </div>
      </Modal>

      {/* Creating Modal */}
      <Modal isOpen={showProjectCreatingModal} onClose={() => {}} title="Project aanmaken...">
        <div className="py-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Even geduld...</p>
        </div>
      </Modal>

      {/* Project Search Modal */}
      {showProjectSearchModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => {
                setShowProjectSearchModal(false);
                setProjectSearchQuery('');
                setSearchingForBlockId(null);
              }}
            />

            {/* Modal Panel */}
            <div className="relative w-full sm:max-w-lg transform overflow-hidden bg-white dark:bg-gray-800 shadow-xl transition-all sm:rounded-lg h-[80vh] sm:h-auto sm:max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-lg">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-2xl sm:rounded-t-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Project zoeken
                </h3>
                <button
                  onClick={() => {
                    setShowProjectSearchModal(false);
                    setProjectSearchQuery('');
                    setSearchingForBlockId(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search Input */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={projectSearchQuery}
                    onChange={(e) => setProjectSearchQuery(e.target.value)}
                    placeholder="Zoek op naam, nummer, adres of plaats..."
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  />
                  {projectSearchQuery && (
                    <button
                      onClick={() => setProjectSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Project List */}
              <div className="flex-1 overflow-y-auto">
                {filteredProjectsForSearch.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Geen projecten gevonden
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredProjectsForSearch.map((project: any) => (
                      <li key={project.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectProjectFromSearch(project)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {project.naam}
                              </p>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                {project.project_nummer && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    #{project.project_nummer}
                                  </span>
                                )}
                                {project.adres && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                    {project.adres}
                                  </span>
                                )}
                                {project.plaats && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {project.plaats}
                                  </span>
                                )}
                              </div>
                            </div>
                            {project.progress_percentage !== undefined && project.progress_percentage !== null && (
                              <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                                {project.progress_percentage}%
                              </span>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer with count */}
              <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400">
                {filteredProjectsForSearch.length} project{filteredProjectsForSearch.length !== 1 ? 'en' : ''} gevonden
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Work Code Search Modal */}
      {showWorkCodeSearchModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-end sm:items-center justify-center p-0 sm:p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => {
                setShowWorkCodeSearchModal(false);
                setWorkCodeSearchQuery('');
                setWorkCodeSearchBlockId(null);
                setWorkCodeSearchLineIndex(null);
              }}
            />

            {/* Modal Panel */}
            <div className="relative w-full sm:max-w-lg transform overflow-hidden bg-white dark:bg-gray-800 shadow-xl transition-all sm:rounded-lg h-[80vh] sm:h-auto sm:max-h-[80vh] flex flex-col rounded-t-2xl sm:rounded-lg">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-2xl sm:rounded-t-lg">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Bewakingscode zoeken
                </h3>
                <button
                  onClick={() => {
                    setShowWorkCodeSearchModal(false);
                    setWorkCodeSearchQuery('');
                    setWorkCodeSearchBlockId(null);
                    setWorkCodeSearchLineIndex(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search Input */}
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={workCodeSearchQuery}
                    onChange={(e) => setWorkCodeSearchQuery(e.target.value)}
                    placeholder="Zoek op code of naam..."
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                  />
                  {workCodeSearchQuery && (
                    <button
                      onClick={() => setWorkCodeSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Work Code List */}
              <div className="flex-1 overflow-y-auto">
                {filteredWorkCodesForSearch.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Geen bewakingscodes gevonden
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredWorkCodesForSearch.map((wc) => (
                      <li key={wc.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectWorkCodeFromSearch(wc)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 mr-2">
                                  {wc.code}
                                </span>
                                {wc.name}
                              </p>
                              {wc.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                                  {wc.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Footer with count */}
              <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400">
                {filteredWorkCodesForSearch.length} bewakingscode{filteredWorkCodesForSearch.length !== 1 ? 's' : ''} gevonden
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UrenregistratieV2;
