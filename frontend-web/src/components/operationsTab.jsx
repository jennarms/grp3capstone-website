import { NavLink } from "react-router-dom";
import "./operationsTab.css";

export function OperationsTab() {
  const tabs = [
    { to: "/vehicle",   label: "Vehicle" },
    { to: "/stations",  label: "Stations" },
    { to: "/routes",    label: "Routes" },
    { to: "/schedules", label: "Schedules" },
    { to: "/fares",     label: "Fares" },
  ];

  return (
    <>
      <div className="ops-header">
        <h1 className="ops-title">Operations Management</h1>
        <nav className="ops-tabs" aria-label="Operations sections">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} className={({isActive}) => "ops-tab" + (isActive ? " active" : "")} end>
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="ops-header-spacer" aria-hidden="true" />
    </>
  );
}