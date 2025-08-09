import React, { useEffect, useState } from 'react';
import './generalAnnouncement.css';
import { Navbar } from '../components/navBar';
import { HeaderButton } from '../components/headerButton';

export function Announcement() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [announcements, setAnnouncements] = useState([]);

  // editing state
  const [editingId, setEditingId] = useState(null);

  // modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  useEffect(() => {
    // lock page scroll when modal is open
    document.body.style.overflow = confirmOpen ? 'hidden' : '';
    return () => (document.body.style.overflow = '');
  }, [confirmOpen]);

  const handleSubmit = () => {
    if (!title.trim() || !message.trim()) return;

    if (editingId) {
      // update existing
      setAnnouncements(prev =>
        prev.map(a => (a.id === editingId ? { ...a, title, message } : a))
      );
      setEditingId(null);
    } else {
      // add new
      const now = new Date();
      const datePosted = now.toLocaleDateString();
      const timePosted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setAnnouncements(prev => [
        { id: Date.now(), title, message, datePosted, timePosted },
        ...prev,
      ]);
    }

    setTitle('');
    setMessage('');
  };

  const askDelete = (id) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (pendingDeleteId != null) {
      setAnnouncements(prev => prev.filter(a => a.id !== pendingDeleteId));
      // if you delete the item currently being edited, exit edit mode
      if (pendingDeleteId === editingId) {
        setEditingId(null);
        setTitle('');
        setMessage('');
      }
    }
    setConfirmOpen(false);
    setPendingDeleteId(null);
  };

  const cancelDelete = () => {
    setConfirmOpen(false);
    setPendingDeleteId(null);
  };

  const handleEdit = (a) => {
    setEditingId(a.id);
    setTitle(a.title);
    setMessage(a.message);
    // optionally scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setTitle('');
    setMessage('');
  };

  // close on ESC for modal
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') cancelDelete(); };
    if (confirmOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmOpen]);

  return (
    <>
      <Navbar />

      <div className="main-content">
        <div className="header-row">
        <h1 className="page-title">General Announcement</h1>
          <HeaderButton />
        </div>

        <div className="general-announcement">
          <div className="announcement-form card">
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
            <div className="form-actions">
              <button className="submit-btn" onClick={handleSubmit}>
                {editingId ? 'Update' : 'Submit'}
              </button>
              {editingId && (
                <button className="btn btn-outline" style={{ marginLeft: 8 }} onClick={cancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </div>

          <div className="announcements-container">
            {announcements.map((a) => (
              <div
                key={a.id}
                className={`announcement-card card ${editingId === a.id ? 'editing' : ''}`}
              >
                <div className="card-header">
                  <h2>{a.title}</h2>
                  <div className="announcement-actions">
                    <button onClick={() => handleEdit(a)} className="icon-btn" aria-label="Edit">
                      <img
                        src="https://cdn-icons-png.flaticon.com/512/1159/1159633.png"
                        alt=""
                        className="action-icon"
                      />
                    </button>
                    <button onClick={() => askDelete(a.id)} className="icon-btn" aria-label="Delete">
                      <img
                        src="https://cdn-icons-png.flaticon.com/512/1214/1214428.png"
                        alt=""
                        className="action-icon"
                      />
                    </button>
                  </div>
                </div>

                <hr className="title-divider" />
                <p className="card-message">{a.message}</p>
                {a.datePosted && a.timePosted && (
                  <p className="posted-date-time">
                    <strong>Posted:</strong> {a.datePosted} at {a.timePosted}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirm Delete Modal */}
      {confirmOpen && (
        <div className="modal-overlay" onClick={cancelDelete} aria-hidden="true">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="del-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-title" id="del-title">Delete Announcement</span>
            </div>
            <div className="modal-body">
              Are you sure you want to delete this announcement? This action cannot be undone.
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={cancelDelete}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}