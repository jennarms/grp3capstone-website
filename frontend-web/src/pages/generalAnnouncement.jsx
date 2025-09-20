import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HeaderButton } from '../components/headerButton';
import { Navbar } from '../components/navBar';
import './generalAnnouncement.css';

export function Announcement() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [announcements, setAnnouncements] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [feedback, setFeedback] = useState({ open: false, message: '' });

  const apiUrl = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');
  const adminId = localStorage.getItem('admin_id');
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/announcement`, { headers });
      const formatted = res.data.announcements.map(a => ({
        id: a.announce_id,
        title: a.title,
        message: a.content,
        datePosted: new Date(a.date_time).toLocaleDateString(),
        timePosted: new Date(a.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }));
      setAnnouncements(formatted);
    } catch (err) {
      console.error('Failed to fetch announcements:', err.response?.data || err.message);
    }
  }, [apiUrl, headers]);

  useEffect(() => { fetchAnnouncements(); }, [fetchAnnouncements]);

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) return;
    if (!adminId) return console.error('Admin ID missing in localStorage');
    const payload = { title, content: message, admin_id: adminId };

    try {
      if (editingId) {
        await axios.put(`${apiUrl}/api/announcement/${editingId}`, payload, { headers });
        setFeedback({ open: true, message: 'Announcement successfully updated!' });
      } else {
        await axios.post(`${apiUrl}/api/announcement`, payload, { headers });
        setFeedback({ open: true, message: 'Announcement successfully posted!' });
      }
      await fetchAnnouncements();
      setTitle(''); setMessage(''); setEditingId(null);
    } catch (err) {
      console.error('Error saving announcement:', err.response?.data || err.message);
      setFeedback({ open: true, message: 'Failed to save announcement. It may already exist.' });
    }
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId || !adminId) return console.error('Admin ID missing in localStorage');
    try {
      await axios.delete(`${apiUrl}/api/announcement/${pendingDeleteId}`, {
        headers, data: { admin_id: adminId },
      });
      setAnnouncements(prev => prev.filter(a => a.id !== pendingDeleteId));
      if (pendingDeleteId === editingId) { setEditingId(null); setTitle(''); setMessage(''); }
      setFeedback({ open: true, message: 'Announcement successfully deleted!' });
    } catch (err) {
      console.error('Error deleting announcement:', err.response?.data || err.message);
      setFeedback({ open: true, message: 'Failed to delete announcement.' });
    }
    setConfirmOpen(false); setPendingDeleteId(null);
  };

  const askDelete = id => { setPendingDeleteId(id); setConfirmOpen(true); };
  const cancelDelete = () => { setConfirmOpen(false); setPendingDeleteId(null); };
  const handleEdit = a => { setEditingId(a.id); setTitle(a.title); setMessage(a.message); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const cancelEdit = () => { setEditingId(null); setTitle(''); setMessage(''); };

  return (
    <>
      <Navbar />
      <HeaderButton />
      {confirmOpen && <div className="dark-overlay" />}
      {feedback.open && <div className="dark-overlay" />}

      <div className="ga-main">
        <div className="ga-header-row">
          <h1 className="ga-page-title">General Announcement</h1>
        </div>

        <div className="ga-wrap">
          <div className="ga-form">
            <input
              type="text"
              placeholder="Announcement Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              placeholder="Type a message.."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="ga-form-actions">
              <button className="ga-submit" onClick={handleSubmit}>
                {editingId ? 'Update' : 'Submit'}
              </button>
              {editingId && (
                <button className="btn btn-outline" style={{ marginLeft: 8 }} onClick={cancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="ga-list">
            {announcements.map(a => (
              <div
                key={a.id}
                className={`ga-announcement-card ${editingId === a.id ? 'is-editing' : ''}`}
              >
                <div className="ga-card-header">
                  <h2 className="ga-card-title">{a.title}</h2>
                  <div className="ga-actions">
                    <button onClick={() => handleEdit(a)} className="ga-icon-btn" aria-label="Edit">
                      <img src="https://cdn-icons-png.flaticon.com/512/1159/1159633.png" alt="" className="ga-action-icon" />
                    </button>
                    <button onClick={() => askDelete(a.id)} className="ga-icon-btn" aria-label="Delete">
                      <img src="https://cdn-icons-png.flaticon.com/512/1214/1214428.png" alt="" className="ga-action-icon" />
                    </button>
                  </div>
                </div>

                <hr className="ga-divider" />

                {/* Scrollable body area */}
                <div className="ga-card-scroll">
                  <p className="ga-message">{a.message}</p>
                  {a.datePosted && a.timePosted && (
                    <p className="ga-posted">
                      <strong>Posted:</strong> {a.datePosted} at {a.timePosted}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      {confirmOpen && (
        <div className="ga-modal-overlay" onClick={cancelDelete} aria-hidden="true">
          <div className="ga-modal" role="dialog" aria-modal="true" aria-labelledby="del-title" onClick={(e) => e.stopPropagation()}>
            <div className="ga-modal-header">
              <span className="ga-modal-title" id="del-title">Delete Announcement</span>
            </div>
            <div className="ga-modal-body">
              Are you sure you want to delete this announcement? This action cannot be undone.
            </div>
            <div className="ga-modal-actions">
              <button className="btn btn-outline" onClick={cancelDelete}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {feedback.open && (
        <div className="ga-modal-overlay" onClick={() => setFeedback({ ...feedback, open: false })}>
          <div className="ga-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ga-modal-header">
              <span className="ga-modal-title">Notice</span>
            </div>
            <div className="ga-modal-body">{feedback.message}</div>
            <div className="ga-modal-actions">
              <button className="btn btn-outline" onClick={() => setFeedback({ ...feedback, open: false })}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}