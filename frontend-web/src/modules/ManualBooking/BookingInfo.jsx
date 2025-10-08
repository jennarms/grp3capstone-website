import axios from "axios";
import { useCallback, useEffect, useState } from "react";

// Updated for dynamic handling of origin and destination
export default function BookingInfo({ data, errors, setData, isValid, onBack, onNext }) {
  const [stations, setStations] = useState([]);  // Stations state
  const [departureSchedules, setDepartureSchedules] = useState([]);  // Schedules state

  useEffect(() => {
    // Fetch available stations and departure schedules
    axios.get(`${import.meta.env.VITE_API_URL}/api/boarding/manual/get_stations`)
      .then(response => {
        setStations(response.data.stations);  // Set stations data
      })
      .catch(error => {
        console.error("Error fetching stations:", error);
      });

    axios.get(`${import.meta.env.VITE_API_URL}/api/boarding/manual/get_departure_schedules`)
      .then(response => {
        setDepartureSchedules(response.data.schedules);  // Set schedules data
      })
      .catch(error => {
        console.error("Error fetching departure schedules:", error);
      });
  }, []);

  // Memoized getFare function
  const getFare = useCallback(async (origin, destination) => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/boarding/manual/get_fare`, {
        params: { origin, destination }
      });
      setData(prevData => ({
        ...prevData,
        paidAmount: response.data.fare || "",
      }));
    } catch (error) {
      console.error("Error fetching fare:", error);
    }
  }, []); // Memoize the function

useEffect(() => {
  if (data.origin && data.destination) {
    // Ensure origin and destination are provided before making the request
    axios.get(`${import.meta.env.VITE_API_URL}/api/boarding/manual/get_departure_schedules`, {
      params: { origin: data.origin, destination: data.destination }  // Pass the origin and destination parameters
    })
      .then(response => {
        setDepartureSchedules(response.data.schedules);  // Set schedules data
      })
      .catch(error => {
        console.error("Error fetching schedules:", error.response || error);
      });
  } else {
    console.error("Origin and destination are required");
  }
}, [data.origin, data.destination]);


  return (
    <div className="boarding-manual-section">
      <h4 className="boarding-manual-subtitle">Booking Information</h4>
      <p className="boarding-manual-desc">Please select the booking details.</p>

      <div className="boarding-manual-grid">
        {/* Origin */}
        <div className="boarding-field">
          <label className="boarding-field-label">Origin</label>
          <input
            className="boarding-manual-input"
            value={data.origin || 'Loading...'}
            readOnly
          />
        </div>

        {/* Destination */}
        <Select
          label="Destination"
          value={data.destination}
          onChange={(destination) => {
            setData((s) => ({ ...s, destination }));
            getFare(data.origin, destination);
          }}
          options={stations.filter(station => station.StationName !== data.origin).map(station => station.StationName)} // Access the correct property
          error={errors.destination}
        />

        {/* Departure Date */}
        <DateField
          label="Departure Date"
          value={data.departureDate}
          onChange={(v) => setData((s) => ({ ...s, departureDate: v }))}
          error={errors.departureDate}
        />

        {/* Departure Time */}
        <Select
          label="Departure Time"
          value={data.departureTime}
          onChange={(v) => setData((s) => ({ ...s, departureTime: v }))}
          options={departureSchedules}
          error={errors.departureTime}
        />
      </div>

      <div className="wizard-actions-split">
        <button className="boarding-modal-btn boarding-modal-cancel" onClick={onBack}>Back</button>
        <button className="boarding-manual-next" onClick={onNext} disabled={!isValid}>Next</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, error, readOnly, span2 }) {
  return (
    <div className={span2 ? "boarding-manual-span2" : ""}>
      <div className="boarding-field">
        <label className="boarding-field-label">{label}</label>
        <input
          className={"boarding-manual-input " + (error ? "boarding-field-error" : "")}
          placeholder={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
        />
      </div>
      {error && <div className="boarding-error-text">{error}</div>}
    </div>
  );
}

function DateField({ label, value, onChange, error, span2 }) {
  return (
    <div className={span2 ? "boarding-manual-span2" : ""}>
      <div className="boarding-field">
        <label className="boarding-field-label">{label}</label>
        <input
          type="date"
          className={"boarding-manual-input boarding-manual-date " + (error ? "boarding-field-error" : "")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {error && <div className="boarding-error-text">{error}</div>}
    </div>
  );
}

function Select({ label, value, onChange, error, options, span2 }) {
  return (
    <div className={span2 ? "boarding-manual-span2" : ""}>
      <div className="boarding-field">
        <label className="boarding-field-label">{label}</label>
        <select
          className={"boarding-manual-input boarding-manual-select " + (error ? "boarding-field-error" : "")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>Select {label}</option>
          {options.map((o, index) => <option key={index} value={o}>{o}</option>)}
        </select>
      </div>
      {error && <div className="boarding-error-text">{error}</div>}
    </div>
  );
}
