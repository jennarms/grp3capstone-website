import React, { useState } from "react";
import { Navbar } from "../components/navBar";  // Assuming you have Navbar component
import { HeaderButton } from "../components/headerButton";  // Assuming you have HeaderButton component
import { OperationsTab } from "../components/operationsTab";  // Assuming you have OperationsTab component
import "./operations_faresTab.css";  // The relevant CSS file for fare tab

export default function FareTab() {
  const [selectedRoute, setSelectedRoute] = useState("Escolta-Pinagbuhatan");
  const [fares, setFares] = useState({
    routes: [
      "Escolta-Pinagbuhatan", "Kalawaan", "San Joaquin", "Maybunga", "Guadalupe", "Hulo", "Valenzuela", "Lambingan", "Sta. Ana", "PUP", "Quinta", "Lawton"
    ],
    fareData: [
      [18.00, 28.00, 43.00, 45.00, 50.00, 55.00, 60.00, 65.00, 95.00],
      [18.00, 15.00, 30.00, 25.00, 30.00, 35.00, 40.00, 45.00, 75.00],
      [43.00, 30.00, 15.00, 30.00, 30.00, 45.00, 50.00, 55.00, 80.00],
      // Add more rows here for each route
    ]
  });

  // Function to handle fare edit
  const handleFareChange = (rowIndex, colIndex, value) => {
    const updatedFares = [...fares.fareData];
    updatedFares[rowIndex][colIndex] = value;
    setFares({ ...fares, fareData: updatedFares });
  };

  // Handle save or implement action
  const onSave = () => {
    // This is where you'd plug in your API call or logic to save the data
    console.log("Fares saved:", fares.fareData);
  };

  return (
    <>
      <Navbar />
      <HeaderButton />
      <OperationsTab />

      <div className="fare-tab-page">
        <div className="fare-tab-main">
          <h2 className="fare-tab-section">Fare</h2>

          <div className="fare-select-route">
            <label>Select Route</label>
            <select
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              className="fare-select-input"
            >
              {fares.routes.map((route, index) => (
                <option key={index} value={route}>
                  {route}
                </option>
              ))}
            </select>
          </div>

          <div className="fare-tab-table">
            <table>
              <thead>
                <tr>
                  <th>Route</th>
                  {fares.routes.map((route, index) => (
                    <th key={index}>{route}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fares.fareData.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td>{fares.routes[rowIndex]}</td>
                    {row.map((fare, colIndex) => (
                      <td key={colIndex}>
                        <input
                          type="number"
                          className="fare-input"
                          value={fare}
                          onChange={(e) => handleFareChange(rowIndex, colIndex, parseFloat(e.target.value))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="fare-tab-buttons">
            <button className="fare-implement-btn" onClick={onSave}>
              Implement
            </button>
            <button className="fare-save-btn" onClick={onSave}>
              Save a Copy
            </button>
          </div>
        </div>
      </div>
    </>
  );
}