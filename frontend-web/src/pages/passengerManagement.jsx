import React, { useMemo, useState } from "react";
import "./passengerManagement.css";
import { Navbar } from "../components/navBar";
import { HeaderButton } from "../components/headerButton";

const SEED_ROWS = [
  {
    user_id: "UID0020489",
    username: "pedrodelacruz",
    passwordHash: "$2y$10$1J...",
    first_name: "Pedro",
    last_name: "Dela Cruz",
    address: "Manila",
    profession: "Student",
    contact_number: "09123456789",
    age: 19,
    birthday: "2005/09/10",
    gender: "M",
    profile: "https://yourapp.com/uploads/...",
    created_at: "2025-01-05 09:15:20",
    platform_source: "MA",
    platform_source_id: "—",
  },
  {
    user_id: "UID726571",
    username: "angie01",
    passwordHash: "$2y$10$1J...",
    first_name: "Angie",
    last_name: "Dulluo",
    address: "Caloocan",
    profession: "Teacher",
    contact_number: "09123456789",
    age: 26,
    birthday: "1999/03/25",
    gender: "F",
    profile: "https://yourapp.com/uploads/...",
    created_at: "2024-11-12 12:17:12",
    platform_source: "MA",
    platform_source_id: "—",
  },
  {
    user_id: "UID638193",
    username: "ken",
    passwordHash: "$2y$10$J...",
    first_name: "Ken",
    last_name: "Amanse",
    address: "Valenzuela",
    profession: "Banker",
    contact_number: "09123456789",
    age: 25,
    birthday: "1999/12/02",
    gender: "M",
    profile: "https://yourapp.com/uploads/...",
    created_at: "2023-07-10 00:00:00",
    platform_source: "CB",
    platform_source_id: "a1b2c3d4e...",
  },
  {
    user_id: "UID078263",
    username: "maritadev1",
    passwordHash: "$2y$10$J...",
    first_name: "Marita",
    last_name: "Dela Vega",
    address: "Makati",
    profession: "Businessman",
    contact_number: "09123456789",
    age: 33,
    birthday: "1991/06/30",
    gender: "F",
    profile: "https://yourapp.com/uploads/...",
    created_at: "2023-07-10 00:00:00",
    platform_source: "MA",
    platform_source_id: "—",
  },
  {
    user_id: "UID012861",
    username: "elijah",
    passwordHash: "$2y$10$J...",
    first_name: "Elijah",
    last_name: "Trinidad",
    address: "Manila",
    profession: "Student",
    contact_number: "09123456789",
    age: 18,
    birthday: "2006/07/15",
    gender: "M",
    profile: "https://yourapp.com/uploads/...",
    created_at: "2025-06-01 23:59:49",
    platform_source: "CB",
    platform_source_id: "e5f6g7h8i9...",
  },
  {
    user_id: "UID097260",
    username: "kevin",
    passwordHash: "$2y$10$J...",
    first_name: "Kevin",
    last_name: "Villano",
    address: "Makati",
    profession: "BPO",
    contact_number: "09123456789",
    age: 26,
    birthday: "1999/01/19",
    gender: "M",
    profile: "https://yourapp.com/uploads/...",
    created_at: "2023-07-10 00:00:00",
    platform_source: "GM",
    platform_source_id: "—",
  },
  {
    user_id: "UID892717",
    username: "jengonzaga488",
    passwordHash: "$2y$10$J...",
    first_name: "Jen",
    last_name: "Gonzaga",
    address: "Muntinlupa",
    profession: "Student",
    contact_number: "09123456789",
    age: 20,
    birthday: "2004/08/09",
    gender: "F",
    profile: "https://yourapp.com/uploads/...",
    created_at: "2025-06-01 23:59:49",
    platform_source: "MA",
    platform_source_id: "—",
  },
  {
    user_id: "UID124144",
    username: "valerie",
    passwordHash: "$2y$10$J...",
    first_name: "Valerie",
    last_name: "Santos",
    address: "Taguig",
    profession: "Student",
    contact_number: "09123456789",
    age: 17,
    birthday: "2007/10/28",
    gender: "F",
    profile: "https://yourapp.com/uploads/...",
    created_at: "2023-07-10 00:00:00",
    platform_source: "MB",
    platform_source_id: "—",
  },
];

