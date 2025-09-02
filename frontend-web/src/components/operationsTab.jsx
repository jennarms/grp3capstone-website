import { NavLink } from "react-router-dom";
import "./operationsTab.css";

export function OperationsTab({ base = "" }) {
  const tabs = [
    { to: "/vehicle", label: "Vehicle" },
    { to: "/stations", label: "Stations" },
    { to: "/routes", label: "Routes" },
    { to: "/schedules", label: "Schedules" },
    { to: "/fares", label: "Fares" },
  ];

  return (
    <div className="ops-tabs-wrap">
      <h1 className="ops-title">Operations Management</h1>

      <div className="ops-tabs">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={`${base}${t.to}`}
            className={({ isActive }) => "ops-tab" + (isActive ? " active" : "")}
            end
          >
            {t.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}