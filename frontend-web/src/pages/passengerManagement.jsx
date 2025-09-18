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

// normalize any id (number/string/null) to a stable string
const idOf = (v) => String(v ?? "");

export function Passenger() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [checked, setChecked] = useState(new Set()); // Set<string>
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Prevent body scroll when modal is open + close on Esc
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setShowConfirmDelete(false);
    };
    if (showConfirmDelete) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", onKey);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [showConfirmDelete]);

  // Fetch passengers
  const fetchPassengers = useCallback(async () => {
    try {
      const res = await axios.get(`${apiUrl}/api/users`, { params: { platform } });

      // Convert array-of-arrays to array-of-objects mapped to columns
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

  // Delete selected passengers (optimistic UI + sync)
  const deletePassengers = async () => {
    const ids = Array.from(checked); // string[]
    if (ids.length === 0) return;

    // Optimistic: remove from UI immediately
    setRows((prev) => prev.filter((r) => !ids.includes(idOf(r.User_ID))));
    setChecked(new Set());
    setShowConfirmDelete(false);

    // Sync with server
    try {
      await Promise.all(ids.map((id) => axios.delete(`${apiUrl}/api/users/${id}`)));
    } catch (error) {
      console.error("Some deletes failed:", error);
      // Fallback: re-fetch to ensure consistency
      fetchPassengers();
      return;
    }

    // Optional final sync (keeps UI accurate in case of server-side changes)
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
    if (e.target.checked) {
      setChecked(new Set(filtered.map((r) => idOf(r.User_ID))));
    } else {
      setChecked(new Set());
    }
  };

  const toggleOne = (id) => {
    const norm = idOf(id);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(norm)) next.delete(norm);
      else next.add(norm);
      return next;
    });
  };

  const allVisibleChecked =
    filtered.length > 0 &&
    filtered.every((r) => checked.has(idOf(r.User_ID)));

  return (
    <>
      <Navbar />
      <div className="pmc-main">
        <div className="pmc-header-row">
          <h1 className="pmc-title">Passenger Management</h1>
          <HeaderButton />
        </div>

        {/* Controls row: Search + Platform + Delete (aligned) */}
        <div className="pmc-controls">
          <label className="pmc-search">
            {/* Inline SVG magnifying glass */}
            <svg
              className="pmc-searchIcon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search"
              aria-label="Search passengers"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

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

        {/* Fixed-height grid: label stays, table area fills & scrolls */}
        <div className="pmc-content">
          <div className="pmc-section-label">Passenger Information</div>

          <div className="pmc-table-wrap">
            <table className="pmc-table">
              <thead>
                <tr>
                  <th className="pmc-sticky">
                    <input
                      type="checkbox"
                      checked={allVisibleChecked}
                      onChange={toggleAll}
                      aria-label="Select all visible passengers"
                    />
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
                    const rowKey = idOf(r.User_ID) || `row-${idx}`;
                    return (
                      <tr key={rowKey}>
                        <td className="pmc-sticky">
                          <input
                            type="checkbox"
                            checked={checked.has(idOf(r.User_ID))}
                            onChange={() => toggleOne(r.User_ID)}
                            aria-label={`Select passenger ${idOf(r.User_ID)}`}
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
      </div>

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <div
          className="pmc-confirmOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pmc-confirm-title"
          aria-describedby="pmc-confirm-desc"
          onClick={() => setShowConfirmDelete(false)}
        >
          <div
            className="pmc-confirmBox"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pmc-confirmHeader">
              <h3 id="pmc-confirm-title" className="pmc-confirmTitle">
                Delete Records
              </h3>
            </div>

            <div className="pmc-confirmBody">
              <p id="pmc-confirm-desc" className="pmc-confirmText">
                Are you sure you want to delete {checked.size} selected record
                {checked.size > 1 ? "s" : ""}? This action cannot be undone.
              </p>
            </div>

            {/* Footer buttons now aligned to the bottom-right */}
            <div className="pmc-confirmActions">
              <button
                className="pmc-btn pmc-btnOutline"
                onClick={() => setShowConfirmDelete(false)}
              >
                Cancel
              </button>
              <button
                className="pmc-btn pmc-btnNavy"
                onClick={deletePassengers}
                autoFocus
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}






