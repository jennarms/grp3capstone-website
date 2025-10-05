import axios from "axios"; // Axios for making API calls
import { useEffect, useMemo, useState } from "react";
import { getFare, getNearestSchedule, toHmma, toYYYYMMDD } from "../boarding_shared.jsx";
import BookingInfo from "./BookingInfo.jsx";
import PassengerInfo from "./PassengerInfo.jsx";
import Payment from "./Payment.jsx";
import QrCode from "./QrCode.jsx";

// API URL from environment variable
const apiUrl = import.meta.env.VITE_API_URL;
console.log("API URL from env:", apiUrl);

export default function ManualBookingModal({
  open,
  onClose,
  addPassengerRow,   // function(newRow) => void
}) {
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

  // Validation functions for passenger, manual, and payment
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

  const validateManual = (d) => {
    const errs = {};
    const req = (k, label) => { if (!String(d[k] ?? "").trim()) errs[k] = label + " is required"; };
    req("origin", "Origin");
    req("destination", "Destination");
    req("departureDate", "Departure date");
    req("departureTime", "Departure time");

    if (d.origin && d.destination && d.origin === d.destination) errs.destination = "Destination must be different from origin";

    const dateRe = /^\d{4}[/-]\d{2}[/-]\d{2}$/;
    const timeRe = /^(1[0-2]|0?[1-9]):[0-5][0-9]\s?(am|pm)$/i;
    if (d.departureDate && !dateRe.test(d.departureDate)) errs.departureDate = "Use YYYY-MM-DD";
    if (d.departureTime && !timeRe.test(d.departureTime)) errs.departureTime = "Use h:mm am/pm";

    return errs;
  };

  const validatePayment = (d) => {
    const errs = {};
    const amt = Number(d.paidAmount);
    if (String(d.paidAmount).trim() === "" || isNaN(amt) || amt < 0) errs.paidAmount = "Enter a non-negative number";
    return errs;
  };

  const isManualValid = useMemo(() => {
    return Object.keys(validateManual(manualData)).length === 0;
  }, [manualData]);

  // Auto-calculate fare when Origin/Destination changes
  useEffect(() => {
    if (!manualData.origin || !manualData.destination) return;
    const fare = getFare(manualData.origin, manualData.destination);
    setManualData((v) => ({ ...v, paidAmount: fare === "" ? "" : Number(fare).toFixed(2) }));
  }, [manualData.origin, manualData.destination]);

  // Set origin based on Station Name from localStorage when modal is opened
  useEffect(() => {
    if (!open) return;

    const stationName = localStorage.getItem("StationName");
    const now = new Date();
    const nearest = getNearestSchedule(now);

    const userID = localStorage.getItem("userID");

    setManualData({
      bookingID: "",
      userID: userID || "",
      qrCodeID: "",
      origin: stationName || "",
      destination: "",
      departureDate: toYYYYMMDD(now),
      departureTime: nearest,
      paymentStatus: "NP",
      paidAmount: "",
      paidAt: toHmma(now),
      bookingStatus: "PE",
      bookingSource: "MA",
    });

    setErrors({});
  }, [open]);

  // Function to check if the QR code exists
  const checkIfQRCodeExists = async (code) => {
    try {
      const response = await axios.post(`${apiUrl}/api/boarding/manual/check_qr_exists`, { qr_code: code });
      return response.data.exists; // returns true or false
    } catch (error) {
      console.error("Error checking QR code existence:", error);
      return false;
    }
  };

  // Function to generate a unique QR code
  const generateUniqueQR = async () => {
    let code = "TC" + Math.floor(10000 + Math.random() * 89999);  // Generate random 5 digit code
    const isUnique = await checkIfQRCodeExists(code); // Check uniqueness via backend
    if (isUnique) {
      return generateUniqueQR(); // Recursive call if QR exists
    }
    return code; // Return unique QR code
  };

  // Save the booking and user data (including payment and QR code)
  const saveBookingData = async () => {
    try {
      // Register user if not exists
      const userResponse = await axios.post(`${apiUrl}/api/boarding/manual/register_user`, passengerInfo);
      const userID = userResponse.data.user_id;

      // Save booking details
      const bookingResponse = await axios.post(`${apiUrl}/api/boarding/manual/create_booking`, {
        user_id: userID,
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

  // Handle Payment (update status, generate QR)
  const handlePayment = async () => {
    const errs = validatePayment(manualData);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Generate unique QR Code for the payment
    const uniqueQRCode = await generateUniqueQR(); // Ensure QR code is unique
    setManualData((v) => ({
      ...v,
      paymentStatus: "P", // Mark as Paid
      paidAt: toHmma(new Date()),
      qrCodeID: uniqueQRCode, // Set generated unique QR code ID
    }));

    // Save all the data after payment is completed
    await saveBookingData();

    setErrors({});
    setStep(4);  // Move to the next step (QR Code)
  };

  // Handle next step
  const handleNext = () => {
    const errs = validateManual(manualData);
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
