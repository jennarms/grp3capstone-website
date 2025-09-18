import React, { useMemo, useState } from "react";
import { Navbar } from "../components/navBar";
import { HeaderButton } from "../components/headerButton";
import { OperationsTab } from "../components/operationsTab";
import "./operations_routesTab.css";

/* Station catalog used by the Station select */
const STATION_CATALOG = [
  { id: "S001", name: "Escolta" },
  { id: "S002", name: "Lawton" },
  { id: "S003", name: "Quinta" },
  { id: "S004", name: "PUP" },
  { id: "S005", name: "Sta. Ana" },
  { id: "S006", name: "Lambingan" },
  { id: "S007", name: "Valenzuela" },
  { id: "S008", name: "Hulo" },
  { id: "S009", name: "Guadalupe" },
  { id: "S010", name: "Maybunga" },
];

export function RoutesTab() {
  const [rows, setRows] = useState([
    { routeId: "R001", companyId: "C001", routeName: "Escolta-Kalawaan", waterFlow: "Upstream",   direction: "Forward" },
    { routeId: "R002", companyId: "C001", routeName: "Kalawaan-Escolta", waterFlow: "Upstream",   direction: "Reverse" },
    { routeId: "R003", companyId: "C001", routeName: "Escolta-Pinagbuhatan", waterFlow: "Downstream", direction: "Forward" },
    { routeId: "R004", companyId: "C001", routeName: "Pinagbuhatan-Escolta", waterFlow: "Downstream", direction: "Reverse" },
  ]);

  const [stationRows, setStationRows] = useState([
    { routeStationId: "RS001", routeId: "R001", stationId: "S001", stationName: "Escolta",   stopOrder: 1 },
    { routeStationId: "RS002", routeId: "R001", stationId: "S002", stationName: "Lawton",    stopOrder: 2 },
    { routeStationId: "RS003", routeId: "R001", stationId: "S003", stationName: "Quinta",    stopOrder: 3 },
  ]);

  const [query, setQuery] = useState("");
  const [route, setRoute] = useState("Escolta-Kalawaan");

  /* ===== ROUTE modals/state ===== */
  const [routeAddOpen, setRouteAddOpen] = useState(false);
  const [routeEditOpen, setRouteEditOpen] = useState(false);
  const [routeConfirm, setRouteConfirm] = useState({ kind: null, open: false });
  const [routeDraft, setRouteDraft] = useState({
    routeId: "",
    companyId: "C001",
    routeName: "",
    waterFlow: "Downstream",
    direction: "Forward",
  });
  const [routeEdit, setRouteEdit] = useState({
    routeId: "",
    companyId: "C001",
    routeName: "",
    waterFlow: "Downstream",
    direction: "Forward",
  });
  const [routeToDelete, setRouteToDelete] = useState(null);

  /* ===== STATION modals/state ===== */
  const [stAddOpen, setStAddOpen] = useState(false);
  const [stEditOpen, setStEditOpen] = useState(false);
  const [stConfirm, setStConfirm] = useState({ kind: null, open: false });
  const [stDraft, setStDraft] = useState({
    routeStationId: "",
    routeId: "",
    stationId: "",
    stationName: "",
    stopOrder: 1,
  });
  const [stEdit, setStEdit] = useState({
    routeStationId: "",
    routeId: "",
    stationId: "",
    stationName: "",
    stopOrder: 1,
  });
  const [stToDelete, setStToDelete] = useState(null);

  /* ===== Derived helpers ===== */
  const filteredRoutes = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) =>
      (r.routeId + r.companyId + r.routeName + r.waterFlow + r.direction)
        .toLowerCase()
        .includes(q)
    );
  }, [rows, query]);

  const filteredStations = useMemo(() => {
    if (!query.trim()) return stationRows;
    const q = query.toLowerCase();
    return stationRows.filter((r) =>
      (r.routeStationId + r.routeId + r.stationId + r.stationName + r.stopOrder)
        .toLowerCase()
        .includes(q)
    );
  }, [stationRows, query]);

  const selectedRouteId = useMemo(() => {
    const m = rows.find((r) => r.routeName === route);
    return m?.routeId || rows[0]?.routeId || "";
  }, [rows, route]);

  const nextRouteStationId = useMemo(() => {
    const nums = stationRows.map((s) => parseInt(String(s.routeStationId).replace(/\D/g, ""), 10) || 0);
    const next = (Math.max(0, ...nums) + 1).toString().padStart(3, "0");
    return `RS${next}`;
  }, [stationRows]);

  const nextStopOrder = useMemo(() => {
    const list = stationRows.filter((s) => s.routeId === selectedRouteId);
    const max = Math.max(0, ...list.map((s) => Number(s.stopOrder) || 0));
    return max + 1;
  }, [stationRows, selectedRouteId]);

  /* ===== ROUTES handlers ===== */
  const openRouteAdd = () => {
    setRouteDraft({ routeId: "", companyId: "C001", routeName: "", waterFlow: "Downstream", direction: "Forward" });
    setRouteAddOpen(true);
  };
  const saveRouteAdd = () => { setRouteAddOpen(false); setRouteConfirm({ kind: "add", open: true }); };
  const confirmRouteAdd = () => { setRows((p) => [...p, routeDraft]); setRouteConfirm({ kind: null, open: false }); };

  const openRouteEdit = (id) => {
    const r = rows.find((x) => x.routeId === id);
    if (!r) return;
    setRouteEdit({ ...r });
    setRouteEditOpen(true);
  };
  const saveRouteEdit = () => { setRouteEditOpen(false); setRouteConfirm({ kind: "edit", open: true }); };
  const confirmRouteEdit = () => {
    setRows((p) => p.map((r) => (r.routeId === routeEdit.routeId ? { ...routeEdit } : r)));
    setRouteConfirm({ kind: null, open: false });
  };

  const openRouteDelete = (id) => { setRouteToDelete(id); setRouteConfirm({ kind: "delete", open: true }); };
  const confirmRouteDelete = () => {
    setRows((p) => p.filter((r) => r.routeId !== routeToDelete));
    setRouteToDelete(null);
    setRouteConfirm({ kind: null, open: false });
  };

  /* ===== STATIONS handlers ===== */
  const openStationAdd = () => {
    const defaultStation = STATION_CATALOG[0];
    setStDraft({
      routeStationId: nextRouteStationId,
      routeId: selectedRouteId,
      stationId: defaultStation.id,
      stationName: defaultStation.name,
      stopOrder: nextStopOrder,
    });
    setStAddOpen(true);
  };
  const saveStationAdd = () => { setStAddOpen(false); setStConfirm({ kind: "add", open: true }); };
  const confirmStationAdd = () => {
    setStationRows((p) => [
      ...p,
      { ...stDraft, stopOrder: Number(stDraft.stopOrder) || 0 },
    ]);
    setStConfirm({ kind: null, open: false });
  };

  const openStationEdit = (routeStationId) => {
    const s = stationRows.find((x) => x.routeStationId === routeStationId);
    if (!s) return;
    setStEdit({ ...s });
    setStEditOpen(true);
  };
  const saveStationEdit = () => { setStEditOpen(false); setStConfirm({ kind: "edit", open: true }); };
  const confirmStationEdit = () => {
    setStationRows((p) =>
      p.map((s) =>
        s.routeStationId === stEdit.routeStationId ? { ...stEdit, stopOrder: Number(stEdit.stopOrder) || 0 } : s
      )
    );
    setStConfirm({ kind: null, open: false });
  };

  const openStationDelete = (routeStationId) => { setStToDelete(routeStationId); setStConfirm({ kind: "delete", open: true }); };
  const confirmStationDelete = () => {
    setStationRows((p) => p.filter((s) => s.routeStationId !== stToDelete));
    setStToDelete(null);
    setStConfirm({ kind: null, open: false });
  };

  return (
    <div className="ops-routes-container">
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <main className="ops-routes-main">
        <h3 className="ops-routes-table-title">Routes</h3>

        <label className="ops-routes-water-flow">
          Enable Water Flow:
          <select defaultValue="Downstream">
            <option value="Upstream">Upstream</option>
            <option value="Downstream">Downstream</option>
            <option value="Null">Null</option>
          </select>
        </label>

        <div className="ops-routes-toolbar">
          <label className="ops-routes-search">
            <input
              className="ops-routes-search-input"
              type="text"
              placeholder="Search Routes"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <button type="button" className="ops-routes-add-btn" onClick={openRouteAdd}>Add</button>
        </div>

        <div className="ops-routes-table-wrap">
          <table className="ops-routes-table">
            <thead>
              <tr>
                <th>Route_ID</th>
                <th>Company_ID</th>
                <th>Route Name</th>
                <th>Water Flow</th>
                <th>Direction</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoutes.map((r) => (
                <tr key={r.routeId}>
                  <td>{r.routeId}</td>
                  <td>{r.companyId}</td>
                  <td>{r.routeName}</td>
                  <td>{r.waterFlow}</td>
                  <td>{r.direction}</td>
                  <td className="ops-routes-actions">
                    <button className="ops-routes-action ops-routes-edit" onClick={() => openRouteEdit(r.routeId)}>Edit</button>
                    <button className="ops-routes-action ops-routes-delete" onClick={() => openRouteDelete(r.routeId)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="ops-routes-table-title">Station and Route</h3>
        <label className="ops-routes-station-route">
          Route:
          <select value={route} onChange={(e) => setRoute(e.target.value)}>
            {rows.map((r) => (
              <option key={r.routeId} value={r.routeName}>{r.routeName}</option>
            ))}
          </select>
        </label>

        <div className="ops-routes-toolbar">
          <label className="ops-routes-search">
            <input
              className="ops-routes-search-input"
              type="text"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <button type="button" className="ops-routes-add-btn" onClick={openStationAdd}>Add</button>
        </div>

        <div className="ops-routes-table-wrap">
          <table className="ops-routes-table">
            <thead>
              <tr>
                <th>RouteStation_ID</th>
                <th>Route_ID</th>
                <th>Station_ID</th>
                <th>StationName</th>
                <th>StopOrder</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStations.map((s) => (
                <tr key={s.routeStationId}>
                  <td>{s.routeStationId}</td>
                  <td>{s.routeId}</td>
                  <td>{s.stationId}</td>
                  <td>{s.stationName}</td>
                  <td>{s.stopOrder}</td>
                  <td className="ops-routes-actions">
                    <button className="ops-routes-action ops-routes-edit" onClick={() => openStationEdit(s.routeStationId)}>Edit</button>
                    <button className="ops-routes-action ops-routes-delete" onClick={() => openStationDelete(s.routeStationId)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {/* ===== ROUTE: add/edit/confirm (unchanged style) ===== */}
      {routeAddOpen && (
        <div className="rt-modalOverlay" onClick={() => setRouteAddOpen(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">Add Route</h3>
              <button className="rt-close" onClick={() => setRouteAddOpen(false)}>×</button>
            </div>
            <div className="rt-modalBody">
              <label>Route ID</label>
              <input value={routeDraft.routeId} onChange={(e) => setRouteDraft({ ...routeDraft, routeId: e.target.value })} />
              <label>Company ID</label>
              <input value={routeDraft.companyId} onChange={(e) => setRouteDraft({ ...routeDraft, companyId: e.target.value })} />
              <label>Route Name</label>
              <input value={routeDraft.routeName} onChange={(e) => setRouteDraft({ ...routeDraft, routeName: e.target.value })} />
              <label>Direction</label>
              <select value={routeDraft.direction} onChange={(e) => setRouteDraft({ ...routeDraft, direction: e.target.value })}>
                <option value="Forward">Forward</option>
                <option value="Reverse">Reverse</option>
              </select>
              <label>Water Flow</label>
              <select value={routeDraft.waterFlow} onChange={(e) => setRouteDraft({ ...routeDraft, waterFlow: e.target.value })}>
                <option value="Upstream">Upstream</option>
                <option value="Downstream">Downstream</option>
              </select>
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setRouteAddOpen(false)}>Cancel</button>
              <button className="rt-btn rt-btnNavy" onClick={saveRouteAdd}>Save</button>
            </div>
          </div>
        </div>
      )}

      {routeEditOpen && (
        <div className="rt-modalOverlay" onClick={() => setRouteEditOpen(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">Edit Route</h3>
              <button className="rt-close" onClick={() => setRouteEditOpen(false)}>×</button>
            </div>
            <div className="rt-modalBody">
              <label>Route ID</label>
              <input value={routeEdit.routeId} disabled />
              <label>Company ID</label>
              <input value={routeEdit.companyId} onChange={(e) => setRouteEdit({ ...routeEdit, companyId: e.target.value })} />
              <label>Route Name</label>
              <input value={routeEdit.routeName} onChange={(e) => setRouteEdit({ ...routeEdit, routeName: e.target.value })} />
              <label>Direction</label>
              <select value={routeEdit.direction} onChange={(e) => setRouteEdit({ ...routeEdit, direction: e.target.value })}>
                <option value="Forward">Forward</option>
                <option value="Reverse">Reverse</option>
              </select>
              <label>Water Flow</label>
              <select value={routeEdit.waterFlow} onChange={(e) => setRouteEdit({ ...routeEdit, waterFlow: e.target.value })}>
                <option value="Upstream">Upstream</option>
                <option value="Downstream">Downstream</option>
              </select>
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setRouteEditOpen(false)}>Cancel</button>
              <button className="rt-btn rt-btnNavy" onClick={saveRouteEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {routeConfirm.open && (
        <div className="rt-modalOverlay" onClick={() => setRouteConfirm({ kind: null, open: false })}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">
                {routeConfirm.kind === "add" && "Confirm Add"}
                {routeConfirm.kind === "edit" && "Confirm Edit"}
                {routeConfirm.kind === "delete" && "Confirm Delete"}
              </h3>
            </div>
            <div className="rt-modalBody">
              {routeConfirm.kind === "delete"
                ? "Are you sure you want to delete this route?"
                : "Are you sure you want to proceed?"}
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setRouteConfirm({ kind: null, open: false })}>Cancel</button>
              {routeConfirm.kind === "add"    && <button className="rt-btn rt-btnNavy" onClick={confirmRouteAdd}>Add</button>}
              {routeConfirm.kind === "edit"   && <button className="rt-btn rt-btnNavy" onClick={confirmRouteEdit}>Save</button>}
              {routeConfirm.kind === "delete" && <button className="rt-btn rt-btnNavy" onClick={confirmRouteDelete}>Delete</button>}
            </div>
          </div>
        </div>
      )}

      {/* ====== STATION: Add (new layout like your mock) ====== */}
      {stAddOpen && (
        <div className="rt-modalOverlay" onClick={() => setStAddOpen(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">Add Station for Route</h3>
              <button className="rt-close" onClick={() => setStAddOpen(false)}>×</button>
            </div>

            <div className="rt-modalBody rt-stAddBody">
              <div className="rt-descRow">
                <span className="rt-descLabel">RouteStation ID:</span>
                <span className="rt-descValue">{stDraft.routeStationId}</span>
              </div>
              <div className="rt-descRow">
                <span className="rt-descLabel">Route ID:</span>
                <span className="rt-descValue">{stDraft.routeId || selectedRouteId}</span>
              </div>
              <div className="rt-descRow">
                <span className="rt-descLabel">Station ID:</span>
                <span className="rt-descValue">{stDraft.stationId || "—"}</span>
              </div>

              <label className="rt-fieldLabel">Station</label>
              <select
                className="rt-select"
                value={stDraft.stationId}
                onChange={(e) => {
                  const st = STATION_CATALOG.find((s) => s.id === e.target.value);
                  setStDraft((prev) => ({
                    ...prev,
                    stationId: st?.id || "",
                    stationName: st?.name || "",
                  }));
                }}
              >
                {STATION_CATALOG.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <label className="rt-fieldLabel">Stop Order</label>
              <input
                type="number"
                className="rt-input"
                min="0"
                value={stDraft.stopOrder}
                onChange={(e) => setStDraft({ ...stDraft, stopOrder: e.target.value })}
              />
            </div>

            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setStAddOpen(false)}>Cancel</button>
              <button className="rt-btn rt-btnNavy" onClick={saveStationAdd}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* STATION: Edit & Confirm (unchanged style) */}
      {stEditOpen && (
        <div className="rt-modalOverlay" onClick={() => setStEditOpen(false)}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">Edit Station Route</h3>
              <button className="rt-close" onClick={() => setStEditOpen(false)}>×</button>
            </div>
            <div className="rt-modalBody">
              <label>RouteStation ID</label>
              <input value={stEdit.routeStationId} disabled />
              <label>Route ID</label>
              <input value={stEdit.routeId} onChange={(e) => setStEdit({ ...stEdit, routeId: e.target.value })} />
              <label>Station ID</label>
              <input value={stEdit.stationId} onChange={(e) => setStEdit({ ...stEdit, stationId: e.target.value })} />
              <label>Station Name</label>
              <input value={stEdit.stationName} onChange={(e) => setStEdit({ ...stEdit, stationName: e.target.value })} />
              <label>Stop Order</label>
              <input type="number" min="0" value={stEdit.stopOrder} onChange={(e) => setStEdit({ ...stEdit, stopOrder: e.target.value })} />
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setStEditOpen(false)}>Cancel</button>
              <button className="rt-btn rt-btnNavy" onClick={saveStationEdit}>Save</button>
            </div>
          </div>
        </div>
      )}

      {stConfirm.open && (
        <div className="rt-modalOverlay" onClick={() => setStConfirm({ kind: null, open: false })}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rt-modalHeader">
              <h3 className="rt-modalTitle">
                {stConfirm.kind === "add" && "Confirm Add"}
                {stConfirm.kind === "edit" && "Confirm Edit"}
                {stConfirm.kind === "delete" && "Confirm Delete"}
              </h3>
            </div>
            <div className="rt-modalBody">
              {stConfirm.kind === "delete"
                ? "Are you sure you want to delete this record?"
                : "Are you sure you want to proceed?"}
            </div>
            <div className="rt-modalActions">
              <button className="rt-btn rt-btnOutline" onClick={() => setStConfirm({ kind: null, open: false })}>Cancel</button>
              {stConfirm.kind === "add"    && <button className="rt-btn rt-btnNavy" onClick={confirmStationAdd}>Add</button>}
              {stConfirm.kind === "edit"   && <button className="rt-btn rt-btnNavy" onClick={confirmStationEdit}>Save</button>}
              {stConfirm.kind === "delete" && <button className="rt-btn rt-btnNavy" onClick={confirmStationDelete}>Delete</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}