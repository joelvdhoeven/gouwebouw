import React, { useState } from 'react';
import { Bell, Mail, MailOpen, Archive, Filter } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery, useSupabaseMutation } from '../hooks/useSupabase';
import { Notification } from '../types';

const Meldingen: React.FC = () => {
  const { t } = useLanguage();
  const { user, hasPermission } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all');

  const isAdminOrOffice = hasPermission('manage_notifications');

  // Debug logs
  console.log('Meldingen page - user:', user);
  console.log('Meldingen page - isAdminOrOffice:', isAdminOrOffice);

  // Fetch notifications
  const { data: notifications = [], loading, refetch } = useSupabaseQuery<Notification>(
    'notifications',
    '*',
    isAdminOrOffice ? {} : { recipient_id: user?.id }, // Admins/Office see all, others see their own
    { order: { column: 'created_at', ascending: false } }
  );

  // Debug logs for data
  console.log('Meldingen page - notifications data:', notifications);
  console.log('Meldingen page - loading:', loading);

  const { update: updateNotificationStatus, loading: mutationLoading } = useSupabaseMutation('notifications');

  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return notification.status === 'unread';
    if (filter === 'archived') return notification.status === 'archived';
    return true; // 'all' filter
  });

  // Debug log for filtered data
  console.log('Meldingen page - filteredNotifications:', filteredNotifications);

  const handleMarkAsRead = async (id: string) => {
    await updateNotificationStatus(id, { status: 'read' });
    refetch();
  };

  const handleArchive = async (id: string) => {
    await updateNotificationStatus(id, { status: 'archived' });
    refetch();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 dark:border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center space-x-3">
        <Bell className="text-red-600 dark:text-red-500" />
        <span>{t('notifications')}</span>
      </h1>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex space-x-4">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${filter === 'all' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
          {t('allNotifications')}
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${filter === 'unread' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
          {t('unread')}
        </button>
        <button
          onClick={() => setFilter('archived')}
          className={`px-4 py-2 rounded-md text-sm font-medium ${filter === 'archived' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >
          {t('archived')}
        </button>
      </div>

      {/* Notifications List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        {filteredNotifications.length === 0 ? (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            {t('noNotifications')}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredNotifications.map(notification => (
              <li key={notification.id} className={`p-6 flex items-start space-x-4 ${notification.status === 'unread' ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
                <div className="flex-shrink-0 mt-1">
                  {notification.status === 'unread' ? <Mail className="h-6 w-6 text-red-600 dark:text-red-500" /> : <MailOpen className="h-6 w-6 text-gray-400 dark:text-gray-500" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{notification.title}</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{new Date(notification.created_at).toLocaleString('nl-NL')}</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mt-1">{notification.message}</p>
                  <div className="mt-3 flex space-x-2">
                    {notification.status === 'unread' && (
                      <button
                        onClick={() => handleMarkAsRead(notification.id)}
                        className="flex items-center space-x-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-800"
                        disabled={mutationLoading}
                      >
                        <MailOpen size={14} />
                        <span>{t('markAsRead')}</span>
                      </button>
                    )}
                    {notification.status !== 'archived' && (
                      <button
                        onClick={() => handleArchive(notification.id)}
                        className="flex items-center space-x-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-600"
                        disabled={mutationLoading}
                      >
                        <Archive size={14} />
                        <span>{t('archive')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Meldingen;