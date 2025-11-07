import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, CreditCard as Edit, Trash2, Eye, EyeOff, Mail, User, UserPlus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery, useSupabaseMutation } from '../hooks/useSupabase';
import { supabase } from '../lib/supabase';
import { formatDate } from '../utils/dateUtils';
import Modal from '../components/Modal';
import SupabaseErrorHelper from '../components/SupabaseErrorHelper';

interface UserProfile {
  id: string;
  naam: string;
  email: string;
  role: 'admin' | 'kantoorpersoneel' | 'medewerker' | 'zzper';
  hourly_rate_purchase?: number;
  hourly_rate_sale?: number;
  created_at: string;
  updated_at: string;
}

const Gebruikers: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { data: users = [], loading, refetch } = useSupabaseQuery<UserProfile>('profiles');
  const [hourlyRatesEnabled, setHourlyRatesEnabled] = useState(true);

  useEffect(() => {
    loadModuleSettings();
  }, []);

  const loadModuleSettings = async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('module_hourly_rates')
        .maybeSingle();

      setHourlyRatesEnabled(data?.module_hourly_rates !== false);
    } catch (error) {
      console.error('Error loading module settings:', error);
    }
  };
  const { insert: insertUser, update: updateUser, remove: deleteUser, loading: mutationLoading } = useSupabaseMutation('profiles');
  
  const [showModal, setShowModal] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState('');
  const [lastError, setLastError] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    naam: '',
    email: '',
    role: 'medewerker' as const,
    password: '',
    hourly_rate_purchase: 0,
    hourly_rate_sale: 0,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.naam || !formData.email || !formData.role) {
      alert(t('vulVerplichtVelden'));
      return;
    }

    if (!editingUser && !formData.password) {
      alert(t('passwordRequired'));
      return;
    }
    
    try {
      setLastError(null);
      
      if (editingUser) {
        // Update existing user
        await updateUser(editingUser.id, {
          naam: formData.naam,
          email: formData.email,
          role: formData.role,
          hourly_rate_purchase: formData.hourly_rate_purchase || null,
          hourly_rate_sale: formData.hourly_rate_sale || null,
        });

        setShowSuccessMessage(t('userUpdatedSuccessfully'));
      } else {
        // Create new user with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              role: formData.role,
              name: formData.naam
            }
          }
        });

        if (authError) {
          throw authError;
        }

        if (authData.user) {
          // Create profile for the new user
          await supabase.from('profiles').insert({
            id: authData.user.id,
            naam: formData.naam,
            email: formData.email,
            role: formData.role,
            hourly_rate_purchase: formData.hourly_rate_purchase || null,
            hourly_rate_sale: formData.hourly_rate_sale || null,
          });
        }

        setShowSuccessMessage(t('userCreatedSuccessfully'));
      }
      
      resetForm();
      setShowModal(false);
      setTimeout(() => setShowSuccessMessage(''), 3000);
      refetch();
    } catch (error: any) {
      console.error('Error saving user:', error);
      setLastError(error);
      
      if (error.message?.includes('duplicate key') || error.message?.includes('already registered')) {
        alert(t('emailAlreadyExists'));
      } else {
        alert('Er is een fout opgetreden bij het opslaan van de gebruiker.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      naam: '',
      email: '',
      role: 'medewerker',
      password: '',
    });
    setEditingUser(null);
  };

  const handleEditUser = (user: UserProfile) => {
    setFormData({
      naam: user.naam,
      email: user.email,
      role: user.role,
      password: '', // Never pre-fill password for security
      hourly_rate_purchase: user.hourly_rate_purchase || 0,
      hourly_rate_sale: user.hourly_rate_sale || 0,
    });
    setEditingUser(user);
    setShowModal(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === user?.id) {
      alert(t('cannotDeleteOwnAccount'));
      return;
    }

    try {
      // Check if user has any related data
      const [timeRegs, damageReports, returnItems, notifications, emailLogs] = await Promise.all([
        supabase.from('time_registrations').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('damage_reports').select('id', { count: 'exact', head: true }).eq('created_by', userId),
        supabase.from('return_items').select('id', { count: 'exact', head: true }).eq('created_by', userId),
        supabase.from('notifications').select('id', { count: 'exact', head: true }).or(`recipient_id.eq.${userId},sender_id.eq.${userId}`),
        supabase.from('email_logs').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      ]);

      const timeRegsCount = timeRegs.count || 0;
      const damageReportsCount = damageReports.count || 0;
      const returnItemsCount = returnItems.count || 0;
      const notificationsCount = notifications.count || 0;
      const emailLogsCount = emailLogs.count || 0;

      // Show confirmation with data counts
      const relatedData = [];
      if (timeRegsCount > 0) relatedData.push(`${timeRegsCount} urenregistratie(s)`);
      if (damageReportsCount > 0) relatedData.push(`${damageReportsCount} schademelding(en)`);
      if (returnItemsCount > 0) relatedData.push(`${returnItemsCount} retourboeking(en)`);
      if (notificationsCount > 0) relatedData.push(`${notificationsCount} notificatie(s)`);
      if (emailLogsCount > 0) relatedData.push(`${emailLogsCount} email log(s)`);

      let confirmMessage = 'Weet je zeker dat je deze gebruiker wilt verwijderen?';
      if (relatedData.length > 0) {
        confirmMessage += `\n\nDe volgende gekoppelde data wordt ook verwijderd:\n${relatedData.join('\n')}\n\nDeze actie kan niet ongedaan worden gemaakt.`;
      }

      if (!window.confirm(confirmMessage)) {
        return;
      }

      // Delete all related data first
      // 1. Delete time registrations
      if (timeRegsCount > 0) {
        const { error: timeRegsError } = await supabase
          .from('time_registrations')
          .delete()
          .eq('user_id', userId);

        if (timeRegsError) {
          console.error('Error deleting time registrations:', timeRegsError);
          throw new Error('Fout bij het verwijderen van urenregistraties: ' + timeRegsError.message);
        }
      }

      // 2. Delete damage reports
      if (damageReportsCount > 0) {
        const { error: damageError } = await supabase
          .from('damage_reports')
          .delete()
          .eq('created_by', userId);

        if (damageError) {
          console.error('Error deleting damage reports:', damageError);
          throw new Error('Fout bij het verwijderen van schademeldingen: ' + damageError.message);
        }
      }

      // 3. Delete return items
      if (returnItemsCount > 0) {
        const { error: returnError } = await supabase
          .from('return_items')
          .delete()
          .eq('created_by', userId);

        if (returnError) {
          console.error('Error deleting return items:', returnError);
          throw new Error('Fout bij het verwijderen van retourboekingen: ' + returnError.message);
        }
      }

      // 4. Delete notifications (both sent and received)
      if (notificationsCount > 0) {
        const { error: notifError } = await supabase
          .from('notifications')
          .delete()
          .or(`recipient_id.eq.${userId},sender_id.eq.${userId}`);

        if (notifError) {
          console.error('Error deleting notifications:', notifError);
          throw new Error('Fout bij het verwijderen van notificaties: ' + notifError.message);
        }
      }

      // 5. Delete notifications_v2 (both sent and received)
      const { error: notifV2Error } = await supabase
        .from('notifications_v2')
        .delete()
        .or(`recipient_id.eq.${userId},sender_id.eq.${userId}`);

      if (notifV2Error) {
        console.error('Error deleting notifications_v2:', notifV2Error);
        // Don't throw, just log - table might not have data
      }

      // 6. Delete email logs
      if (emailLogsCount > 0) {
        const { error: emailError } = await supabase
          .from('email_logs')
          .delete()
          .eq('user_id', userId);

        if (emailError) {
          console.error('Error deleting email logs:', emailError);
          throw new Error('Fout bij het verwijderen van email logs: ' + emailError.message);
        }
      }

      // 7. Set created_by to NULL for projects (don't delete projects)
      const { error: projectsError } = await supabase
        .from('projects')
        .update({ created_by: null })
        .eq('created_by', userId);

      if (projectsError) {
        console.error('Error updating projects:', projectsError);
        throw new Error('Fout bij het updaten van projecten: ' + projectsError.message);
      }

      // 8. Finally delete the profile
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
        throw new Error('Fout bij het verwijderen van het profiel: ' + profileError.message);
      }

      setShowSuccessMessage(t('userDeletedSuccessfully'));
      setTimeout(() => setShowSuccessMessage(''), 3000);
      refetch();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert('Er is een fout opgetreden bij het verwijderen van de gebruiker: ' + (error.message || 'Onbekende fout'));
    }
  };

  const handleNewUser = () => {
    resetForm();
    setShowModal(true);
  };

  // Filter users based on search term and role
  const filteredUsers = users.filter(userItem => {
    const matchesSearch = userItem.naam.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         userItem.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || userItem.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return t('administrator');
      case 'kantoorpersoneel':
        return t('officeStaff');
      case 'medewerker':
        return t('employee');
      case 'zzper':
        return t('contractor');
      default:
        return role;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'kantoorpersoneel':
        return 'bg-blue-100 text-blue-800';
      case 'medewerker':
        return 'bg-green-100 text-green-800';
      case 'zzper':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
          {showSuccessMessage}
        </div>
      )}
      
      <SupabaseErrorHelper 
        error={lastError} 
        table="profiles" 
        operation="INSERT" 
      />
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center space-x-3">
          <Users className="text-red-600" />
          <span>{t('userOverview')}</span>
        </h1>
        <button 
          onClick={handleNewUser}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          <Plus size={16} />
          <span>{t('addNewUser')}</span>
        </button>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('searchUsers')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">{t('allRoles')}</option>
              <option value="admin">{t('administrator')}</option>
              <option value="kantoorpersoneel">{t('officeStaff')}</option>
              <option value="medewerker">{t('employee')}</option>
              <option value="zzper">{t('contractor')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Overview */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">{t('manageUsers')}</h2>
          <p className="text-sm text-gray-600">
            {t('totalUsers')}: {filteredUsers.length} | 
            {t('administrators')}: {filteredUsers.filter(u => u.role === 'admin').length} | 
            {t('contractors')}: {filteredUsers.filter(u => u.role === 'zzper').length}
          </p>
        </div>
        <div className="p-6">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg">
                {searchTerm || roleFilter ? t('noUsersFound') : t('noUsers')}
              </p>
              {!searchTerm && !roleFilter && (
                <button 
                  onClick={handleNewUser}
                  className="mt-4 flex items-center space-x-2 mx-auto px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  <Plus size={16} />
                  <span>{t('addFirstUser')}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('userName')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('userEmail')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('role')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('createdAt')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t('acties')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((userItem) => (
                    <tr key={userItem.id} className={userItem.id === user?.id ? 'bg-blue-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <User className="h-5 w-5 text-gray-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {userItem.naam}
                              {userItem.id === user?.id && (
                                <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                  {t('you')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {userItem.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(userItem.role)}`}>
                          {getRoleDisplayName(userItem.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(userItem.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditUser(userItem)}
                            className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                          >
                            <Edit size={16} />
                            <span>{t('bewerken')}</span>
                          </button>
                          {userItem.id !== user?.id && (
                            <button
                              onClick={() => handleDeleteUser(userItem.id)}
                              className="text-red-600 hover:text-red-900 flex items-center space-x-1"
                            >
                              <Trash2 size={16} />
                              <span>{t('verwijderen')}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Add/Edit User Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? t('editUser') : t('addNewUser')}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('userName')} *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="text"
                name="naam"
                value={formData.naam}
                onChange={handleInputChange}
                required
                placeholder={t('enterUserName')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('userEmail')} *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder={t('enterUserEmail')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('role')} *
            </label>
            <div className="relative">
              <UserPlus className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                required
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 appearance-none bg-white"
              >
                <option value="admin">{t('administrator')}</option>
                <option value="kantoorpersoneel">{t('officeStaff')}</option>
                <option value="medewerker">{t('employee')}</option>
                <option value="zzper">{t('contractor')}</option>
              </select>
            </div>
          </div>

          {hourlyRatesEnabled && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Uurtarief Inkoop (€)
                </label>
                <input
                  type="number"
                  name="hourly_rate_purchase"
                  value={formData.hourly_rate_purchase}
                  onChange={(e) => setFormData({ ...formData, hourly_rate_purchase: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Uurtarief Verkoop (€)
                </label>
                <input
                  type="number"
                  name="hourly_rate_sale"
                  value={formData.hourly_rate_sale}
                  onChange={(e) => setFormData({ ...formData, hourly_rate_sale: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
            </div>
          )}

          {!editingUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('password')} *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!editingUser}
                  placeholder={t('enterPassword')}
                  className="w-full pl-4 pr-12 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button"
              onClick={() => setShowModal(false)}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              disabled={mutationLoading}
            >
              {t('annuleren')}
            </button>
            <button 
              type="submit"
              disabled={mutationLoading}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutationLoading ? t('saving') : (editingUser ? t('updateUser') : t('createUser'))}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Gebruikers;