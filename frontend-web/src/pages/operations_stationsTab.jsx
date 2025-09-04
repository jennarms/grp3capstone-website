import React, { useMemo, useState } from "react";
import { Navbar } from "../components/navBar";
import { HeaderButton } from "../components/headerButton";
import { OperationsTab } from "../components/operationsTab";
import "./operations_stationsTab.css";

export function StationsTab() {
  // demo data – replace with API data later
  const rows = useMemo(
    () => [
      { stationId: "S001", companyId: "C001", stationName: "Escolta",    email: "escolta@email",    username: "escoltastation",    password: "$2y$10$1J..." },
      { stationId: "S002", companyId: "C001", stationName: "Lawton",     email: "lawton@email",     username: "lawtonstation",     password: "$2y$10$1J..." },
      { stationId: "S003", companyId: "C001", stationName: "Quinta",     email: "quinta@email",     username: "quintastation",     password: "$2y$10a3.." },
      { stationId: "S004", companyId: "C001", stationName: "PUP",        email: "pup@email",        username: "pupstation",        password: "$2y$10$JU.." },
      { stationId: "S005", companyId: "C001", stationName: "Sta. Ana",   email: "staana@email",     username: "staanastation",     password: "$2y$10$d.."  },
      { stationId: "S006", companyId: "C001", stationName: "Lambingan",  email: "lambinga@email",   username: "lambinganstation",  password: "$2y$10$0.."  },
      { stationId: "S007", companyId: "C001", stationName: "Valenzuela", email: "valenzuela@email", username: "valenzuelastation", password: "$2y$10$p.."  },
      { stationId: "S008", companyId: "C001", stationName: "Hulo",       email: "hulo@email",       username: "hulostation",       password: "$2y$10$U.."  },
      { stationId: "S009", companyId: "C001", stationName: "Guadalupe",  email: "guadalupe@email",  username: "guadalupestation",  password: "$2y$10$V.."  },
      { stationId: "S010", companyId: "C001", stationName: "Maybunga",   email: "maybunga@email",   username: "maybungastation",   password: "$2y$10$H.."  },
    ],
    []
  );

  const [query, setQuery] = useState("");

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

  const onAdd = () => {
    // TODO: open modal or navigate to /operations/stations/add
    console.log("Add station clicked");
  };

  const onEdit = (id) => {
    // TODO: open edit modal or navigate to /operations/stations/:id/edit
    console.log("Edit", id);
  };

  const onDelete = (id) => {
    // TODO: confirm + call API
    console.log("Delete", id);
  };

  return (
    <>
      <Navbar />
      <HeaderButton />
      {/* IMPORTANT: base points tabs to /operations/... */}
      <OperationsTab base="/operations" />

      <main className="ops-stn-main">
        <section className="ops-stn-wrap">
          <h2 className="ops-stn-title">Stations</h2>

          <div className="ops-stn-toolbar">
            <label className="ops-stn-search" aria-label="Search stations">
              <svg className="ops-stn-search-ico" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
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
                  <th className="ops-stn-th-index">#</th>
                  <th>Station_ID</th>
                  <th>Company_ID</th>
                  <th>StationName</th>
                  <th>email</th>
                  <th>username</th>
                  <th>password</th>
                  <th className="ops-stn-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.stationId}>
                    <td className="ops-stn-td-index">{i + 1}</td>
                    <td>{r.stationId}</td>
                    <td>{r.companyId}</td>
                    <td>{r.stationName}</td>
                    <td className="ops-stn-clip">{r.email}</td>
                    <td className="ops-stn-clip">{r.username}</td>
                    <td className="ops-stn-clip">{r.password}</td>
                    <td className="ops-stn-actions">
                      <button
                        type="button"
                        className="ops-stn-action ops-stn-edit"
                        onClick={() => onEdit(r.stationId)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="ops-stn-action ops-stn-delete"
                        onClick={() => onDelete(r.stationId)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td className="ops-stn-empty" colSpan={8}>
                      No stations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}