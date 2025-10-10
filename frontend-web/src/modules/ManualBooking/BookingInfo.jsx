import axios from "axios";
import { useCallback, useEffect, useState } from "react";

// Select Component (Dropdown)
const Select = ({ label, value, onChange, error, options, span2 }) => {
  return (
    <div className={span2 ? "boarding-manual-span2" : ""}>
      <div className="boarding-field">
        <label className="boarding-field-label">{label}</label>
        <select
          className={`boarding-manual-input boarding-manual-select ${error ? "boarding-field-error" : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            Select {label}
          </option>
          {options.map((o, index) => (
            <option key={index} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>
      {error && <div className="boarding-error-text">{error}</div>}
    </div>
  );
};

// DateField Component (Date Picker)
const DateField = ({ label, value, onChange, error, span2 }) => {
  return (
    <div className={span2 ? "boarding-manual-span2" : ""}>
      <div className="boarding-field">
        <label className="boarding-field-label">{label}</label>
        <input
          type="date"
          className={`boarding-manual-input boarding-manual-date ${error ? "boarding-field-error" : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {error && <div className="boarding-error-text">{error}</div>}
    </div>
  );
};

export default function BookingInfo({
  data,
  errors,
  setData,
  isValid,
  onBack,
  onNext,
}) {
  const [stations, setStations] = useState([]); // Stations state
  const [departureSchedules, setDepartureSchedules] = useState([]); // Schedules state
  const [dateError, setDateError] = useState("");  // State to store date-related error (Sunday)

  // Fetch stations and departure schedules
  useEffect(() => {
    const storedOrigin = localStorage.getItem("origin_station");
    if (storedOrigin) {
      setData((prevData) => ({ ...prevData, origin: storedOrigin }));
    }

    // Fetch stations
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/boarding/manual/get_stations`)
      .then((response) => {
        setStations(response.data.stations);
      })
      .catch((error) => {
        console.error("Error fetching stations:", error);
      });
  }, [setData]);

  // Memoized getFare function with better validation
  const getFare = useCallback(async (origin, destination) => {
    // Check if both origin and destination are valid before making the request
    if (!origin || !destination) {
      console.error("Origin or destination is missing!");
      return;
    }

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/boarding/manual/get_fare`,
        {
          params: { origin, destination },
        }
      );
      
      // Handle successful response
      if (response.data.fare) {
        setData((prevData) => ({
          ...prevData,
          paidAmount: response.data.fare, // Assign the fetched fare to paidAmount
        }));
      } else {
        console.error("Fare data not found in the response.");
        setData((prevData) => ({
          ...prevData,
          paidAmount: "0.00", // Set to 0 if no fare found
        }));
      }
    } catch (error) {
      console.error("Error fetching fare:", error);
      // Handle error gracefully and set paidAmount to 0
      setData((prevData) => ({
        ...prevData,
        paidAmount: "0.00",
      }));
    }
  }, [setData]);

  // Fetch schedules based on origin and destination
  useEffect(() => {
    if (data.origin && data.destination) {
      axios
        .get(`${import.meta.env.VITE_API_URL}/api/boarding/manual/get_departure_schedules`, {
          params: { origin: data.origin, destination: data.destination },
        })
        .then((response) => {
          const schedules = response.data.schedules || [];
          if (schedules.length === 0) {
            schedules.push("No schedules available");
          }
          setDepartureSchedules(schedules);
        })
        .catch((error) => {
          console.error("Error fetching schedules:", error);
          if (error.response && error.response.status === 400) {
            alert("Invalid origin or destination. Please check your selections.");
          } else if (error.response && error.response.status === 404) {
            alert("No schedules found for this route.");
          } else {
            alert("Error fetching schedules. Please try again.");
          }
        });
    } else {
      console.error("Origin and destination are required");
    }
  }, [data.origin, data.destination]);

  // Handle Departure Date change and check if it's a Sunday
  const handleDepartureDateChange = (date) => {
    setData((prevData) => ({ ...prevData, departureDate: date }));

    // Check if the selected date is a Sunday (0 represents Sunday in JavaScript Date object)
    const selectedDate = new Date(date);
    if (selectedDate.getDay() === 0) {
      setDateError("Booking is not allowed on Sundays.");
    } else {
      setDateError(""); // Clear error if it's not Sunday
    }
  };

  return (
    <div className="boarding-manual-section">
      <h4 className="boarding-manual-subtitle">Booking Information</h4>
      <p className="boarding-manual-desc">Please select the booking details.</p>

      <div className="boarding-manual-grid">
        {/* Origin Field */}
        <Select
          label="Origin"
          value={data.origin}
          onChange={(origin) => {
            setData((s) => ({ ...s, origin }));
            getFare(origin, data.destination); // Fetch fare when origin changes
          }}
          options={stations.map((station) => station.StationName)}
          error={errors.origin}
        />

        {/* Destination Field */}
        <Select
          label="Destination"
          value={data.destination}
          onChange={(destination) => {
            setData((s) => ({ ...s, destination }));
            getFare(data.origin, destination); // Fetch fare when destination changes
          }}
          options={stations
            .filter((station) => station.StationName !== data.origin)
            .map((station) => station.StationName)}
          error={errors.destination}
        />

        {/* Departure Date Field */}
        <DateField
          label="Departure Date"
          value={data.departureDate}
          onChange={handleDepartureDateChange}  // Use the new handler for date change
          error={errors.departureDate || dateError}  // Show Sunday warning error
        />

        {/* Departure Time Field */}
        <Select
          label="Departure Time"
          value={data.departureTime}
          onChange={(v) => setData((s) => ({ ...s, departureTime: v }))} 
          options={departureSchedules}
          error={errors.departureTime}
        />
      </div>

      <div className="wizard-actions-split">
        <button className="boarding-modal-btn boarding-modal-cancel" onClick={onBack}>
          Back
        </button>
        <button
          className="boarding-manual-next"
          onClick={onNext}
          disabled={!isValid || dateError}  // Disable if there's a Sunday warning
        >
          Next
        </button>
      </div>
    </div>
  );
}
