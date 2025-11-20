import React, { useState } from 'react';
import { Mail, Plus, Edit, Trash2, Clock, Users, Settings, Save, X, Play, Pause, Send } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery, useSupabaseMutation } from '../hooks/useSupabase';
import { supabase } from '../lib/supabase';
import Modal from '../components/Modal';

type EmailEvent = "document_processed" | "document_failed" | "daily_summary" | "weekly_summary";

interface EmailTemplate {
  id: string;
  name: string;
  type: 'missing_hours' | 'weekly_overview';
  subject: string;
  body: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface EmailSchedule {
  id: string;
  template_id: string;
  schedule_type: 'weekly' | 'daily';
  day_of_week: number | null;
  hour: number;
  target_roles: string[] | null;
  target_users: string[] | null;
  hours_check_type: 'weekly' | 'daily' | null;
  minimum_weekly_hours: number | null;
  minimum_daily_hours: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  template?: EmailTemplate;
}

interface EmailLog {
  id: string;
  template_id: string;
  user_id: string | null;
  to_email: string;
  subject: string;
  status: 'sent' | 'failed' | 'pending';
  error?: string;
  meta?: any;
  created_at: string;
  template?: EmailTemplate;
  profiles?: {
    naam: string;
  };
}

const EmailNotifications: React.FC = () => {
  const { t } = useLanguage();
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'templates' | 'schedules' | 'logs'>('templates');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<EmailSchedule | null>(null);
  const [sendingTestEmail, setSendingTestEmail] = useState<string | null>(null);

  // Single source of truth for the display name
  const userName = user?.naam || user?.email?.split('@')[0] || 'there';

  // Fetch data
  const { data: templates = [], loading: templatesLoading, refetch: refetchTemplates } = useSupabaseQuery<EmailTemplate>('email_templates');
  const { data: schedules = [], loading: schedulesLoading, refetch: refetchSchedules } = useSupabaseQuery<any>(
    'email_schedules',
    '*, template:email_templates(*)'
  );
  const { data: logs = [], loading: logsLoading, refetch: refetchLogs } = useSupabaseQuery<any>(
    'email_logs',
    '*, template:email_templates(*), profiles:user_id(*)',
    {},
    { order: { column: 'created_at', ascending: false }, limit: 100 }
  );
  const { data: allUsers = [] } = useSupabaseQuery<any>('profiles', 'id, naam, email, role');

  // Mutations
  const { insert: insertTemplate, update: updateTemplate, remove: deleteTemplate } = useSupabaseMutation('email_templates');
  const { insert: insertSchedule, update: updateSchedule, remove: deleteSchedule } = useSupabaseMutation('email_schedules');

  const [templateForm, setTemplateForm] = useState({
    name: '',
    type: 'missing_hours' as const,
    subject: '',
    body: '',
    enabled: true,
  });

  const [scheduleForm, setScheduleForm] = useState({
    template_id: '',
    schedule_type: 'weekly' as 'weekly' | 'daily',
    day_of_week: 5, // Friday
    hour: 9,
    target_type: 'roles' as 'roles' | 'users',
    target_roles: ['medewerker'] as string[],
    target_users: [] as string[],
    hours_check_type: 'weekly' as 'weekly' | 'daily',
    minimum_weekly_hours: 40,
    minimum_daily_hours: 8,
    enabled: true,
  });

  const dayNames = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  const roleNames: Record<string, string> = {
    admin: 'Administrator',
    kantoorpersoneel: 'Kantoorpersoneel',
    medewerker: 'Medewerker',
    zzper: 'ZZPer'
  };

  const handleTemplateSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();

    try {
      const payload = {
        name: templateForm.name,
        type: templateForm.type,
        subject: templateForm.subject,
        body: templateForm.body,
        enabled: templateForm.enabled,
      };

      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, payload);
      } else {
        await insertTemplate(payload);
      }

