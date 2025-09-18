import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HeaderButton } from '../components/headerButton';
import { Navbar } from '../components/navBar';
import './FaqsManagement.css';

export function FAQs() {
  const [search, setSearch] = useState('');
  const [faqsList, setFaqsList] = useState([]);

  // Add modal
  const [showModal, setShowModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  // Edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [faqToEdit, setFaqToEdit] = useState(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [faqToDelete, setFaqToDelete] = useState(null);

  // Success / Notice
  const [notice, setNotice] = useState({ open: false, text: '' });
  const showNotice = (text) => setNotice({ open: true, text });
  const closeNotice = () => setNotice({ open: false, text: '' });

  const apiUrl = import.meta.env.VITE_API_URL;
  const token = localStorage.getItem('token');
  const adminId = localStorage.getItem('admin_id');
  const headers = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);

  // Fetch FAQs
  const fetchFaqs = useCallback(async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/faqs/`, { headers });
      setFaqsList(res.data);
    } catch (err) {
      console.error('Error fetching FAQs:', err.response?.data || err.message);
    }
  }, [apiUrl, headers]);

  useEffect(() => {
    fetchFaqs();
  }, [fetchFaqs]);

  // Add FAQ
  const handleSave = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;
    if (!adminId) return console.error('Admin ID missing in localStorage');

    try {
      const res = await axios.post(`${apiUrl}/api/faqs/`, {
        admin_id: adminId,
        question: newQuestion,
        answer: newAnswer,
      }, { headers });

      setFaqsList(prev => [
        ...prev,
        {
          faq_id: res.data.faq_id,
          admin_id: adminId,
          question: newQuestion,
          answer: newAnswer
        }
      ]);

      setShowModal(false);
      setNewQuestion('');
      setNewAnswer('');
      showNotice('FAQ successfully added!');
    } catch (err) {
      console.error('Error adding FAQ:', err.response?.data || err.message);
      showNotice('Failed to add FAQ.');
    }
  };

  // Update FAQ
  const handleUpdate = async () => {
    if (!editQuestion.trim() || !editAnswer.trim()) return;
    if (!faqToEdit) return;

    try {
      await axios.put(`${apiUrl}/api/faqs/${faqToEdit.faq_id}`, {
        question: editQuestion,
        answer: editAnswer
      }, { headers });

      setFaqsList(prev =>
        prev.map(faq =>
          faq.faq_id === faqToEdit.faq_id
            ? { ...faq, question: editQuestion, answer: editAnswer }
            : faq
        )
      );

      setEditModalVisible(false);
      setFaqToEdit(null);
      showNotice('FAQ successfully updated!');
    } catch (err) {
      console.error('Error updating FAQ:', err.response?.data || err.message);
      showNotice('Failed to update FAQ.');
    }
  };

  // Delete FAQ
  const handleDelete = async () => {
    if (!faqToDelete) return;

    try {
      await axios.delete(`${apiUrl}/api/faqs/${faqToDelete.faq_id}`, { headers });
      setFaqsList(prev => prev.filter(faq => faq.faq_id !== faqToDelete.faq_id));
      setShowDeleteConfirm(false);
      setFaqToDelete(null);
      showNotice('FAQ successfully deleted!');
    } catch (err) {
      console.error('Error deleting FAQ:', err.response?.data || err.message);
      showNotice('Failed to delete FAQ.');
    }
  };

  const filteredFaqs = faqsList.filter(
    faq =>
      faq.question.toLowerCase().includes(search.toLowerCase()) ||
      faq.answer.toLowerCase().includes(search.toLowerCase())
  );

  return (

    <>
      <Navbar />
      <HeaderButton />

      <div className="faqs-top-header">
        <h1>FAQs Management</h1>
      </div>

      <div className="faqs-page">
        <div className="table-card">
          <div className="search-add-container">
            <div className="search-input-wrapper">
              <img
                src="https://cdn-icons-png.flaticon.com/512/622/622669.png"
                alt="Search"
                className="search-icon"
              />
            <input
                type="text"
                placeholder="Search"
                className="search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <button className="add-btn" onClick={() => setShowModal(true)}>
              Add
            </button>
          </div>

          <div className="table-scroll">
            <table className="faqs-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Faq_ID</th>
                  <th>Admin_ID</th>
                  <th>Question</th>
                  <th>Answer</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFaqs.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'gray' }}>
                      No FAQs found.
                    </td>
                  </tr>
                )}

                {filteredFaqs.map((faq, index) => (
                  <tr key={faq.faq_id}>
                    <td>{index + 1}</td>
                    <td>{faq.faq_id}</td>
                    <td>{faq.admin_id}</td>
                    <td>{faq.question}</td>
                    <td>{faq.answer}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="edit-btn"
                          onClick={() => {
                            setFaqToEdit(faq);
                            setEditQuestion(faq.question);
                            setEditAnswer(faq.answer);
                            setEditModalVisible(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => {
                            setFaqToDelete(faq);
                            setShowDeleteConfirm(true);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add FAQ Modal */}
      {showModal && (
        <div className="fm-modalOverlay" onClick={() => setShowModal(false)}>
          <div className="fm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fm-modalHeader">
              <h2 className="fm-modalTitle">Add FAQ</h2>
              <button className="fm-closeBtn" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="fm-modalBody">
              <div className="fm-field">
                <label className="fm-label">Question</label>
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                />
              </div>

              <div className="fm-field">
                <label className="fm-label">Answer</label>
                <input
                  type="text"
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                />
              </div>
            </div>

            <div className="fm-modalFooter">
              <button className="btn cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" onClick={handleSave}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit FAQ Modal */}
      {editModalVisible && faqToEdit && (
        <div className="fm-modalOverlay" onClick={() => setEditModalVisible(false)}>
          <div className="fm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="fm-modalHeader">
              <h2 className="fm-modalTitle">Edit FAQ</h2>
              <button className="fm-closeBtn" onClick={() => setEditModalVisible(false)}>×</button>
            </div>

            <div className="fm-modalBody">
              <div className="fm-field">
                <label className="fm-label">Question</label>
                <input
                  type="text"
                  value={editQuestion}
                  onChange={(e) => setEditQuestion(e.target.value)}
                />
              </div>

              <div className="fm-field">
                <label className="fm-label">Answer</label>
                <input
                  type="text"
                  value={editAnswer}
                  onChange={(e) => setEditAnswer(e.target.value)}
                />
              </div>
            </div>

            <div className="fm-modalFooter">
              <button className="btn cancel" onClick={() => setEditModalVisible(false)}>Cancel</button>
              <button className="btn primary" onClick={handleUpdate}>Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete — now matches previous modal style */}
      {showDeleteConfirm && faqToDelete && (
        <div className="fm-modalOverlay" onClick={() => setShowDeleteConfirm(false)}>
          <div
            className="fm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fm-del-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fm-modalHeader">
              <h2 id="fm-del-title" className="fm-modalTitle">Delete FAQ</h2>
            </div>

            <div className="fm-modalBody">
              Are you sure you want to delete this FAQ? This action cannot be undone.
            </div>

            <div className="fm-modalFooter">
              <button className="btn cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn primary" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Success / Notice Modal */}
      {notice.open && (
        <div className="fm-noticeOverlay" onClick={closeNotice}>
          <div
            className="fm-noticeModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fm-notice-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fm-noticeHeader">
              <span id="fm-notice-title" className="fm-noticeTitle">Success</span>
            </div>
            <div className="fm-noticeBody fm-noticeBody--center">
              {notice.text}
            </div>
            <div className="fm-noticeActions">
              <button className="btn primary" onClick={closeNotice}>OK</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}