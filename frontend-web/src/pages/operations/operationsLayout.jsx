import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import "./operationsLayout.css";

export function OperationsLayout() {
  return (
    <div className="ops-page">
      <div className="ops-main">
        <h1 className="ops-title">Operations Management</h1>

        <div className="ops-tabs">
          <NavLink to="vehicle" className="ops-tab">Vehicle</NavLink>
          <NavLink to="stations" className="ops-tab">Stations</NavLink>
          <NavLink to="routes" className="ops-tab">Routes</NavLink>
          <NavLink to="schedules" className="ops-tab">Schedules</NavLink>
          <NavLink to="fares" className="ops-tab">Fares</NavLink>
        </div>

        <div className="ops-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}