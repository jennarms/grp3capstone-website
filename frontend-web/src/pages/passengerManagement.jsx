import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./passengerManagement.css";

const apiUrl = import.meta.env.VITE_API_URL;

// Define columns outside the component for stability
const columns = [
  "User_ID",
  "username",
  "passwordHash",
  "first_name",
  "last_name",
  "address",
  "profession",
  "contact_number",
  "age",
  "birthday",
  "gender",
  "profile",
  "created_at",
  "platform_source",
  "messenger_psid",
];

export function Passenger() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [checked, setChecked] = useState(new Set());
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Fetch passengers
  const fetchPassengers = useCallback(async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/users`, { params: { platform } });

      // Convert array-of-arrays to array-of-objects
      const data = res.data.map((arr) =>
        arr.reduce((obj, val, idx) => {
          obj[columns[idx]] = val;
          return obj;
        }, {})
      );

      setRows(data);
    } catch (error) {
      console.error("Failed to fetch passengers:", error);
    }
  }, [platform]);

  // Fetch whenever platform changes
  useEffect(() => {
    fetchPassengers();
  }, [fetchPassengers]);

  // Delete selected passengers
  const deletePassengers = async () => {
    for (let id of checked) {
      try {
        await axios.delete(`${apiUrl}/api/users/${id}`);
      } catch (error) {
        console.error(`Failed to delete ${id}:`, error);
      }
    }
    setChecked(new Set());
    setShowConfirmDelete(false);
    fetchPassengers();
  };

  // Filter rows based on search query and platform
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (platform !== "all" && r.platform_source !== platform) return false;
      if (!q) return true;
      return Object.values(r).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, platform]);

  const toggleAll = (e) => {
    if (e.target.checked) setChecked(new Set(filtered.map((r) => r.User_ID)));
    else setChecked(new Set());
  };

  const toggleOne = (id) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleChecked = filtered.length > 0 && filtered.every((r) => checked.has(r.User_ID));

  return (
    <>
      <Navbar />
      <div className="pmc-main">
        <div className="pmc-header-row">
          <h1 className="pmc-title">Passenger Management</h1>
          <HeaderButton />
        </div>

        <div className="pmc-controls">
          <div className="pmc-search">
            <input
              type="text"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="pmc-filter">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              aria-label="Filter by platform"
            >
              <option value="all">All Platforms</option>
              <option value="MA">MA</option>
              <option value="CB">CB</option>
              <option value="GM">GM</option>
              <option value="MB">MB</option>
            </select>
          </div>

          <button
            className="pmc-delete"
            onClick={() => setShowConfirmDelete(true)}
            disabled={checked.size === 0}
          >
            Delete
          </button>
        </div>


        <div className="pmc-section-label">Passenger Information</div>

        <div className="pmc-table-wrap">
          <table className="pmc-table">
            <thead>
              <tr>
                <th className="pmc-sticky">
                  <input type="checkbox" checked={allVisibleChecked} onChange={toggleAll} />
                </th>
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="pmc-empty">
                    No results.
                  </td>
                </tr>
              ) : (
                filtered.map((r, idx) => {
                  const rowKey = r.User_ID ?? `row-${idx}`;
                  return (
                    <tr key={rowKey}>
                      <td className="pmc-sticky">
                        <input
                          type="checkbox"
                          checked={checked.has(r.User_ID)}
                          onChange={() => toggleOne(r.User_ID)}
                        />
                      </td>
                      {columns.map((c) => (
                        <td key={`cell-${rowKey}-${c}`}>{r[c]}</td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showConfirmDelete && (
        <div className="confirm-overlay">
          <div className="confirm-box">
            <h3>Confirm Delete</h3>
            <p>
              Are you sure you want to delete {checked.size} selected record
              {checked.size > 1 ? "s" : ""}?
            </p>
            <div className="confirm-buttons">
              <button className="cancel-btn" onClick={() => setShowConfirmDelete(false)}>
                Cancel
              </button>
              <button className="yes-btn" onClick={deletePassengers}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
