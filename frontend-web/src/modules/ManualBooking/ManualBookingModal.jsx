import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import BookingInfo from "./BookingInfo.jsx";
import PassengerInfo from "./PassengerInfo.jsx";
import Payment from "./Payment.jsx";
import QrCode from "./QrCode.jsx";

// API URL from environment variable
const apiUrl = import.meta.env.VITE_API_URL;

export default function ManualBookingModal({ open, onClose, addPassengerRow }) {
  const [step, setStep] = useState(1);
  const [manualData, setManualData] = useState({
    bookingID: "", userID: "", qrCodeID: "",
    origin: "", destination: "", departureDate: "", departureTime: "",
    paymentStatus: "NP", paidAmount: "", paidAt: "",
    bookingStatus: "PE", bookingSource: "MA",
  });
  const [passengerInfo, setPassengerInfo] = useState({
    firstName: "", lastName: "", address: "",
    profession: "", contactNumber: "", age: "",
    gender: "", platformSource: "MA",
  });
  const [errors, setErrors] = useState({});
  const [stations, setStations] = useState([]);  // Stations state
  const [schedules, setSchedules] = useState([]);  // Schedules state

  // Fetch stations and departure schedules
  useEffect(() => {
    axios.get(`${apiUrl}/api/boarding/manual/get_stations`)
      .then(response => {
        setStations(response.data.stations);  // Set stations data
      })
      .catch(error => {
        console.error("Error fetching stations:", error);
      });

    axios.get(`${apiUrl}/api/boarding/manual/get_departure_schedules`)
      .then(response => {
        setSchedules(response.data.schedules);  // Set schedules data
      })
      .catch(error => {
        console.error("Error fetching schedules:", error);
      });
  }, []);

  // Handle fare calculation
  useEffect(() => {
    if (!manualData.origin || !manualData.destination) return;
    const fare = getFare(manualData.origin, manualData.destination);
    setManualData((v) => ({ ...v, paidAmount: fare === "" ? "" : Number(fare).toFixed(2) }));
  }, [manualData.origin, manualData.destination]);

  // Validation functions
  const validatePassenger = (d) => {
    const errs = {};
    const req = (k, label) => { if (!String(d[k] ?? "").trim()) errs[k] = label + " is required"; };
    req("firstName", "First name"); req("lastName", "Last name"); req("address", "Address");
    req("profession", "Profession"); req("contactNumber", "Contact number"); req("age", "Age");
    req("gender", "Gender"); req("platformSource", "Platform source");

    const digits = (d.contactNumber || "").replace(/\D/g, "");
    if (digits.length < 7) errs.contactNumber = "Enter a valid contact number";

    const ageNum = Number(d.age);
    if (isNaN(ageNum) || ageNum <= 0 || !Number.isInteger(ageNum) || ageNum > 120) errs.age = "Enter a valid age (1–120)";

    const okGenders = ["Male", "Female", "Other"];
    if (d.gender && okGenders.indexOf(d.gender) === -1) errs.gender = "Select Male, Female, or Other";
    if (d.platformSource !== "MA") errs.platformSource = "Platform Source must be MA";
    return errs;
  };

  const isManualValid = useMemo(() => {
    return Object.keys(validatePassenger(passengerInfo)).length === 0;
  }, [passengerInfo]);

  // Auto-calculate fare when Origin/Destination changes
  const getFare = async (origin, destination) => {
    try {
      const response = await axios.get(`${apiUrl}/api/boarding/manual/get_fare`, {
        params: { origin, destination }
      });
      return response.data.fare;
    } catch (error) {
      console.error("Error fetching fare:", error);
      return "";
    }
  };

  const saveBookingData = async () => {
    console.log("Passenger Info:", passengerInfo);  // Debugging line

    try {
      // Register user if not exists
      const userResponse = await axios.post(`${apiUrl}/api/boarding/manual/register_user`, passengerInfo);
      const userID = userResponse.data.user_id;

      // Save booking details
      const bookingResponse = await axios.post(`${apiUrl}/api/boarding/manual/create_booking`, {
        user_id: userID, // Ensure user ID is passed correctly
        origin: manualData.origin,
        destination: manualData.destination,
        departure_date: manualData.departureDate,
        departure_time: manualData.departureTime,
      });

      const bookingID = bookingResponse.data.booking_id;

      // Update payment status
      await axios.post(`${apiUrl}/api/boarding/manual/update_payment`, {
        booking_id: bookingID,
        paid_amount: manualData.paidAmount,
      });

      // Generate QR code
      await axios.post(`${apiUrl}/api/boarding/manual/generate_qr`, { booking_id: bookingID });

      console.log("Booking data saved successfully.");
    } catch (error) {
      console.error("Error saving booking data:", error);
    }
  };

  const handlePayment = async () => {
    const errs = validatePassenger(passengerInfo);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    await saveBookingData();  // Save all data after payment is completed
    setStep(4);  // Move to next step (QR Code)
  };

  const handleNext = () => {
    const errs = validatePassenger(passengerInfo);
    setErrors(errs);
    if (Object.keys(errs).length === 0) {
      setStep(3); // Move to the next step
    }
  };

  // Prevent rendering if modal is closed
  if (!open) return null;

  return (
    <div className="boarding-modal-backdrop" onClick={onClose} aria-hidden="true">
      <div className="boarding-manual-card" role="dialog" aria-modal="true" aria-labelledby="manualFormTitle" onClick={(e) => e.stopPropagation()}>
        <h3 id="manualFormTitle" className="boarding-manual-title">Manual Booking</h3>

        {/* Stepper */}
        <div className="wizard-steps wizard-steps--four">
          <div className={"wizard-step " + (step >= 1 ? "is-active" : "")}><span className="wizard-dot" /> Passenger Information</div>
          <div className={"wizard-step " + (step >= 2 ? "is-active" : "")}><span className="wizard-dot" /> Booking Information</div>
          <div className={"wizard-step " + (step >= 3 ? "is-active" : "")}><span className="wizard-dot" /> Payment</div>
          <div className={"wizard-step " + (step >= 4 ? "is-active" : "")}><span className="wizard-dot" /> QR Code</div>
        </div>

        {/* Step 1: Passenger Info */}
        {step === 1 && (
          <PassengerInfo
            data={passengerInfo}
            errors={errors}
            setData={setPassengerInfo}
            onNext={() => {
              const errs = validatePassenger(passengerInfo);
              setErrors(errs);
              if (Object.keys(errs).length === 0) { setStep(2); }
            }}
          />
        )}

        {/* Step 2: Booking Info */}
        {step === 2 && (
          <BookingInfo
            data={manualData}
            errors={errors}
            setData={setManualData}
            isValid={isManualValid}
            onBack={() => setStep(1)}
            onNext={handleNext}  // Trigger the payment handler
            stations={stations}  // Pass stations to BookingInfo
            schedules={schedules}  // Pass schedules to BookingInfo
          />
        )}

        {/* Step 3: Payment Info */}
        {step === 3 && (
          <Payment
            data={manualData}
            onBack={() => setStep(2)}
            onPaid={handlePayment}  // Trigger the payment handler here
          />
        )}

        {/* Step 4: QR Code */}
        {step === 4 && (
          <QrCode
            passengerInfo={passengerInfo}  // Pass the full passengerInfo object here
            data={manualData}
            onBack={() => setStep(3)}
            onFinish={() => {
              addPassengerRow(manualData);
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}
