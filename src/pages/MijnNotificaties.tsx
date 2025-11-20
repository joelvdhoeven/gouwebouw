import React, { useState } from 'react';
import { Mail, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSupabaseQuery } from '../hooks/useSupabase';
import { formatDate } from '../utils/dateUtils';

const MijnNotificaties: React.FC = () => {
  const { user } = useAuth();
  const { data: notifications = [], loading } = useSupabaseQuery<any>(
    'email_logs',
    'id, to_email, subject, body_html, created_at, status',
    { to_email: user?.email },
    { order: { column: 'created_at', ascending: false } }
  );

  const [selectedNotification, setSelectedNotification] = useState<any>(null);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Mijn Notificaties</h1>
        <p className="text-gray-600">Bekijk alle e-mails die aan jou zijn verzonden</p>
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Mail className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">Je hebt nog geen notificaties ontvangen</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {notifications.map((notification: any) => (
            <div
              key={notification.id}
              onClick={() => setSelectedNotification(notification)}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Mail className="h-5 w-5 text-red-600" />
                  <div>
                    <h3 className="font-semibold text-gray-800">{notification.subject}</h3>
                    <p className="text-sm text-gray-500">{formatDate(notification.created_at)}</p>
                  </div>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  notification.status === 'sent' ? 'bg-green-100 text-green-800' :
                  notification.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {notification.status === 'sent' ? (
                    <span className="flex items-center space-x-1">
                      <CheckCircle size={12} />
                      <span>Verzonden</span>
                    </span>
                  ) : notification.status === 'failed' ? (
                    <span className="flex items-center space-x-1">
                      <AlertCircle size={12} />
                      <span>Mislukt</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1">
                      <Clock size={12} />
                      <span>In wachtrij</span>
                    </span>
                  )}
                </span>
              </div>
              <div className="text-gray-600 text-sm line-clamp-2" dangerouslySetInnerHTML={{ __html: notification.body_html || '' }} />
              <button className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium">
                Lees meer →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedNotification.subject}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatDate(selectedNotification.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="prose max-w-none">
                <div className="text-gray-700" dangerouslySetInnerHTML={{ __html: selectedNotification.body_html || '' }} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedNotification(null)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MijnNotificaties;
