import React, { useState, useEffect } from 'react';
import { X, CreditCard as Edit, Trash2, Download, Users, Clock, Package, FileText } from 'lucide-react';
import { formatDate } from '../utils/dateUtils';
import Modal from './Modal';
import { supabase } from '../lib/supabase';
import { generateInvoicePDF } from '../utils/pdfGenerator';

interface ProjectDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  totalHours: number;
  projectUsers: Array<{
    userId: string;
    naam: string;
    totalHours: number;
    registrations: any[];
  }>;
  projectRegistrations: any[];
  onEdit: () => void;
  onDelete: () => void;
  gebruikers: any[];
  hasEditPermission: boolean;
}

const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({
  isOpen,
  onClose,
  project,
  totalHours,
  projectUsers,
  projectRegistrations,
  onEdit,
  onDelete,
  gebruikers,
  hasEditPermission,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'registrations' | 'materials'>('overview');
  const [projectMaterials, setProjectMaterials] = useState<any[]>([]);
  const [moduleSettings, setModuleSettings] = useState<any>(null);

  useEffect(() => {
    if (isOpen && project?.id) {
      loadProjectMaterials();
      loadModuleSettings();
    }
  }, [isOpen, project?.id]);

  const loadModuleSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('module_invoicing, csv_separator')
        .maybeSingle();

      setModuleSettings(data);
    } catch (error) {
      console.error('Error loading module settings:', error);
    }
  };

  const loadProjectMaterials = async () => {
    const { data, error } = await supabase
      .from('inventory_transactions')
      .select('*, product:inventory_products(*), location:inventory_locations(*), user:profiles(naam)')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    if (data) {
      setProjectMaterials(data);
    }
  };

  const handleExportInvoice = async () => {
    try {
      const result = await generateInvoicePDF(project.id, project.naam, project.project_nummer || 'N/A');
      alert(result.message);
    } catch (error: any) {
      alert(error.message || 'Fout bij het genereren van de factuur');
    }
  };

  const exportToExcel = () => {
    // Get CSV separator from settings, default to semicolon
    const separator = moduleSettings?.csv_separator || ';';

    // Helper function to escape CSV values
    const escapeCSV = (value: any) => {
      const stringValue = value !== null && value !== undefined ? String(value) : '';
      if (stringValue.includes(separator) || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes(',')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Project information section - fill empty columns to align with time registrations
    const projectInfoHeaders = ['Veld', 'Waarde', '', '', '', '', '', '', '', '', ''];
    const projectInfo = [
      ['PROJECT INFORMATIE', '', '', '', '', '', '', '', '', '', ''],
      projectInfoHeaders,
      ['Projectnaam', project.naam, '', '', '', '', '', '', '', '', ''],
      ['Projectnummer', project.project_nummer || 'N/A', '', '', '', '', '', '', '', '', ''],
      ['Status', project.status, '', '', '', '', '', '', '', '', ''],
      ['Beschrijving', project.beschrijving || '', '', '', '', '', '', '', '', '', ''],
      ['Start datum', formatDate(project.start_datum), '', '', '', '', '', '', '', '', ''],
      ['Voortgang percentage', project.progress_percentage ? `${project.progress_percentage}%` : '0%', '', '', '', '', '', '', '', '', ''],
      ['Totaal uren geregistreerd', `${totalHours.toFixed(1)}h`, '', '', '', '', '', '', '', '', ''],
      ['Berekende uren', project.calculated_hours ? `${project.calculated_hours}h` : 'N/A', '', '', '', '', '', '', '', '', ''],
      ['Oppervlakte', project.oppervlakte_m2 ? `${project.oppervlakte_m2} m²` : 'N/A', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', ''],
      ['URENREGISTRATIES', '', '', '', '', '', '', '', '', '', '']
    ];

    // Time registrations with all available fields
    const headers = [
      'Datum',
      'Werknemer',
      'Werktype',
      'Aantal Uren',
      'Kilometers',
      'Werkomschrijving',
      'Locatie',
      'Voortgang %',
      'Status',
      'Project Naam',
      'Aangemaakt op',
      'Laatst gewijzigd'
    ];

    const rows = projectRegistrations.map(reg => {
      const gebruiker = gebruikers.find((g: any) => g.id === reg.user_id);

      return [
        formatDate(reg.datum),
        gebruiker?.naam || 'Onbekend',
        reg.werktype || '',
        parseFloat(reg.aantal_uren) || 0,
        reg.driven_kilometers || 0,
        reg.werkomschrijving || '',
        reg.locatie || '',
        reg.progress_percentage || 0,
        reg.status || '',
        reg.project_naam || project.naam,
        reg.created_at ? new Date(reg.created_at).toLocaleString('nl-NL') : '',
        reg.updated_at ? new Date(reg.updated_at).toLocaleString('nl-NL') : ''
      ];
    });

    // Materials section
    const materialsHeader = ['', '', '', '', '', '', '', '', '', '', ''];
    const materialsSectionHeader = ['MATERIALEN', '', '', '', '', '', '', '', '', '', ''];
    const materialsColumnHeaders = ['Datum', 'Product', 'SKU', 'Aantal', 'Eenheid', 'Locatie', 'Gebruiker', 'Notities', '', '', ''];

    const materialRows = projectMaterials.map(transaction => [
      formatDate(transaction.created_at),
      transaction.product?.name || 'Onbekend',
      transaction.product?.sku || 'N/A',
      transaction.quantity || 0,
      transaction.product?.unit || '',
      transaction.location?.name || 'N/A',
      transaction.user?.naam || 'Onbekend',
      transaction.notes || '',
      '',
      '',
      ''
    ]);

    // Build complete CSV content
    const csvRows = [
      // Project info
      ...projectInfo,
      // Time registration headers and data
      headers,
      ...rows,
      // Materials section
      materialsHeader,
      materialsSectionHeader,
      materialsColumnHeaders,
      ...materialRows
    ];

    // Convert all rows to CSV strings
    const csvContent = csvRows
      .map(row => row.map(escapeCSV).join(separator))
      .join('\n');

    // Download with BOM for Excel compatibility
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${project.naam}_volledig_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={project.naam}>
      <div className="space-y-4">
        {/* Header Actions */}
        <div className="flex justify-between items-center border-b border-gray-200 pb-4">
          <div>
            <p className="text-sm text-gray-500">#{project.project_nummer || 'Geen nummer'}</p>
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full mt-2 ${
              project.status === 'actief' ? 'bg-green-100 text-green-800' :
              project.status === 'voltooid' ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {project.status}
            </span>
          </div>
          <div className="flex space-x-2">
            {moduleSettings?.module_invoicing !== false && (
              <button
                onClick={handleExportInvoice}
                className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
              >
                <FileText size={16} />
                <span>Factuur</span>
              </button>
            )}
            <button
              onClick={exportToExcel}
              className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
            >
              <Download size={16} />
              <span>Excel</span>
            </button>
            {hasEditPermission && (
              <>
                <button
                  onClick={onEdit}
                  className="flex items-center space-x-1 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                >
                  <Edit size={16} />
                  <span>Bewerken</span>
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center space-x-1 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
                >
                  <Trash2 size={16} />
                  <span>Verwijderen</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`${
                activeTab === 'overview'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              Overzicht
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`${
                activeTab === 'users'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
            >
              <Users size={16} />
              <span>Uren per Gebruiker ({projectUsers.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('registrations')}
              className={`${
                activeTab === 'registrations'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
            >
              <Clock size={16} />
              <span>Alle Registraties ({projectRegistrations.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('materials')}
              className={`${
                activeTab === 'materials'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2`}
            >
              <Package size={16} />
              <span>Materiaal ({projectMaterials.length})</span>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="max-h-96 overflow-y-auto">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-800 mb-2">Beschrijving</h3>
                <p className="text-gray-600">{project.beschrijving}</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-2">Start Datum</h3>
                <p className="text-gray-600">{formatDate(project.start_datum)}</p>
              </div>
              {project.oppervlakte_m2 && (
                <div>
                  <h3 className="font-medium text-gray-800 mb-2">Oppervlakte</h3>
                  <p className="text-gray-600">{project.oppervlakte_m2} m²</p>
                </div>
              )}
              <div>
                <h3 className="font-medium text-gray-800 mb-2">Totaal Uren</h3>
                <p className="text-2xl font-bold text-red-600">{totalHours.toFixed(1)}h</p>
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-2">Kilometers Geregistreerd</h3>
                <p className="text-2xl font-bold text-red-600">
                  {projectRegistrations.reduce((sum, reg) => sum + (parseFloat(reg.driven_kilometers) || 0), 0).toFixed(1)} km
                </p>
              </div>
              {project.progress_percentage > 0 && (
                <div>
                  <h3 className="font-medium text-gray-800 mb-2">Voortgang</h3>
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-red-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${project.progress_percentage}%` }}
                      ></div>
                    </div>
                    <span className="font-medium text-gray-800">{project.progress_percentage}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-3">
              {projectUsers.map((userInfo) => (
                <div key={userInfo.userId} className="bg-gray-50 rounded p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-800">{userInfo.naam}</span>
                    <span className="text-red-600 font-semibold text-lg">{userInfo.totalHours.toFixed(1)}h</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {userInfo.registrations.length} {userInfo.registrations.length === 1 ? 'registratie' : 'registraties'}
                  </div>
                </div>
              ))}
              {projectUsers.length === 0 && (
                <p className="text-gray-500 text-center py-4">Geen uren geregistreerd</p>
              )}
            </div>
          )}

          {activeTab === 'registrations' && (
            <div className="space-y-2">
              {projectRegistrations.map((reg: any) => {
                const gebruiker = gebruikers.find((g: any) => g.id === reg.user_id);

                return (
                  <div key={reg.id} className="bg-gray-50 rounded p-3 text-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">{gebruiker?.naam || 'Onbekend'}</span>
                        <span className="text-xs text-gray-500">{formatDate(reg.datum)}</span>
                      </div>
                      <span className="text-red-600 font-semibold">{parseFloat(reg.aantal_uren) || 0}h</span>
                    </div>

                    <div className="text-gray-600 mb-1">{reg.werkomschrijving}</div>
                    <div className="text-gray-400 mb-1">{reg.werktype}</div>

                    {/* Additional information */}
                    <div className="flex flex-wrap gap-3 mt-2 pt-2 border-t border-gray-200">
                      {reg.driven_kilometers > 0 && (
                        <div className="text-xs">
                          <span className="text-gray-500">Kilometers:</span>
                          <span className="text-gray-700 ml-1 font-medium">{parseFloat(reg.driven_kilometers).toFixed(1)} km</span>
                        </div>
                      )}
                      {reg.locatie && (
                        <div className="text-xs">
                          <span className="text-gray-500">Locatie:</span>
                          <span className="text-gray-700 ml-1">{reg.locatie}</span>
                        </div>
                      )}
                      {reg.progress_percentage > 0 && (
                        <div className="text-xs">
                          <span className="text-gray-500">Voortgang:</span>
                          <span className="text-blue-600 font-medium ml-1">{reg.progress_percentage}%</span>
                        </div>
                      )}
                      {reg.status && (
                        <div className="text-xs">
                          <span className="text-gray-500">Status:</span>
                          <span className={`ml-1 font-medium ${
                            reg.status === 'goedgekeurd' ? 'text-green-600' :
                            reg.status === 'afgekeurd' ? 'text-red-600' :
                            'text-yellow-600'
                          }`}>{reg.status}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {projectRegistrations.length === 0 && (
                <p className="text-gray-500 text-center py-4">Geen registraties gevonden</p>
              )}
            </div>
          )}

          {activeTab === 'materials' && (
            <div className="space-y-2">
              {projectMaterials.map((transaction: any) => {
                return (
                  <div key={transaction.id} className="bg-gray-50 rounded p-3 text-sm border border-gray-200">
                    <div className="flex justify-between items-start mb-1">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-800">{transaction.product?.name}</span>
                        <span className="text-xs text-gray-500">{transaction.product?.sku}</span>
                      </div>
                      <span className={`font-semibold ${transaction.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {transaction.quantity > 0 ? '+' : ''}{transaction.quantity} {transaction.product?.unit}
                      </span>
                    </div>
                    <div className="text-gray-500 mb-1">{formatDate(transaction.created_at)}</div>
                    <div className="text-gray-600">
                      {transaction.user?.naam || 'Onbekend'} - {transaction.location?.name}
                    </div>
                    {transaction.notes && (
                      <div className="text-gray-400 mt-1 text-xs">{transaction.notes}</div>
                    )}
                  </div>
                );
              })}
              {projectMaterials.length === 0 && (
                <p className="text-gray-500 text-center py-4">Geen materiaal geboekt</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ProjectDetailsModal;
