import axios from 'axios';
import { useEffect, useState } from 'react';
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

  // Fetch FAQs
  useEffect(() => {
    fetchFaqs();
  }, []);

  const fetchFaqs = async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5000/api/faqs/');
      setFaqsList(res.data);
    } catch (err) {
      console.error('Error fetching FAQs:', err);
    }
  };

  // Add
  const handleSave = async () => {
    try {
      const res = await axios.post('http://127.0.0.1:5000/api/faqs/', {
        admin_id: 'admin001',
        question: newQuestion,
        answer: newAnswer
      });
      setFaqsList(prev => [
        ...prev,
        {
          faq_id: res.data.faq_id,
          admin_id: 'admin001',
          question: newQuestion,
          answer: newAnswer
        }
      ]);
      setShowModal(false);
      setNewQuestion('');
      setNewAnswer('');
    } catch (err) {
      console.error('Error adding FAQ:', err);
    }
  };

  // Update
  const handleUpdate = async () => {
    try {
      await axios.put(`http://127.0.0.1:5000/api/faqs/${faqToEdit.faq_id}`, {
        question: editQuestion,
        answer: editAnswer
      });
      setFaqsList(prev =>
        prev.map(faq =>
          faq.faq_id === faqToEdit.faq_id
            ? { ...faq, question: editQuestion, answer: editAnswer }
            : faq
        )
      );
      setEditModalVisible(false);
      setFaqToEdit(null);
    } catch (err) {
      console.error('Error updating FAQ:', err);
    }
  };

  // Delete
  const handleDelete = async () => {
    try {
      await axios.delete(`http://127.0.0.1:5000/api/faqs/${faqToDelete.faq_id}`);
      setFaqsList(prev => prev.filter(faq => faq.faq_id !== faqToDelete.faq_id));
      setShowDeleteConfirm(false);
      setFaqToDelete(null);
    } catch (err) {
      console.error('Error deleting FAQ:', err);
    }
  };

  // Search filter
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
        {/* Card that contains toolbar + table */}
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

          {/* Fixed-height scroll area so layout doesn't jump on add/delete */}
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
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Add FAQ</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label">Question</label>
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label className="modal-label">Answer</label>
                <input
                  type="text"
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn cancel" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn primary" onClick={handleSave}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit FAQ Modal */}
      {editModalVisible && faqToEdit && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit FAQ</h2>
              <button className="close-btn" onClick={() => setEditModalVisible(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label">Question</label>
                <input
                  type="text"
                  value={editQuestion}
                  onChange={(e) => setEditQuestion(e.target.value)}
                />
              </div>

              <div className="modal-field">
                <label className="modal-label">Answer</label>
                <input
                  type="text"
                  value={editAnswer}
                  onChange={(e) => setEditAnswer(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn cancel" onClick={() => setEditModalVisible(false)}>Cancel</button>
              <button className="btn primary" onClick={handleUpdate}>Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {showDeleteConfirm && faqToDelete && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete?</p>
            <div className="confirm-buttons">
              <button className="cancel-btn" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="yes-btn" onClick={handleDelete}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}