import React, { useState, useEffect } from 'react';
import { Plus, Search, AlertCircle, CheckCircle, Clock, XCircle, Paperclip, X, MessageSquare, Send, Archive } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Ticket, TicketAttachment, TicketComment } from '../types';

const TicketOmgeving: React.FC = () => {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');

  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: '' as '' | 'low' | 'medium' | 'high' | 'urgent',
    category: ''
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (profile?.role === 'admin' || profile?.role === 'kantoorpersoneel' || profile?.role === 'superuser') {
      loadTickets();
    }
  }, [profile]);

  const loadTickets = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      // Admin and kantoorpersoneel can see all tickets
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...files]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (): Promise<TicketAttachment[]> => {
    const uploadedFiles: TicketAttachment[] = [];

    for (const file of attachments) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `ticket-attachments/${fileName}`;

      // Convert file to base64 for storage (since we don't have Supabase Storage configured)
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      uploadedFiles.push({
        name: file.name,
        url: base64,
        type: file.type,
        size: file.size
      });
    }

    return uploadedFiles;
  };

  const handleCreateTicket = async () => {
    if (!profile || !newTicket.title || !newTicket.description || !newTicket.category || !newTicket.priority) {
      alert('Vul alle verplichte velden in');
      return;
    }

    try {
      setUploading(true);

      // Upload attachments if any
      const uploadedAttachments = attachments.length > 0 ? await uploadAttachments() : [];

      const { error } = await supabase
        .from('tickets')
        .insert([{
          title: newTicket.title,
          description: newTicket.description,
          priority: newTicket.priority,
          category: newTicket.category,
          created_by: profile.id,
          status: 'open',
          attachments: uploadedAttachments
        }]);

      if (error) throw error;

      setShowCreateModal(false);
      setNewTicket({
        title: '',
        description: '',
        priority: '',
        category: ''
      });
      setAttachments([]);
      loadTickets();
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('Fout bij aanmaken ticket');
    } finally {
      setUploading(false);
    }
  };

  const openTicketDetails = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    await loadComments(ticket.id);
  };

  const loadComments = async (ticketId: string) => {
    try {
      const { data: commentsData, error } = await supabase
        .from('ticket_comments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const commentsWithUsers = await Promise.all(
        (commentsData || []).map(async (comment) => {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('naam, role')
            .eq('id', comment.user_id)
            .maybeSingle();

          return {
            ...comment,
            user_name: userProfile?.naam || 'Onbekend',
            user_role: userProfile?.role || 'user'
          };
        })
      );

      setComments(commentsWithUsers);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

  const sendComment = async () => {
    if (!selectedTicket || !profile || !newComment.trim()) return;

    try {
      setSendingComment(true);
      const { error } = await supabase
        .from('ticket_comments')
        .insert([{
          ticket_id: selectedTicket.id,
          user_id: profile.id,
          comment: newComment.trim()
        }]);

      if (error) throw error;

      setNewComment('');
      await loadComments(selectedTicket.id);
    } catch (error) {
      console.error('Error sending comment:', error);
      alert('Fout bij versturen bericht');
    } finally {
      setSendingComment(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="text-red-500" size={20} />;
      case 'in_progress':
        return <Clock className="text-yellow-500" size={20} />;
      case 'resolved':
        return <CheckCircle className="text-green-500" size={20} />;
      case 'closed':
        return <XCircle className="text-gray-500" size={20} />;
      case 'archived':
        return <CheckCircle className="text-blue-500" size={20} />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Open';
      case 'in_progress':
        return 'In Behandeling';
      case 'resolved':
        return 'Opgelost';
      case 'closed':
        return 'Gesloten';
      case 'archived':
        return 'Gearchiveerd';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'Urgent';
      case 'high':
        return 'Hoog';
      case 'medium':
        return 'Gemiddeld';
      case 'low':
        return 'Laag';
      default:
        return priority;
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    // Filter archived tickets based on showArchived toggle
    const matchesArchiveFilter = showArchived ? ticket.status === 'archived' : ticket.status !== 'archived';

    const matchesSearch = ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ticket.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || ticket.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || ticket.priority === filterPriority;
    return matchesArchiveFilter && matchesSearch && matchesStatus && matchesPriority;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Laden...</div>
      </div>
    );
  }

  if (profile?.role !== 'admin' && profile?.role !== 'kantoorpersoneel' && profile?.role !== 'superuser') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Je hebt geen toegang tot deze pagina.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ticket Omgeving</h1>
          <p className="text-gray-600">
            {profile?.role === 'superuser'
              ? 'Bekijk en beheer alle tickets'
              : 'Maak tickets aan en bekijk alle tickets (Admin/Kantoorpersoneel)'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              showArchived
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Archive size={20} />
            {showArchived ? 'Actieve Tickets' : 'Archief'}
          </button>
          {(profile?.role === 'admin' || profile?.role === 'kantoorpersoneel') && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              <Plus size={20} />
              Nieuw Ticket
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Zoek tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="all">Alle Statussen</option>
              <option value="open">Open</option>
              <option value="in_progress">In Behandeling</option>
              <option value="resolved">Opgelost</option>
              <option value="closed">Gesloten</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="all">Alle Prioriteiten</option>
              <option value="urgent">Urgent</option>
              <option value="high">Hoog</option>
              <option value="medium">Gemiddeld</option>
              <option value="low">Laag</option>
            </select>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {filteredTickets.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Geen tickets gevonden
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div key={ticket.id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => openTicketDetails(ticket)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(ticket.status)}
                      <h3 className="font-semibold text-gray-900">{ticket.title}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(ticket.priority)}`}>
                        {getPriorityLabel(ticket.priority)}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm mb-2 line-clamp-2">{ticket.description}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Categorie: {ticket.category}</span>
                      <span>Status: {getStatusLabel(ticket.status)}</span>
                      <span>Aangemaakt: {new Date(ticket.created_at).toLocaleDateString('nl-NL')}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openTicketDetails(ticket);
                    }}
                    className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    <MessageSquare size={16} />
                    Chat
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Nieuw Ticket Aanmaken</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titel *
                </label>
                <input
                  type="text"
                  value={newTicket.title}
                  onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Korte omschrijving van het probleem"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Beschrijving *
                </label>
                <textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Gedetailleerde beschrijving van het probleem"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Categorie *
                </label>
                <select
                  value={newTicket.category}
                  onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Selecteer categorie</option>
                  <option value="bug">Bug / Fout</option>
                  <option value="feature">Feature Verzoek</option>
                  <option value="support">Ondersteuning</option>
                  <option value="question">Vraag</option>
                  <option value="other">Anders</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioriteit *
                </label>
                <select
                  value={newTicket.priority}
                  onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Selecteer prioriteit</option>
                  <option value="low">Laag</option>
                  <option value="medium">Gemiddeld</option>
                  <option value="high">Hoog</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bijlagen (optioneel)
                </label>
                <div className="space-y-2">
                  <label className="flex items-center justify-center w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-md hover:border-red-400 cursor-pointer transition-colors">
                    <Paperclip size={20} className="text-gray-400 mr-2" />
                    <span className="text-sm text-gray-600">Klik om bestanden of screenshots te uploaden</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>

                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Paperclip size={16} className="text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700 truncate">{file.name}</span>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              ({(file.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                          <button
                            onClick={() => removeAttachment(index)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setAttachments([]);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={uploading}
              >
                Annuleren
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={uploading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploaden...' : 'Ticket Aanmaken'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  {getStatusIcon(selectedTicket.status)}
                  <h2 className="text-xl font-bold text-gray-900">{selectedTicket.title}</h2>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedTicket.priority)}`}>
                    {getPriorityLabel(selectedTicket.priority)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">Status: {getStatusLabel(selectedTicket.status)}</p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-2">Beschrijving</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
              </div>

              {comments.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  Nog geen berichten. Start een conversatie!
                </div>
              ) : (
                comments.map((comment) => {
                  const isOwnComment = comment.user_id === profile?.id;
                  const isSuperUser = comment.user_role === 'superuser';

                  return (
                    <div
                      key={comment.id}
                      className={`flex ${isOwnComment ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%] ${isOwnComment ? 'bg-red-600 text-white' : 'bg-white'} rounded-lg p-3 shadow-sm`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold ${isOwnComment ? 'text-red-100' : 'text-gray-900'}`}>
                            {comment.user_name}
                            {isSuperUser && ' (SuperUser)'}
                          </span>
                          <span className={`text-xs ${isOwnComment ? 'text-red-200' : 'text-gray-500'}`}>
                            {new Date(comment.created_at).toLocaleString('nl-NL', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <p className={`text-sm ${isOwnComment ? 'text-white' : 'text-gray-700'} whitespace-pre-wrap`}>
                          {comment.comment}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendComment();
                    }
                  }}
                  placeholder="Typ een bericht..."
                  rows={2}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                  disabled={sendingComment}
                />
                <button
                  onClick={sendComment}
                  disabled={sendingComment || !newComment.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send size={18} />
                  Verstuur
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Druk op Enter om te versturen, Shift+Enter voor nieuwe regel
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketOmgeving;
