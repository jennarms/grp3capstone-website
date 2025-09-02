import React, { useState } from "react";
import { Navbar } from "../../components/navBar";
import { HeaderButton } from "../../components/headerButton";
import { OperationsTab } from "../../components/operationsTab";
import "./vehicleTab.css";


export default function VehicleTab() {
  const [type, setType] = useState("Ferry");
  const [capacity, setCapacity] = useState("");

  const onSave = (e) => {
    e.preventDefault();
    // plug your API call here
    console.log({ type, capacity });
  };

  return (
    <>
      <Navbar />
      <HeaderButton />
      <OperationsTab/>

      <div className="ops-page">
        <div className="ops-main">
          <h2 className="ops-section">Vehicle</h2>

          <form className="vehicle-form" onSubmit={onSave}>
            <div className="form-row">
              <label htmlFor="vehType">Type of Vehicle</label>
              <select
                id="vehType"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input"
              >
                <option>Ferry</option>
                <option>Bus</option>
                <option>Tram</option>
                <option>Train</option>
              </select>
            </div>

            <div className="form-row">
              <label htmlFor="capacity">Capacity</label>
              <input
                id="capacity"
                type="number"
                min="0"
                className="input"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder=""
              />
            </div>

            <div className="form-actions">
              <button className="primary-btn" type="submit">Save</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}