import { useCallback, useEffect, useMemo, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import { OperationsTab } from "../components/operationsTab";
import "./operations_stationsTab.css";

export function StationsTab() {
  const [rows, setRows] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditOtpModal, setShowEditOtpModal] = useState(false);
  const [editStation, setEditStation] = useState(null);

  const [showDeleteOtpModal, setShowDeleteOtpModal] = useState(false);
  const [deleteStationId, setDeleteStationId] = useState(null);

  const [formError, setFormError] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [newStation, setNewStation] = useState({
    companyId: "",
    stationName: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    lat: "",
    lon: "",
  });

  const apiUrl = import.meta.env.VITE_API_URL;

  const getToken = () => {
    return localStorage.getItem("token") || sessionStorage.getItem("token");
  };

  const apiRequest = useCallback(async (url, options = {}) => {
    const token = getToken();
    const headers = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${apiUrl}${url}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: "Request failed",
      }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }, [apiUrl]);

  const fetchCompanies = useCallback(async () => {
    try {
      const data = await apiRequest("/api/company/");
      setCompanies(data);

      setNewStation((prev) => ({
        ...prev,
        companyId: prev.companyId || data[0]?.companyId || data[0]?.Company_ID || "",
      }));
    } catch (err) {
      console.error("Failed to fetch companies:", err);
      setCompanies([{ companyId: "company001", companyName: "Default Company" }]);
      setNewStation((prev) => ({ ...prev, companyId: prev.companyId || "company001" }));
    }
  }, [apiRequest]);

  const fetchStations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest("/api/station/");
      setRows(data);
    } catch (err) {
      setError(`Failed to fetch stations: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]);

  useEffect(() => {
    fetchCompanies();
    fetchStations();
  }, [fetchCompanies, fetchStations]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      (r.stationId + r.companyId + r.stationName + r.email + r.username).toLowerCase().includes(q)
    );
  }, [rows, query]);

  const onAdd = () => {
    setFormError("");
    setShowAddModal(true);
  };

  const handleAddSave = async () => {
    const { companyId, stationName, username, email, password, confirmPassword, lat, lon } = newStation;

    if (!companyId || !stationName || !username || !email || !password || !confirmPassword || !lat || !lon) {
      setFormError("All fields are required.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    if (rows.some(station => station.email === email)) {
      setFormError("This email is already used by another station.");
      return;
    }

    try {
      setLoading(true);
      await apiRequest("/api/station/request-add", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setShowAddModal(false);
      setShowOtpModal(true);
    } catch (err) {
      setFormError(`Failed to send OTP: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmAdd = async () => {
    if (!otpCode) {
      setFormError("Please enter the OTP code.");
      return;
    }

    try {
      setLoading(true);
      const response = await apiRequest("/api/station/confirm-add", {
        method: "POST",
        body: JSON.stringify({ otpCode, details: newStation }),
      });

      setShowOtpModal(false);
      setOtpCode("");
      setNewStation({
        companyId: companies.length > 0 ? (companies[0].companyId || companies[0].Company_ID) : "",
        stationName: "",
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        lat: "",
        lon: "",
      });

      await fetchStations();
      alert(`Station created successfully! ID: ${response.stationId}`);
    } catch (err) {
      setFormError(`Failed to create station: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onEdit = (id) => {
    const station = rows.find((r) => r.stationId === id);
    setEditStation({ ...station, password: "", confirmPassword: "" });
    setShowEditModal(true);
    setFormError("");
  };

  const handleEditSave = async () => {
    if (!editStation) return;

    const original = rows.find((r) => r.stationId === editStation.stationId);
    const emailChanged = original?.email !== editStation.email;
    const passwordChanged = editStation.password !== "";

    if (passwordChanged && editStation.password !== editStation.confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    if (emailChanged && rows.some(station => station.email === editStation.email)) {
      setFormError("This email is already used by another station.");
      return;
    }

    if (emailChanged) {
      try {
        setLoading(true);
        await apiRequest(`/api/station/request-update/${editStation.stationId}`, {
          method: "POST",
          body: JSON.stringify({ email: editStation.email }),
        });
        setShowEditModal(false);
        setShowEditOtpModal(true);
      } catch (err) {
        setFormError(`Failed to send OTP: ${err.message}`);
      } finally {
        setLoading(false);
      }
    } else {
      await confirmEdit();
    }
  };

  const confirmEdit = async () => {
    if (!editStation) return;

    const original = rows.find((r) => r.stationId === editStation.stationId);
    const emailChanged = original?.email !== editStation.email;

    if (emailChanged && !otpCode) {
      setFormError("Please enter the OTP code.");
      return;
    }

    try {
      setLoading(true);
      await apiRequest(`/api/station/update/${editStation.stationId}`, {
        method: "POST",
        body: JSON.stringify({
          ...(emailChanged && { otpCode }),
          details: {
            stationName: editStation.stationName,
            email: editStation.email,
            username: editStation.username,
            lat: editStation.lat,
            lon: editStation.lon,
            ...(editStation.password && { password: editStation.password }),
          },
        }),
      });

      setShowEditOtpModal(false);
      setShowEditModal(false);
      setOtpCode("");
      setEditStation(null);

      await fetchStations();
      alert("Station updated successfully!");
    } catch (err) {
      setFormError(`Failed to update station: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (id) => {
    try {
      setLoading(true);
      await apiRequest(`/api/station/request-delete/${id}`, { method: "POST" });
      setDeleteStationId(id);
      setShowDeleteOtpModal(true);
      alert("OTP has been sent to the station email.");
    } catch (err) {
      setFormError(`Failed to request delete: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!otpCode || !adminPassword) {
      setFormError("OTP and Admin password are required.");
      return;
    }

    try {
      setLoading(true);
      await apiRequest(`/api/station/confirm-delete/${deleteStationId}`, {
        method: "POST",
        body: JSON.stringify({ otpCode, adminPassword }),
      });

      setShowDeleteOtpModal(false);
      setAdminPassword("");
      setOtpCode("");
      setDeleteStationId(null);

      await fetchStations();
      alert("Station deleted successfully!");
    } catch (err) {
      setFormError(`Failed to delete station: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ops-stn-container">
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <h2 className="ops-stn-title">Stations</h2>

      <main className="ops-stn-main">
        {error && (
          <div className="stn-error-banner" style={{ margin: '10px 0' }}>
            {error}
            <button onClick={() => setError("")} style={{ marginLeft: '10px', background: 'transparent', border: 'none', color: 'white' }}>x</button>
          </div>
        )}

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
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>
                    Loading stations...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>
                    No stations found
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={r.stationId}>
                    <td>{i + 1}</td>
                    <td>{r.stationId}</td>
                    <td>{r.companyId}</td>
                    <td>{r.stationName}</td>
                    <td>{r.email}</td>
                    <td>{r.username}</td>
                    <td>{r.lat}</td>
                    <td>{r.lon}</td>
                    <td className="ops-stn-actions">
                      <button className="ops-stn-action ops-stn-edit" onClick={() => onEdit(r.stationId)}>Edit</button>
                      <button className="ops-stn-action ops-stn-delete" onClick={() => onDelete(r.stationId)}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* ADD MODAL */}
      {showAddModal && (
        <div className="stn-modal-overlay-stations">
          <div className="stn-modal-stations" onClick={(e) => e.stopPropagation()}>
            <div className="stn-modal-header-stations">
              <h3 className="stn-modal-title-stations">Add Station</h3>
              <button className="stn-close-stations" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>

            {formError && <div className="stn-error-banner">{formError}</div>}

            <div className="stn-modal-body-stations">
              <label>Company:</label>
              <select
                value={newStation.companyId}
                onChange={(e) => setNewStation({ ...newStation, companyId: e.target.value })}
                disabled={loading}
              >
                <option value="">Select a company...</option>
                {companies.map(company => (
                  <option
                    key={company.companyId || company.Company_ID}
                    value={company.companyId || company.Company_ID}
                  >
                    {company.companyName || company.Company_Name || `Company ${company.companyId || company.Company_ID}`}
                  </option>
                ))}
              </select>
              
              <label>Station Name:</label>
              <input
                type="text"
                value={newStation.stationName}
                onChange={(e) => setNewStation({ ...newStation, stationName: e.target.value })}
                disabled={loading}
              />
              <label>Username:</label>
              <input
                type="text"
                value={newStation.username}
                onChange={(e) => setNewStation({ ...newStation, username: e.target.value })}
                disabled={loading}
              />
              <label>Email:</label>
              <input
                type="email"
                value={newStation.email}
                onChange={(e) => setNewStation({ ...newStation, email: e.target.value })}
                disabled={loading}
              />
              <label>New Password:</label>
              <input
                type="password"
                value={newStation.password}
                onChange={(e) => setNewStation({ ...newStation, password: e.target.value })}
                disabled={loading}
              />
              <label>Confirm New Password:</label>
              <input
                type="password"
                value={newStation.confirmPassword}
                onChange={(e) => setNewStation({ ...newStation, confirmPassword: e.target.value })}
                disabled={loading}
              />
              <label>Latitude:</label>
              <input
                type="text"
                value={newStation.lat}
                onChange={(e) => setNewStation({ ...newStation, lat: e.target.value })}
                disabled={loading}
              />
              <label>Longitude:</label>
              <input
                type="text"
                value={newStation.lon}
                onChange={(e) => setNewStation({ ...newStation, lon: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="stn-modal-actions-stations">
              <button className="stn-btn stn-btnOutline" onClick={() => setShowAddModal(false)} disabled={loading}>Cancel</button>
              <button className="stn-btn stn-btnNavy" onClick={handleAddSave} disabled={loading}>
                {loading ? 'Sending OTP...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP VERIFICATION MODAL FOR ADD */}
      {showOtpModal && (
        <div className="stn-modal-overlay-stations">
          <div className="stn-modal-stations" onClick={(e) => e.stopPropagation()}>
            <div className="stn-modal-header-stations">
              <h3 className="stn-modal-title-stations">Enter OTP</h3>
              <button className="stn-close-stations" onClick={() => setShowOtpModal(false)}>&times;</button>
            </div>

            {formError && <div className="stn-error-banner">{formError}</div>}

            <div className="stn-modal-body-stations">
              <p>An OTP has been sent to your email. Please enter it below:</p>
              <label>OTP Code:</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength="6"
                disabled={loading}
              />
            </div>

            <div className="stn-modal-actions-stations">
              <button className="stn-btn stn-btnOutline" onClick={() => setShowOtpModal(false)} disabled={loading}>Cancel</button>
              <button className="stn-btn stn-btnNavy" onClick={confirmAdd} disabled={loading}>
                                {loading ? 'Creating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editStation && (
        <div className="stn-modal-overlay-stations">
          <div className="stn-modal-stations" onClick={(e) => e.stopPropagation()}>
            <div className="stn-modal-header-stations">
              <h3 className="stn-modal-title-stations">Edit Station</h3>
              <button className="stn-close-stations" onClick={() => setShowEditModal(false)}>&times;</button>
            </div>

            {formError && <div className="stn-error-banner">{formError}</div>}

            <div className="stn-modal-body-stations">
              <label>Station ID: {editStation.stationId}</label>
              <label>Company: {editStation.companyId}</label>
              <label>Station Name:</label>
              <input
                type="text"
                value={editStation.stationName}
                onChange={(e) => setEditStation({ ...editStation, stationName: e.target.value })}
                disabled={loading}
              />
              <label>Username:</label>
              <input
                type="text"
                value={editStation.username}
                onChange={(e) => setEditStation({ ...editStation, username: e.target.value })}
                disabled={loading}
              />
              <label>Email:</label>
              <input
                type="email"
                value={editStation.email}
                onChange={(e) => setEditStation({ ...editStation, email: e.target.value })}
                disabled={loading}
              />
              <label>New Password:</label>
              <input
                type="password"
                value={editStation.password}
                onChange={(e) => setEditStation({ ...editStation, password: e.target.value })}
                disabled={loading}
              />
              <label>Confirm New Password:</label>
              <input
                type="password"
                value={editStation.confirmPassword}
                onChange={(e) => setEditStation({ ...editStation, confirmPassword: e.target.value })}
                disabled={loading}
              />
              <label>Latitude:</label>
              <input
                type="text"
                value={editStation.lat}
                onChange={(e) => setEditStation({ ...editStation, lat: e.target.value })}
                disabled={loading}
              />
              <label>Longitude:</label>
              <input
                type="text"
                value={editStation.lon}
                onChange={(e) => setEditStation({ ...editStation, lon: e.target.value })}
                disabled={loading}
              />
            </div>

            <div className="stn-modal-actions-stations">
              <button className="stn-btn stn-btnOutline" onClick={() => setShowEditModal(false)} disabled={loading}>Cancel</button>
              <button className="stn-btn stn-btnNavy" onClick={handleEditSave} disabled={loading}>
                {loading ? 'Processing...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT OTP MODAL */}
      {showEditOtpModal && (
        <div className="stn-modal-overlay-stations">
          <div className="stn-modal-stations" onClick={(e) => e.stopPropagation()}>
            <div className="stn-modal-header-stations">
              <h3 className="stn-modal-title-stations">Enter OTP for Email Change</h3>
              <button className="stn-close-stations" onClick={() => setShowEditOtpModal(false)}>&times;</button>
            </div>

            {formError && <div className="stn-error-banner">{formError}</div>}

            <div className="stn-modal-body-stations">
              <p>An OTP has been sent to the new email address. Please enter it below:</p>
              <label>OTP Code:</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength="6"
                disabled={loading}
              />
            </div>

            <div className="stn-modal-actions-stations">
              <button className="stn-btn stn-btnOutline" onClick={() => setShowEditOtpModal(false)} disabled={loading}>Cancel</button>
              <button className="stn-btn stn-btnNavy" onClick={confirmEdit} disabled={loading}>
                {loading ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL WITH OTP + ADMIN PASSWORD */}
      {showDeleteOtpModal && (
        <div className="stn-modal-overlay-stations">
          <div className="stn-modal-stations" onClick={(e) => e.stopPropagation()}>
            <div className="stn-modal-header-stations">
              <h3 className="stn-modal-title-stations">Confirm Deletion</h3>
              <button className="stn-close-stations" onClick={() => setShowDeleteOtpModal(false)}>&times;</button>
            </div>

            {formError && <div className="stn-error-banner">{formError}</div>}

            <div className="stn-modal-body-stations">
              <p>Enter OTP sent to the station's email and your admin password:</p>

              <label>OTP Code:</label>
              <input
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength="6"
                disabled={loading}
              />

              <label>Admin Password:</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Enter admin password"
                disabled={loading}
              />
            </div>

            <div className="stn-modal-actions-stations">
              <button className="stn-btn stn-btnOutline" onClick={() => setShowDeleteOtpModal(false)} disabled={loading}>Cancel</button>
              <button className="stn-btn stn-btnNavy" onClick={confirmDelete} disabled={loading}>
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

