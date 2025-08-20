import { Navbar } from '../components/navBar';
import React, { useState } from 'react';
import './FaqsManagement.css';
import { HeaderButton } from '../components/headerButton';

export function FAQs() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [faqToEdit, setFaqToEdit] = useState(null);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [showEditConfirm, setShowEditConfirm] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [faqToDelete, setFaqToDelete] = useState(null);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // (You had this, but it's not needed for the darken behavior)
  const [modalVisible, setModalVisible] = useState(null); // 'edit' | 'delete' | null

  const initialFaqs = [
    { id: 'F001', adminId: 'A001', question: 'Question 1..', answer: 'Answer to question 1' },
    { id: 'F002', adminId: 'A001', question: 'Question 2..', answer: 'Answer to question 2' },
    { id: 'F003', adminId: 'A001', question: 'Question 3..', answer: 'Answer to question 3' },
    { id: 'F004', adminId: 'A001', question: 'Question 4..', answer: 'Answer to question 4' },
  ];

  const [faqsList, setFaqsList] = useState(initialFaqs);

  const filteredFaqs = faqsList.filter(faq =>
    faq.question.toLowerCase().includes(search.toLowerCase()) ||
    faq.answer.toLowerCase().includes(search.toLowerCase())
  );

  const generateNewFaqID = () => {
    const lastId = faqsList.length > 0 ? parseInt(faqsList[faqsList.length - 1].id.substring(1)) : 0;
    return `F${(lastId + 1).toString().padStart(3, '0')}`;
  };

  const handleSave = () => {
    const newFaq = {
      id: generateNewFaqID(),
      adminId: 'A001',
      question: newQuestion,
      answer: newAnswer,
    };
    setFaqsList([...faqsList, newFaq]);
    setShowModal(false);
    setNewQuestion('');
    setNewAnswer('');
  };

  return (
    <>
      <Navbar />
      <HeaderButton />
      <div className="faqs-top-header">
        <h1>FAQs Management</h1>
      </div>

      <div className="faqs-page">
        <div className="search-add-container">
          <div className="search-input-wrapper">
            <img src="https://cdn-icons-png.flaticon.com/512/622/622669.png" alt="Search" className="search-icon" />
            <input
              type="text"
              placeholder="Search"
              className="search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="add-btn" onClick={() => setShowModal(true)}>Add</button>
        </div>

        <div className="table-container">
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
                <tr key={faq.id}>
                  <td>{index + 1}</td>
                  <td>{faq.id}</td>
                  <td>{faq.adminId}</td>
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
                          setModalVisible('edit');
                        }}
                      >Edit</button>
                      <button
                        className="delete-btn"
                        onClick={() => {
                          setFaqToDelete(faq);
                          setShowDeleteConfirm(true);
                          setModalVisible('delete');
                        }}
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              ))}

              {Array.from({ length: Math.max(0, 10 - filteredFaqs.length) }).map((_, idx) => (
                <tr key={`empty-${idx}`}>
                  <td>{filteredFaqs.length + idx + 1}</td>
                  <td colSpan="5" style={{ height: '45px' }}></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add FAQ Modal — use the same dark overlay */}
      {showModal && (
        <div className="confirm-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Add FAQ</h2>
              <button
                className="close-btn"
                onClick={() => {
                  setShowModal(false);
                  setShowConfirm(false);
                }}
              >×</button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <span className="modal-label">FAQ ID:</span>
                <span className="modal-value">{generateNewFaqID()}</span>
              </div>
              <div className="modal-field">
                <span className="modal-label">Admin ID:</span>
                <span className="modal-value">A001</span>
              </div>
              <input
                type="text"
                placeholder="Question"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
              />
              <input
                type="text"
                placeholder="Answer"
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
              />
            </div>
            <div className="save-btn-container">
              <button className="save-btn" onClick={() => setShowConfirm(true)}>Save</button>
            </div>

            {showConfirm && (
              <div className="confirm-overlay">
                <div className="confirm-box">
                  <h3>Confirm Add</h3>
                  <p>Are you sure you want to add?</p>
                  <div className="confirm-buttons">
                    <button className="cancel-btn" onClick={() => setShowConfirm(false)}>Cancel</button>
                    <button
                      className="yes-btn"
                      onClick={() => {
                        handleSave();
                        setShowConfirm(false);
                      }}
                    >Yes</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit FAQ Modal — now also uses confirm-overlay to darken everything */}
      {editModalVisible && faqToEdit && (
        <div className="confirm-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Edit FAQ</h2>
              <button
                className="close-btn"
                onClick={() => {
                  setEditModalVisible(false);
                  setModalVisible(null);
                }}
              >×</button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <span className="modal-label">FAQ ID:</span>
                <span className="modal-value">{faqToEdit.id}</span>
              </div>
              <div className="modal-field">
                <span className="modal-label">Admin ID:</span>
                <span className="modal-value">{faqToEdit.adminId}</span>
              </div>
              <input
                type="text"
                placeholder="Question"
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
              />
              <input
                type="text"
                placeholder="Answer"
                value={editAnswer}
                onChange={(e) => setEditAnswer(e.target.value)}
              />
            </div>
            <div className="save-btn-container">
              <button className="save-btn" onClick={() => setShowEditConfirm(true)}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Edit */}
      {showEditConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h3>Confirm Edit</h3>
            <p>Are you sure you want to update?</p>
            <div className="confirm-buttons">
              <button className="cancel-btn" onClick={() => setShowEditConfirm(false)}>Cancel</button>
              <button
                className="yes-btn"
                onClick={() => {
                  const updatedFaqs = faqsList.map(faq =>
                    faq.id === faqToEdit.id
                      ? { ...faq, question: editQuestion, answer: editAnswer }
                      : faq
                  );
                  setFaqsList(updatedFaqs);
                  setEditModalVisible(false);
                  setShowEditConfirm(false);
                  setModalVisible(null);
                }}
              >Yes</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete (unchanged) */}
      {showDeleteConfirm && faqToDelete && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete?</p>
            <div className="confirm-buttons">
              <button className="cancel-btn" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button
                className="yes-btn"
                onClick={() => {
                  const updatedFaqs = faqsList.filter(faq => faq.id !== faqToDelete.id);
                  setFaqsList(updatedFaqs);
                  setShowDeleteConfirm(false);
                  setFaqToDelete(null);
                  setModalVisible(null);
                }}
              >Yes</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}