export function Passenger() {
  const [rows, setRows] = useState(SEED_ROWS);
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("all");
  const [checked, setChecked] = useState(() => new Set());

  const columns = [
    { key: "select", label: "" },
    { key: "user_id", label: "User ID" },
    { key: "username", label: "username" },
    { key: "passwordHash", label: "passwordHash" },
    { key: "first_name", label: "first_name" },
    { key: "last_name", label: "last_name" },
    { key: "address", label: "address" },
    { key: "profession", label: "profession" },
    { key: "contact_number", label: "contact_number" },
    { key: "age", label: "age" },
    { key: "birthday", label: "birthday" },
    { key: "gender", label: "gender" },
    { key: "profile", label: "profile" },
    { key: "created_at", label: "created_at" },
    { key: "platform_source", label: "platform_source" },
    { key: "platform_source_id", label: "platform_source" },
  ];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (platform !== "all" && r.platform_source !== platform) return false;
      if (!q) return true;
      // search across all fields
      return Object.values(r).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, platform]);

  const toggleAll = (e) => {
    if (e.target.checked) {
      const next = new Set(filtered.map((r) => r.user_id));
      setChecked(next);
    } else {
      setChecked(new Set());
    }
  };

  const toggleOne = (id) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onDelete = () => {
    if (checked.size === 0) return;
    const ok = window.confirm(
      `Delete ${checked.size} selected record${checked.size > 1 ? "s" : ""}?`
    );
    if (!ok) return;
    setRows((prev) => prev.filter((r) => !checked.has(r.user_id)));
    setChecked(new Set());
  };

  const allVisibleChecked =
    filtered.length > 0 &&
    filtered.every((r) => checked.has(r.user_id));

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
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 2a8 8 0 105.293 14.293l4.707 4.707 1.414-1.414-4.707-4.707A8 8 0 0010 2zm0 2a6 6 0 110 12A6 6 0 0110 4z" />
            </svg>
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
              <option value="all">Filter by platform</option>
              <option value="MA">MA</option>
              <option value="CB">CB</option>
              <option value="GM">GM</option>
              <option value="MB">MB</option>
            </select>
          </div>

          <button
            className="pmc-delete"
            onClick={onDelete}
            disabled={checked.size === 0}
            title={checked.size === 0 ? "Select rows to delete" : "Delete"}
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
                  <input
                    type="checkbox"
                    checked={allVisibleChecked}
                    onChange={toggleAll}
                    aria-label="Select all visible"
                  />
                </th>
                {columns
                  .filter((c) => c.key !== "select")
                  .map((c) => (
                    <th key={c.key}>{c.label}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="pmc-empty">
                    No results.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.user_id}>
                    <td className="pmc-sticky">
                      <input
                        type="checkbox"
                        checked={checked.has(r.user_id)}
                        onChange={() => toggleOne(r.user_id)}
                        aria-label={`Select ${r.user_id}`}
                      />
                    </td>
                    <td>{r.user_id}</td>
                    <td>{r.username}</td>
                    <td className="pmc-mono">{r.passwordHash}</td>
                    <td>{r.first_name}</td>
                    <td>{r.last_name}</td>
                    <td>{r.address}</td>
                    <td>{r.profession}</td>
                    <td>{r.contact_number}</td>
                    <td>{r.age}</td>
                    <td>{r.birthday}</td>
                    <td>{r.gender}</td>
                    <td className="pmc-ellipsis" title={r.profile}>
                      {r.profile}
                    </td>
                    <td>{r.created_at}</td>
                    <td>{r.platform_source}</td>
                    <td className="pmc-ellipsis" title={r.platform_source_id}>
                      {r.platform_source_id}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}