      setShowTemplateModal(false);
      setEditingTemplate(null);
      resetTemplateForm();
      refetchTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);

      if (error?.code === '23505' || error?.message?.includes('duplicate key') || error?.message?.includes('email_templates_name_key')) {
        alert(`Er bestaat al een template met de naam "${templateForm.name}". Kies een andere naam.`);
      } else if (error?.message) {
        alert(`Er is een fout opgetreden: ${error.message}`);
      } else {
        alert('Er is een fout opgetreden bij het opslaan van de template.');
      }
    }
  };

  const handleScheduleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();

    try {
      const payload: any = {
        template_id: scheduleForm.template_id,
        schedule_type: scheduleForm.schedule_type,
        day_of_week: scheduleForm.schedule_type === 'weekly' ? scheduleForm.day_of_week : null,
        hour: scheduleForm.hour,
        target_roles: scheduleForm.target_type === 'roles' ? scheduleForm.target_roles : null,
        target_users: scheduleForm.target_type === 'users' ? scheduleForm.target_users : null,
        hours_check_type: scheduleForm.hours_check_type,
        minimum_weekly_hours: scheduleForm.hours_check_type === 'weekly' ? scheduleForm.minimum_weekly_hours : null,
        minimum_daily_hours: scheduleForm.hours_check_type === 'daily' ? scheduleForm.minimum_daily_hours : null,
        enabled: scheduleForm.enabled,
      };

      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, payload);
      } else {
        await insertSchedule(payload);
      }

      setShowScheduleModal(false);
      setEditingSchedule(null);
      resetScheduleForm();
      refetchSchedules();
    } catch (error: any) {
      console.error('Error saving schedule:', error);

      if (error?.message) {
        alert(`Er is een fout opgetreden: ${error.message}`);
      } else {
        alert('Er is een fout opgetreden bij het opslaan van het schema.');
      }
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      type: 'missing_hours',
      subject: '',
      body: '',
      enabled: true,
    });
  };

  const resetScheduleForm = () => {
    setScheduleForm({
      template_id: '',
      schedule_type: 'weekly',
      day_of_week: 5,
      hour: 9,
      target_type: 'roles',
      target_roles: ['medewerker'],
      target_users: [],
      hours_check_type: 'weekly',
      minimum_weekly_hours: 40,
      minimum_daily_hours: 8,
      enabled: true,
    });
  };

  const handleEditTemplate = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      type: template.type,
      subject: template.subject,
      body: template.body,
      enabled: template.enabled,
    });
    setShowTemplateModal(true);
  };

  const handleEditSchedule = (schedule: EmailSchedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      template_id: schedule.template_id,
      schedule_type: schedule.schedule_type,
      day_of_week: schedule.day_of_week || 5,
      hour: schedule.hour,
      target_type: schedule.target_users && schedule.target_users.length > 0 ? 'users' : 'roles',
      target_roles: schedule.target_roles || ['medewerker'],
      target_users: schedule.target_users || [],
      hours_check_type: schedule.hours_check_type || 'weekly',
      minimum_weekly_hours: schedule.minimum_weekly_hours || 40,
      minimum_daily_hours: schedule.minimum_daily_hours || 8,
      enabled: schedule.enabled,
    });
    setShowScheduleModal(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (window.confirm('Weet je zeker dat je deze template wilt verwijderen?')) {
      try {
        await deleteTemplate(id);
        refetchTemplates();
      } catch (error) {
        console.error('Error deleting template:', error);
        alert('Er is een fout opgetreden bij het verwijderen van de template.');
      }
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (window.confirm('Weet je zeker dat je dit schema wilt verwijderen?')) {
      try {
        await deleteSchedule(id);
        refetchSchedules();
      } catch (error) {
        console.error('Error deleting schedule:', error);
        alert('Er is een fout opgetreden bij het verwijderen van het schema.');
      }
    }
  };

  const toggleTemplateEnabled = async (template: EmailTemplate) => {
    try {
      await updateTemplate(template.id, { enabled: !template.enabled });
      refetchTemplates();
    } catch (error) {
      console.error('Error toggling template:', error);
    }
  };

  const toggleScheduleEnabled = async (schedule: EmailSchedule) => {
    try {
      await updateSchedule(schedule.id, { enabled: !schedule.enabled });
      refetchSchedules();
    } catch (error) {
      console.error('Error toggling schedule:', error);
    }
  };

  const handleSendTestEmail = async (schedule: EmailSchedule) => {
    if (!schedule.template) {
      alert('Template niet gevonden voor dit schema');
      return;
    }

    setSendingTestEmail(schedule.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-scheduled-emails', {
        body: {
          test_mode: true,
          schedule_id: schedule.id,
          test_recipient: 'paulvdhoeven@live.nl',
        }
      });

      if (error) {
        console.error('Test email failed:', error);
        alert(`Test email mislukt: ${error.message}`);
      } else {
        const emailCount = data?.emailsSent || 0;
        const isDryRun = data?.details?.sent?.some((email: any) => email.dry_run) || false;

        alert(`Test email verzonden naar paulvdhoeven@live.nl!`);
        // Refresh logs to show the test email
        refetchLogs();
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      alert(`Fout bij verzenden test email: ${error.message}`);
    } finally {
      setSendingTestEmail(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Je hebt geen toegang tot deze pagina.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-3">
          <Mail className="text-red-600" />
          <span>E-mail Notificaties</span>
        </h1>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'templates'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Mail size={16} />
                <span>Templates</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('schedules')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'schedules'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Clock size={16} />
                <span>Schema's</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'logs'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Settings size={16} />
                <span>Logs</span>
              </div>
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-800">E-mail Templates</h2>
                <button
                  onClick={() => {
                    resetTemplateForm();
                    setEditingTemplate(null);
                    setShowTemplateModal(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  <Plus size={16} />
                  <span>Nieuwe Template</span>
                </button>
              </div>

              {templatesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {templates.map((template) => (
                    <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-medium text-gray-900">{template.name}</h3>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              template.type === 'missing_hours' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              {template.type === 'missing_hours' ? 'Ontbrekende Uren' : 'Week Overzicht'}
                            </span>
                            <button
                              onClick={() => toggleTemplateEnabled(template)}
                              className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                                template.enabled 
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                              }`}
                            >
                              {template.enabled ? <Play size={12} className="mr-1" /> : <Pause size={12} className="mr-1" />}
                              {template.enabled ? 'Actief' : 'Inactief'}
                            </button>
                          </div>
                          <p className="text-sm text-gray-600 mb-2"><strong>Onderwerp:</strong> {template.subject}</p>
                          <p className="text-sm text-gray-600 line-clamp-3">{template.body}</p>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => handleEditTemplate(template)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Schedules Tab */}
          {activeTab === 'schedules' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-gray-800">E-mail Schema's</h2>
                <button
                  onClick={() => {
                    resetScheduleForm();
                    setEditingSchedule(null);
                    setShowScheduleModal(true);
                  }}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  <Plus size={16} />
                  <span>Nieuw Schema</span>
                </button>
              </div>

              {schedulesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {schedules.map((schedule) => (
                    <div key={schedule.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-medium text-gray-900">
                              {schedule.template?.name || 'Onbekende Template'}
                            </h3>
                            <button
                              onClick={() => toggleScheduleEnabled(schedule)}
                              className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                                schedule.enabled 
                                  ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                              }`}
                            >
                              {schedule.enabled ? <Play size={12} className="mr-1" /> : <Pause size={12} className="mr-1" />}
                              {schedule.enabled ? 'Actief' : 'Inactief'}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                            <p><strong>Schema:</strong> {schedule.schedule_type === 'weekly' ? 'Wekelijks' : 'Dagelijks'}</p>
                            {schedule.schedule_type === 'weekly' && schedule.day_of_week !== null && (
                              <p><strong>Dag:</strong> {dayNames[schedule.day_of_week]}</p>
                            )}
                            <p><strong>Tijd:</strong> {schedule.hour}:00</p>
                            {schedule.hours_check_type && (
                              <p><strong>Uren check:</strong> {schedule.hours_check_type === 'weekly' ? 'Wekelijks' : 'Dagelijks'}</p>
                            )}
                            {schedule.minimum_weekly_hours && (
                              <p><strong>Min. wekelijkse uren:</strong> {schedule.minimum_weekly_hours}</p>
                            )}
                            {schedule.minimum_daily_hours && (
                              <p><strong>Min. dagelijkse uren:</strong> {schedule.minimum_daily_hours}</p>
                            )}
                            {schedule.target_roles && schedule.target_roles.length > 0 && (
                              <p><strong>Doelgroep:</strong> {schedule.target_roles.map(role => roleNames[role] || role).join(', ')}</p>
                            )}
                            {schedule.target_users && schedule.target_users.length > 0 && (
                              <p><strong>Specifieke gebruikers:</strong> {schedule.target_users.length} geselecteerd</p>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <button
                            onClick={() => handleSendTestEmail(schedule)}
                            disabled={sendingTestEmail === schedule.id}
                            className="flex items-center space-x-1 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                            title="Verstuur test email nu"
                          >
                            {sendingTestEmail === schedule.id ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                            ) : (
                              <Send size={14} />
                            )}
                            <span>{sendingTestEmail === schedule.id ? 'Verzenden...' : 'Test Nu'}</span>
                          </button>
                          <button
                            onClick={() => handleEditSchedule(schedule)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-6">E-mail Logs</h2>
              
              {logsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ontvanger</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Onderwerp</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verzonden</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {log.profiles?.naam || log.to_email.split('@')[0] || 'Onbekend'}
                              </div>
                              <div className="text-sm text-gray-500">{log.to_email}</div>
                              {log.meta?.test_mode && (
                                <div className="text-xs text-blue-600 font-medium">TEST</div>
                              )}
                              {log.meta?.dry_run && (
                                <div className="text-xs text-orange-600 font-medium">DRY RUN</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {log.template?.name || 'Onbekend'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                            {log.subject}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              log.status === 'sent' ? 'bg-green-100 text-green-800' :
                              log.status === 'failed' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {log.status === 'sent' ? 'Verzonden' :
                               log.status === 'failed' ? 'Mislukt' : 'In behandeling'}
                            </span>
                            {log.error && (
                              <div className="text-xs text-red-600 mt-1" title={log.error}>
                                Fout: {log.error.substring(0, 50)}...
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(log.created_at).toLocaleString('nl-NL')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Template Modal */}
      <Modal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title={editingTemplate ? 'Template Bewerken' : 'Nieuwe Template'}
      >
        <form onSubmit={handleTemplateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Naam *</label>
              <input
                type="text"
                value={templateForm.name}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
              <select
                value={templateForm.type}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, type: e.target.value as 'missing_hours' | 'weekly_overview' }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="missing_hours">Ontbrekende Uren</option>
                <option value="weekly_overview">Week Overzicht</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Onderwerp *</label>
            <input
              type="text"
              value={templateForm.subject}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, subject: e.target.value }))}
              required
              placeholder="Bijv: Ben je vergeten je uren in te vullen?"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail Inhoud *</label>
            <textarea
              value={templateForm.body}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, body: e.target.value }))}
              rows={8}
              required
              placeholder={`Gebruik {{user_name}}, {{hours_filled}}, {{total_hours}}, etc. voor dynamische waarden`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
            <div className="mt-2 text-xs text-gray-500">
              <p><strong>Beschikbare placeholders:</strong></p>
              <p>{`{{user_name}}, {{hours_filled}}, {{total_hours}}, {{week_number}}, {{app_url}}`}</p>
              <p>Voor projecten: {`{{#if projects}}...{{#each projects}}{{project_name}}: {{hours}}{{/each}}...{{/if}}`}</p>
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="enabled"
              checked={templateForm.enabled}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900">
              Template actief
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowTemplateModal(false)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              <Save size={16} className="inline mr-2" />
              {editingTemplate ? 'Bijwerken' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Schedule Modal */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title={editingSchedule ? 'Schema Bewerken' : 'Nieuw Schema'}
      >
        <form onSubmit={handleScheduleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template *</label>
            <select
              value={scheduleForm.template_id}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, template_id: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Selecteer template</option>
              {templates.filter(t => t.enabled).map(template => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schema Type *</label>
              <select
                value={scheduleForm.schedule_type}
                onChange={(e) => setScheduleForm(prev => ({ ...prev, schedule_type: e.target.value as 'weekly' | 'daily' }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                <option value="daily">Dagelijks</option>
                <option value="weekly">Wekelijks</option>
              </select>
            </div>

            {scheduleForm.schedule_type === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dag van de Week *</label>
                <select
                  value={scheduleForm.day_of_week}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, day_of_week: parseInt(e.target.value) }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  {dayNames.map((day, index) => (
                    <option key={index} value={index}>{day}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tijdstip *</label>
              <select
                value={scheduleForm.hour}
                onChange={(e) => setScheduleForm(prev => ({ ...prev, hour: parseInt(e.target.value) }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{i}:00</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Selectie Type *</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="roles"
                  checked={scheduleForm.target_type === 'roles'}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, target_type: e.target.value as 'roles' | 'users' }))}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-900">Doelgroep (Rollen)</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="users"
                  checked={scheduleForm.target_type === 'users'}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, target_type: e.target.value as 'roles' | 'users' }))}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-900">Specifieke Medewerkers</span>
              </label>
            </div>

            {scheduleForm.target_type === 'roles' ? (
              <div className="space-y-2">
                {Object.entries(roleNames).map(([role, name]) => (
                  <label key={role} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={scheduleForm.target_roles.includes(role)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setScheduleForm(prev => ({
                            ...prev,
                            target_roles: [...prev.target_roles, role]
                          }));
                        } else {
                          setScheduleForm(prev => ({
                            ...prev,
                            target_roles: prev.target_roles.filter(r => r !== role)
                          }));
                        }
                      }}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-900">{name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 rounded-md p-3">
                {allUsers.map((user: any) => (
                  <label key={user.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={scheduleForm.target_users.includes(user.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setScheduleForm(prev => ({
                            ...prev,
                            target_users: [...prev.target_users, user.id]
                          }));
                        } else {
                          setScheduleForm(prev => ({
                            ...prev,
                            target_users: prev.target_users.filter(id => id !== user.id)
                          }));
                        }
                      }}
                      className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-900">{user.naam} ({user.email})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Uren Controle Type</label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="weekly"
                  checked={scheduleForm.hours_check_type === 'weekly'}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, hours_check_type: e.target.value as 'weekly' | 'daily' }))}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-900">Wekelijkse Uren</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="daily"
                  checked={scheduleForm.hours_check_type === 'daily'}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, hours_check_type: e.target.value as 'weekly' | 'daily' }))}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                />
                <span className="ml-2 text-sm text-gray-900">Dagelijkse Uren</span>
              </label>
            </div>

            {scheduleForm.hours_check_type === 'weekly' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wekelijkse uren onder</label>
                <input
                  type="number"
                  value={scheduleForm.minimum_weekly_hours}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, minimum_weekly_hours: parseInt(e.target.value) || 0 }))}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Bijv. 40"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dagelijkse uren onder</label>
                <input
                  type="number"
                  value={scheduleForm.minimum_daily_hours}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, minimum_daily_hours: parseInt(e.target.value) || 0 }))}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Bijv. 8"
                />
              </div>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="schedule-enabled"
              checked={scheduleForm.enabled}
              onChange={(e) => setScheduleForm(prev => ({ ...prev, enabled: e.target.checked }))}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label htmlFor="schedule-enabled" className="ml-2 block text-sm text-gray-900">
              Schema actief
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowScheduleModal(false)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Annuleren
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              <Save size={16} className="inline mr-2" />
              {editingSchedule ? 'Bijwerken' : 'Aanmaken'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default EmailNotifications;