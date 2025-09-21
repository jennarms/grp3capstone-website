import { useEffect, useMemo, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import { OperationsTab } from "../components/operationsTab";
import "./operations_schedulesTab.css";

export function SchedulesTab() {
  const [schedules, setSchedules] = useState({
    headers: [
      "ESCOLTA", "LAWTON", "QUINTA", "PUP", "STA-ANA", "LAMBINGAN", "VALENZUELA",
      "HULO", "GUADALUPE", "SAN JOAQUIN", "KALAWAN"
    ],
    data: [
      ["8:15 AM","8:20 AM","8:22 AM","8:40 AM","8:55 AM","9:00 AM","9:10 AM","9:15 AM","9:20 AM","9:35 AM","9:30 AM"],
      ["9:00 AM","9:05 AM","9:07 AM","9:26 AM","9:39 AM","9:42 AM","9:50 AM","9:56 AM","10:00 AM","10:15 AM","10:20 AM"],
      ["10:00 AM","10:05 AM","10:07 AM","10:31 AM","10:44 AM","10:42 AM","10:47 AM","10:56 AM","10:00 AM","10:55 AM","11:12 AM"],
      ["11:00 AM","11:05 AM","11:07 AM","11:26 AM","11:35 AM","11:38 AM","11:44 AM","11:49 AM","11:55 AM","12:10 PM","12:15 PM"],
      ["12:00 PM","12:05 PM","12:07 PM","12:30 PM","12:40 PM","12:44 PM","12:52 PM","12:56 PM","1:00 PM","1:15 PM","1:20 PM"],
      ["1:00 PM","1:05 PM","1:07 PM","1:22 PM","1:33 PM","1:30 PM","1:43 PM","1:00 PM","2:05 PM","2:20 PM","2:25 PM"],
      ["2:00 PM","2:05 PM","2:07 PM","2:23 PM","2:35 PM","2:36 PM","2:43 PM","2:47 PM","2:55 PM","3:07 PM","3:15 PM"],
      ["3:00 PM","3:05 PM","3:07 PM","3:30 PM","3:36 PM","3:34 PM","3:40 PM","3:47 PM","3:52 PM","4:07 PM","4:15 PM"],
      ["4:00 PM","4:05 PM","4:07 PM","4:26 PM","4:37 PM","4:41 PM","4:50 PM","4:55 PM","5:00 PM","5:15 PM","5:20 PM"],
      ["5:00 PM","5:05 PM","5:07 PM","5:29 PM","5:41 PM","5:44 PM","5:53 PM","5:56 PM","6:00 PM","6:15 PM","6:20 PM"],
      ["5:30 PM","5:35 PM","5:37 PM","5:50 PM","6:00 PM","6:04 PM","6:09 PM","6:14 PM","6:20 PM","6:35 PM","6:40 PM"]
    ]
  });

  const [isEditing, setIsEditing] = useState(false);

  // Modals
  const [showConfirm, setShowConfirm] = useState(false);
  const [showAddChooser, setShowAddChooser] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);
  const [showAddStation, setShowAddStation] = useState(false);

  // Delete row confirm
  const [showDeleteRow, setShowDeleteRow] = useState(false);
  const [rowIndexToDelete, setRowIndexToDelete] = useState(null);

  // Delete column confirm
  const [showDeleteCol, setShowDeleteCol] = useState(false);
  const [colIndexToDelete, setColIndexToDelete] = useState(null);

  // Add Row / Station inputs
  const [rowsToAdd, setRowsToAdd] = useState(1);
  const [newStationName, setNewStationName] = useState("");

  // Inline header rename
  const [editingHeaderIdx, setEditingHeaderIdx] = useState(null);

  // Open kebab menu index
  const [openKebabIdx, setOpenKebabIdx] = useState(null);

  // Keep rows same length as headers
  useEffect(() => {
    setSchedules((prev) => {
      const cols = prev.headers.length;
      const fixedRows = prev.data.map((row) => {
        const r = row.slice(0, cols);
        while (r.length < cols) r.push("");
        return r;
      });
      return { ...prev, data: fixedRows };
    });
  }, [schedules.headers.length]); // eslint-disable-line

  const onCellChange = (r, c, value) => {
    setSchedules((prev) => {
      const next = prev.data.map((row, i) =>
        i === r ? row.map((col, j) => (j === c ? value : col)) : row
      );
      return { ...prev, data: next };
    });
  };

  const addRow = (count = 1) => {
    setSchedules((prev) => ({
      ...prev,
      data: [...prev.data, ...Array.from({ length: count }, () => Array(prev.headers.length).fill(""))]
    }));
  };

  const removeRow = (idx) => {
    setSchedules((prev) => ({
      ...prev,
      data: prev.data.filter((_, i) => i !== idx)
    }));
  };

  const addStation = () => {
    if (!newStationName.trim()) return;
    setSchedules((prev) => ({
      headers: [...prev.headers, newStationName.trim()],
      data: prev.data.map((row) => [...row, ""])
    }));
    setNewStationName("");
    setShowAddStation(false);
  };

  const removeStation = (colIdx) => {
    setSchedules((prev) => ({
      headers: prev.headers.filter((_, i) => i !== colIdx),
      data: prev.data.map((row) => row.filter((_, i) => i !== colIdx))
    }));
  };

  // Save handlers
  const onSave = (e) => { e.preventDefault(); setShowConfirm(true); };
  const handleConfirmCancel = () => setShowConfirm(false);

  // ESC closes modals/popovers
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setShowConfirm(false);
        setShowAddChooser(false);
        setShowAddRow(false);
        setShowAddStation(false);
        setShowDeleteRow(false);
        setShowDeleteCol(false);
        setOpenKebabIdx(null);
        setEditingHeaderIdx(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // CLICK-OUTSIDE to close kebab menu (so hovering won't close it)
  useEffect(() => {
    if (openKebabIdx == null) return;
    const onDocDown = (e) => {
      const t = e.target;
      // Keep open if clicking the kebab icon or the menu itself
      if (t && t.closest && (t.closest(".hdr-kebab") || t.closest(".hdr-menu"))) return;
      setOpenKebabIdx(null);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [openKebabIdx]);

  // Download JSON (Save a Copy)
  const downloadCopy = () => {
    const blob = new Blob([JSON.stringify(schedules, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "schedules.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const headerEditor = useMemo(() => {
    if (editingHeaderIdx == null) return null;
    return (
      <input
        className="sch-head-edit"
        value={schedules.headers[editingHeaderIdx]}
        onChange={(e) =>
          setSchedules((prev) => {
            const next = [...prev.headers];
            next[editingHeaderIdx] = e.target.value;
            return { ...prev, headers: next };
          })
        }
        onBlur={() => setEditingHeaderIdx(null)}
        onKeyDown={(e) => e.key === "Enter" && setEditingHeaderIdx(null)}
        autoFocus
      />
    );
  }, [editingHeaderIdx, schedules.headers]);

  // Kebab icon
  const Kebab = (props) => (
    <svg
      className="hdr-kebab"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      role="button"
      tabIndex={0}
      aria-label="Column actions"
      {...props}
    >
      <circle cx="12" cy="5" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="19" r="2" fill="currentColor" />
    </svg>
  );

  const onKebabKey = (e, i) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpenKebabIdx((cur) => (cur === i ? null : i));
    }
  };

  return (
    <>
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <div className="ops-sch-page">
        <div className="ops-sch-main">
          <h2 className="ops-sch-title">Schedules</h2>

          {/* Top controls: single Add + Edit */}
          <div className="ops-sch-topbar">
            <button
              type="button"
              className="ops-sch-chip"
              onClick={() => setShowAddChooser(true)}
              disabled={!isEditing}
            >
              Add
            </button>

            <button
              type="button"
              className={`ops-sch-edit ${isEditing ? "is-on" : ""}`}
              onClick={() => { setEditingHeaderIdx(null); setOpenKebabIdx(null); setIsEditing((v) => !v); }}
              aria-pressed={isEditing}
            >
              {isEditing ? "Done" : "Edit"}
            </button>
          </div>

          <div className="ops-sch-table-wrap" role="region" aria-label="Schedule Preview">
            <table className={`ops-sch-table ${isEditing ? "is-editing" : ""}`}>
              <thead>
                <tr>
                  {schedules.headers.map((h, i) => (
                    <th key={i}>
                      <div className="sch-head">
                        {/* NOT clickable; becomes input only after choosing Rename from kebab */}
                        {editingHeaderIdx === i && isEditing ? (
                          headerEditor
                        ) : (
                          <span className="sch-head-label">{h}</span>
                        )}

                        {/* Kebab (Edit mode only) */}
                        {isEditing && (
                          <>
                            <Kebab
                              onClick={() => setOpenKebabIdx((cur) => (cur === i ? null : i))}
                              onKeyDown={(e) => onKebabKey(e, i)}
                              aria-haspopup="menu"
                              aria-expanded={openKebabIdx === i}
                            />

                            {openKebabIdx === i && (
                              <div className="hdr-menu" role="menu">
                                <button
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenKebabIdx(null);
                                    setEditingHeaderIdx(i); // now it becomes editable
                                  }}
                                >
                                  Rename column
                                </button>
                                <button
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenKebabIdx(null);
                                    setColIndexToDelete(i);
                                    setShowDeleteCol(true);
                                  }}
                                >
                                  Delete column
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </th>
                  ))}
                  {/* Sticky ACTION column header */}
                  <th className="action-col">ACTION</th>
                </tr>
              </thead>

              <tbody>
                {schedules.data.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx}>
                        <input
                          className="sch-cell"
                          value={cell}
                          onChange={(e) => onCellChange(rIdx, cIdx, e.target.value)}
                          placeholder="--"
                          disabled={!isEditing}
                          readOnly={!isEditing}
                          tabIndex={isEditing ? 0 : -1}
                        />
                      </td>
                    ))}

                    {/* Sticky ACTION cell — trash icon via CSS background */}
                    <td className="action-col">
                      <button
                        type="button"
                        className="icon-btn"
                        title="Delete row"
                        aria-label={`Delete row ${rIdx + 1}`}
                        disabled={!isEditing}
                        onClick={() => { setRowIndexToDelete(rIdx); setShowDeleteRow(true); }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom actions */}
          <div className="ops-sch-actions">
            <button className="ops-sch-secondary" type="button" onClick={downloadCopy}>
              Save a Copy
            </button>
            <button className="ops-sch-primary" type="button" onClick={onSave}>
              Implement
            </button>
          </div>
        </div>
      </div>

      {/* Confirm dialog (Implement) */}
      {showConfirm && (
        <div className="confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={handleConfirmCancel}>
          <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
            <h3 id="confirm-title">Save Changes</h3>
            <p>Are you sure with this action?</p>
            <div className="confirm-buttons">
              <button className="cancel-btn" type="button" onClick={handleConfirmCancel} autoFocus>Cancel</button>
              <button className="yes-btn" type="button" onClick={() => { console.log("Schedules saved", schedules); setShowConfirm(false); }}>Yes</button>
            </div>
          </div>
        </div>
      )}

      {/* Add chooser modal */}
      {showAddChooser && (
        <div className="addch-overlay" role="dialog" aria-modal="true" aria-labelledby="add-chooser-title" onClick={() => setShowAddChooser(false)}>
          <div className="addch-box" onClick={(e) => e.stopPropagation()}>
            <h3 id="add-chooser-title" className="addch-title">What would you like to add?</h3>
            <div className="addch-actions">
              <button
                className="addch-btn outline"
                type="button"
                onClick={() => { setShowAddChooser(false); setRowsToAdd(1); setShowAddRow(true); }}
              >
                Add a row
              </button>
              <button
                className="addch-btn"
                type="button"
                onClick={() => { setShowAddChooser(false); setShowAddStation(true); }}
              >
                Add a station
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Row modal */}
      {showAddRow && (
        <div className="rt-modalOverlay" role="dialog" aria-modal="true" aria-labelledby="add-row-title" onClick={() => setShowAddRow(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 id="add-row-title" className="rt-modalTitle">Add Row</h3>
              <button className="rt-close" onClick={() => setShowAddRow(false)} aria-label="Close">×</button>
            </div>
            <div className="rt-modalBody">
              <label>
                Number of rows to add
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={rowsToAdd}
                  onChange={(e) => setRowsToAdd(Math.max(1, Math.min(100, Number(e.target.value) || 1)))}
                />
              </label>
              <p>New row(s) will be appended at the bottom with empty cells.</p>
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setShowAddRow(false)}>Cancel</button>
              <button
                className="rt-btn rt-btnNavy"
                onClick={() => { addRow(rowsToAdd); setShowAddRow(false); }}
              >
                Add Row(s)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Station modal */}
      {showAddStation && (
        <div className="rt-modalOverlay" role="dialog" aria-modal="true" aria-labelledby="add-station-title" onClick={() => setShowAddStation(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 id="add-station-title" className="rt-modalTitle">Add Station</h3>
              <button className="rt-close" onClick={() => setShowAddStation(false)} aria-label="Close">×</button>
            </div>
            <div className="rt-modalBody">
              <label>
                Station name
                <input
                  type="text"
                  value={newStationName}
                  onChange={(e) => setNewStationName(e.target.value.toUpperCase())}
                  placeholder="e.g., PINAGBUHATAN"
                />
              </label>
              <p>A new column will be added; existing rows get empty cells you can edit.</p>
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setShowAddStation(false)}>Cancel</button>
              <button className="rt-btn rt-btnNavy" onClick={addStation} disabled={!newStationName.trim()}>
                Add Station
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ROW modal */}
      {showDeleteRow && rowIndexToDelete !== null && (
        <div className="rt-modalOverlay" role="dialog" aria-modal="true" aria-labelledby="delete-row-title" onClick={() => setShowDeleteRow(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 id="delete-row-title" className="rt-modalTitle">Delete Row</h3>
              <button className="rt-close" onClick={() => setShowDeleteRow(false)} aria-label="Close">×</button>
            </div>
            <div className="rt-modalBody">
              <p>Are you sure you want to delete this row?</p>
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setShowDeleteRow(false)}>Cancel</button>
              <button
                className="rt-btn rt-btnNavy"
                onClick={() => { removeRow(rowIndexToDelete); setShowDeleteRow(false); setRowIndexToDelete(null); }}
              >
                Delete Row
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE COLUMN modal */}
      {showDeleteCol && colIndexToDelete !== null && (
        <div className="rt-modalOverlay" role="dialog" aria-modal="true" aria-labelledby="delete-col-title" onClick={() => setShowDeleteCol(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 id="delete-col-title" className="rt-modalTitle">Delete Column</h3>
              <button className="rt-close" onClick={() => setShowDeleteCol(false)} aria-label="Close">×</button>
            </div>
            <div className="rt-modalBody">
              <p>Are you sure you want to delete this column?</p>
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setShowDeleteCol(false)}>Cancel</button>
              <button
                className="rt-btn rt-btnNavy"
                onClick={() => {
                  removeStation(colIndexToDelete);
                  setShowDeleteCol(false);
                  setColIndexToDelete(null);
                }}
              >
                Delete Column
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
