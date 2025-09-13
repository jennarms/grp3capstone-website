import React, { useState, useMemo } from "react";
import { Navbar } from "../components/navBar";
import { HeaderButton } from "../components/headerButton";
import { OperationsTab } from "../components/operationsTab";
import "./operations_stationsTab.css";

export function StationsTab() {
  const [rows, setRows] = useState([
    { stationId: "S001", companyId: "C001", stationName: "Escolta", email: "escolta@email.com", username: "escoltastation", password: "$2y$10$1J..." },
    { stationId: "S002", companyId: "C001", stationName: "Lawton", email: "lawton@email.com", username: "lawtonstation", password: "$2y$10$1J..." },
    { stationId: "S003", companyId: "C001", stationName: "Quinta", email: "quinta@email.com", username: "quintastation", password: "$2y$10a3.." },
    { stationId: "S004", companyId: "C001", stationName: "PUP", email: "pup@email.com", username: "pupstation", password: "$2y$10$JU.." },
    { stationId: "S005", companyId: "C001", stationName: "Sta. Ana", email: "staana@email.com", username: "staanastation", password: "$2y$10$d.." },
    { stationId: "S006", companyId: "C001", stationName: "Lambingan", email: "lambingan@email.com", username: "lambinganstation", password: "$2y$10$0.." },
    { stationId: "S007", companyId: "C001", stationName: "Valenzuela", email: "valenzuela@email.com", username: "valenzuelastation", password: "$2y$10$p.." },
    { stationId: "S008", companyId: "C001", stationName: "Hulo", email: "hulo@email.com", username: "hulostation", password: "$2y$10$U.." },
    { stationId: "S009", companyId: "C001", stationName: "Guadalupe", email: "guadalupe@email.com", username: "guadalupestation", password: "$2y$10$V.." },
    { stationId: "S010", companyId: "C001", stationName: "Maybunga", email: "maybunga@email.com", username: "maybungastation", password: "$2y$10$H.." },
  ]);

  const [query, setQuery] = useState("");

  // Add Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddConfirm, setShowAddConfirm] = useState(false);

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [editStation, setEditStation] = useState(null);

  // Delete Modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteStationId, setDeleteStationId] = useState(null);

  // Form
  const [formError, setFormError] = useState("");
  const [newStation, setNewStation] = useState({
    stationId: "",
    companyId: "C001",
    stationName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      (
        r.stationId +
        r.companyId +
        r.stationName +
        r.email +
        r.username
      ).toLowerCase().includes(q)
    );
  }, [rows, query]);

  // === ADD LOGIC ===
  const onAdd = () => {
    setFormError("");
    setShowAddModal(true);
  };

  const handleAddSave = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newStation.email)) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (newStation.password !== newStation.confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    setFormError("");
    setShowAddConfirm(true);
  };

  const confirmAdd = () => {
    setRows((prev) => [...prev, newStation]);
    setShowAddConfirm(false);
    setShowAddModal(false);
    setNewStation({
      stationId: "",
      companyId: "C001",
      stationName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
  };

  // === EDIT LOGIC ===
  const onEdit = (id) => {
    const station = rows.find((r) => r.stationId === id);
    setEditStation({ ...station, confirmPassword: station.password });
    setShowEditModal(true);
    setFormError("");
  };

  const handleEditSave = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editStation.email)) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (editStation.password !== editStation.confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    setFormError("");
    setShowEditConfirm(true);
  };

  const confirmEdit = () => {
    setRows((prev) =>
      prev.map((r) =>
        r.stationId === editStation.stationId ? { ...editStation } : r
      )
    );
    setShowEditConfirm(false);
    setShowEditModal(false);
    setEditStation(null);
  };

  // === DELETE LOGIC ===
  const onDelete = (id) => {
    setDeleteStationId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    setRows((prev) => prev.filter((r) => r.stationId !== deleteStationId));
    setShowDeleteConfirm(false);
    setDeleteStationId(null);
  };

  return (
    <div className="ops-stn-container">
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <main className="ops-stn-main">
        <div className="ops-stn-toolbar">
          <label className="ops-stn-search" aria-label="Search stations">
            <svg className="ops-stn-search-ico" viewBox="0 0 24 24" width="18" height="18">
              <path d="M15.5 14h-.79l-.28-.27a6.471 6.471 0 001.48-4.23C15.91 6.01 13.41 3.5 10.45 3.5S4.99 6.01 4.99 9.5 7.49 15.5 10.45 15.5c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l4.25 4.25c.41.41 1.07.41 1.48 0 .41-.41.41-1.07 0-1.48L15.5 14zm-5.05 0C8 14 6 12 6 9.5S8 5 10.45 5s4.45 2 4.45 4.5S12.9 14 10.45 14z" />
            </svg>
            <input
              className="ops-stn-search-input"
              type="text"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <button type="button" className="ops-stn-add-btn" onClick={onAdd}>
            Add
          </button>
        </div>

        <div className="ops-stn-table-wrap">
          <table className="ops-stn-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Station_ID</th>
                <th>Company_ID</th>
                <th>StationName</th>
                <th>Email</th>
                <th>Username</th>
                <th>Password</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.stationId}>
                  <td>{i + 1}</td>
                  <td>{r.stationId}</td>
                  <td>{r.companyId}</td>
                  <td>{r.stationName}</td>
                  <td>{r.email}</td>
                  <td>{r.username}</td>
                  <td>{r.password}</td>
                  <td className="ops-stn-actions">
                    <button className="ops-stn-action ops-stn-edit" onClick={() => onEdit(r.stationId)}>Edit</button>
                    <button className="ops-stn-action ops-stn-delete" onClick={() => onDelete(r.stationId)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="stn-modal-overlay-stations">
          <div className="stn-modal-stations">
            <div className="stn-modal-header-stations">
              <h3 className="stn-modal-title-stations">Add Station</h3>
              <button onClick={() => setShowAddModal(false)}>×</button>
            </div>

            {formError && <div className="stn-error-banner">{formError}</div>}

            <div className="stn-modal-body-stations">
              <label>Station ID:</label>
              <input type="text" value={newStation.stationId} onChange={(e) => setNewStation({ ...newStation, stationId: e.target.value })} />
              <label>Company ID: {newStation.companyId}</label>
              <label>Station Name:</label>
              <input type="text" value={newStation.stationName} onChange={(e) => setNewStation({ ...newStation, stationName: e.target.value })} />
              <label>Username:</label>
              <input type="text" value={newStation.username} onChange={(e) => setNewStation({ ...newStation, username: e.target.value })} />
              <label>Email:</label>
              <input type="email" value={newStation.email} onChange={(e) => setNewStation({ ...newStation, email: e.target.value })} />
              <label>New Password:</label>
              <input type="text" value={newStation.password} onChange={(e) => setNewStation({ ...newStation, password: e.target.value })} />
              <label>Confirm New Password:</label>
              <input type="text" value={newStation.confirmPassword} onChange={(e) => setNewStation({ ...newStation, confirmPassword: e.target.value })} />
            </div>

            <div className="stn-modal-actions-stations">
              <button className="stn-save-btn-stations" onClick={handleAddSave}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD CONFIRM */}
      {showAddConfirm && (
        <div className="stn-modal-overlay-stations">
          <div className="stn-modal-stations">
            <h3 className="stn-modal-title-stations">Confirm Add</h3>
            <p>Are you sure you want to add this station?</p>
            <div className="stn-modal-actions-stations">
              <button onClick={() => setShowAddConfirm(false)}>Cancel</button>
              <button onClick={confirmAdd}>Yes</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editStation && (
        <div className="stn-modal-overlay-stations">
          <div className="stn-modal-stations">
            <div className="stn-modal-header-stations">
              <h3 className="stn-modal-title-stations">Edit Station</h3>
              <button onClick={() => setShowEditModal(false)}>×</button>
            </div>

            {formError && <div className="stn-error-banner">{formError}</div>}

            <div className="stn-modal-body-stations">
              <label>Station ID: {editStation.stationId}</label>
              <label>Company ID: {editStation.companyId}</label>
              <label>Station Name:</label>
              <input type="text" value={editStation.stationName} onChange={(e) => setEditStation({ ...editStation, stationName: e.target.value })} />
              <label>Username:</label>
              <input type="text" value={editStation.username} onChange={(e) => setEditStation({ ...editStation, username: e.target.value })} />
              <label>Email:</label>
              <input type="email" value={editStation.email} onChange={(e) => setEditStation({ ...editStation, email: e.target.value })} />
              <label>New Password:</label>
              <input type="text" value={editStation.password} onChange={(e) => setEditStation({ ...editStation, password: e.target.value })} />
              <label>Confirm New Password:</label>
              <input type="text" value={editStation.confirmPassword} onChange={(e) => setEditStation({ ...editStation, confirmPassword: e.target.value })} />
            </div>

            <div className="stn-modal-actions-stations">
              <button className="stn-save-btn-stations" onClick={handleEditSave}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CONFIRM */}
      {showEditConfirm && (
        <div className="stn-modal-overlay-stations">
          <div className="stn-modal-stations">
            <h3 className="stn-modal-title-stations">Confirm Edit</h3>
            <p>Are you sure you want to save changes?</p>
            <div className="stn-modal-actions-stations">
              <button onClick={() => setShowEditConfirm(false)}>Cancel</button>
              <button onClick={confirmEdit}>Yes</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {showDeleteConfirm && (
        <div className="stn-modal-overlay-stations">
          <div className="stn-modal-stations">
            <h3 className="stn-modal-title-stations">Confirm Delete</h3>
            <p>Are you sure you want to delete this station?</p>
            <div className="stn-modal-actions-stations">
              <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button onClick={confirmDelete}>Yes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
