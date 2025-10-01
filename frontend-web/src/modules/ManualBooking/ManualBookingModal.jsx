// src/modules/ManualBooking/ManualBookingModal.jsx
import { useEffect, useMemo, useState } from "react";
import { getFare, getNearestSchedule, toHmma, toYYYYMMDD } from "../boarding_shared.jsx";
import BookingInfo from "./BookingInfo.jsx";
import PassengerInfo from "./PassengerInfo.jsx";
import Payment from "./Payment.jsx";
import QrCode from "./QrCode.jsx";

export default function ManualBookingModal({
  open,
  onClose,
  addPassengerRow,   // function(newRow) => void
  existingRows = [],
}) {
  // multi-step manual booking: 1 Passenger, 2 Booking, 3 Payment, 4 QR
  const [step, setStep] = useState(1);

  const emptyPassenger = {
    firstName: "", lastName: "", address: "",
    profession: "", contactNumber: "", age: "",
    gender: "", platformSource: "MB",
  };
  const [passengerInfo, setPassengerInfo] = useState(emptyPassenger);

  const emptyManual = {
    bookingID: "", userID: "", qrCodeID: "",
    origin: "", destination: "",
    departureDate: "", departureTime: "",
    paymentStatus: "PG", paidAmount: "", paidAt: "",
    bookingStatus: "PE", bookingSource: "MB",
  };
  const [manualData, setManualData] = useState(emptyManual);
  const [errors, setErrors] = useState({});

  const validatePassenger = (d) => {
    const errs = {};
    const req = (k, label) => { if (!String(d[k] ?? "").trim()) errs[k] = label + " is required"; };
    req("firstName","First name"); req("lastName","Last name"); req("address","Address");
    req("profession","Profession"); req("contactNumber","Contact number"); req("age","Age");
    req("gender","Gender"); req("platformSource","Platform source");

    const digits = (d.contactNumber || "").replace(/\D/g, "");
    if (digits.length < 7) errs.contactNumber = "Enter a valid contact number";

    const ageNum = Number(d.age);
    if (isNaN(ageNum) || ageNum <= 0 || !Number.isInteger(ageNum) || ageNum > 120) errs.age = "Enter a valid age (1–120)";

    const okGenders = ["Male","Female","Other"];
    if (d.gender && okGenders.indexOf(d.gender) === -1) errs.gender = "Select Male, Female, or Other";
    if (d.platformSource !== "MB") errs.platformSource = "Platform Source must be MB";
    return errs;
  };

  const validateManual = (d) => {
    const errs = {};
    const req = (k, label) => { if (!String(d[k] ?? "").trim()) errs[k] = label + " is required"; };
    req("bookingID","Booking ID"); req("userID","User ID"); req("origin","Origin");
    req("destination","Destination"); req("departureDate","Departure date");
    req("departureTime","Departure time"); req("paidAt","Paid at");
    req("bookingStatus","Booking status"); req("bookingSource","Booking source");

    if (d.bookingID && existingRows.some((p) => p.bookingID === d.bookingID)) errs.bookingID = "Booking ID already exists";
    if (d.qrCodeID && existingRows.some((p) => p.qrCodeID === p.qrCodeID)) errs.qrCodeID = "QR Code ID already exists";

    if (d.origin && d.destination && d.origin === d.destination) errs.destination = "Destination must be different from origin";

    const dateRe = /^\d{4}[/-]\d{2}[/-]\d{2}$/;
    const timeRe = /^(1[0-2]|0?[1-9]):[0-5][0-9]\s?(am|pm)$/i;
    if (d.departureDate && !dateRe.test(d.departureDate)) errs.departureDate = "Use YYYY-MM-DD";
    if (d.departureTime && !timeRe.test(d.departureTime)) errs.departureTime = "Use h:mm am/pm";

    const okStatus = ["OB","CO","PE","CA","DI"];
    if (d.bookingStatus && okStatus.indexOf(d.bookingStatus) === -1) errs.bookingStatus = "Use OB, CO, PE, CA, or DI";
    const okSource = ["MA","MB","CB","GM"];
    if (d.bookingSource && okSource.indexOf(d.bookingSource) === -1) errs.bookingSource = "Use MA, MB, CB, GM";
    return errs;
  };

  const validatePayment = (d) => {
    const errs = {};
    const amt = Number(d.paidAmount);
    if (String(d.paidAmount).trim() === "" || isNaN(amt) || amt < 0) errs.paidAmount = "Enter a non-negative number";
    return errs;
  };

  const isManualValid = useMemo(() => Object.keys(validateManual(manualData)).length === 0, [manualData, existingRows]);

  // auto-calc fare when O/D changes
  useEffect(() => {
    if (!manualData.origin || !manualData.destination) return;
    const fare = getFare(manualData.origin, manualData.destination);
    setManualData((v)=>({ ...v, paidAmount: fare === "" ? "" : Number(fare).toFixed(2) }));
  }, [manualData.origin, manualData.destination]);

  // init when opened
  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const nearest = getNearestSchedule(now);
    setStep(1);
    setPassengerInfo((v)=>({ ...v, firstName:"", lastName:"", address:"", profession:"", contactNumber:"", age:"", gender:"", platformSource:"MB" }));
    setManualData({
      bookingID:"", userID:"", qrCodeID:"",
      origin:"", destination:"",
      departureDate: toYYYYMMDD(now),
      departureTime: nearest,
      paymentStatus: "PG", paidAmount:"", paidAt: toHmma(now),
      bookingStatus: "PE", bookingSource:"MB",
    });
    setErrors({});
  }, [open]);

  if (!open) return null;

  return (
    <div className="boarding-modal-backdrop" onClick={onClose} aria-hidden="true">
      <div className="boarding-manual-card" role="dialog" aria-modal="true" aria-labelledby="manualFormTitle" onClick={(e)=>e.stopPropagation()}>
        <h3 id="manualFormTitle" className="boarding-manual-title">Manual Booking</h3>

        {/* stepper */}
        <div className="wizard-steps wizard-steps--four">
          <div className={"wizard-step " + (step >= 1 ? "is-active" : "")}><span className="wizard-dot" /> Passenger Information</div>
          <div className={"wizard-step " + (step >= 2 ? "is-active" : "")}><span className="wizard-dot" /> Booking Information</div>
          <div className={"wizard-step " + (step >= 3 ? "is-active" : "")}><span className="wizard-dot" /> Payment</div>
          <div className={"wizard-step " + (step >= 4 ? "is-active" : "")}><span className="wizard-dot" /> QR Code</div>
        </div>

        {step === 1 && (
          <PassengerInfo
            data={passengerInfo}
            errors={errors}
            setData={setPassengerInfo}
            onNext={()=>{
              const errs = validatePassenger(passengerInfo);
              setErrors(errs);
              if (Object.keys(errs).length === 0) { setErrors({}); setStep(2); }
            }}
          />
        )}

        {step === 2 && (
          <BookingInfo
            data={manualData}
            errors={errors}
            setData={setManualData}
            isValid={isManualValid}
            onBack={()=>setStep(1)}
            onNext={()=>{
              const errs = validateManual(manualData);
              setErrors(errs);
              if (Object.keys(errs).length === 0) { setErrors({}); setStep(3); }
            }}
          />
        )}

        {step === 3 && (
          <Payment
            data={manualData}
            onBack={()=>setStep(2)}
            onPaid={()=>{
              const errs = validatePayment(manualData);
              setErrors(errs);
              if (Object.keys(errs).length > 0) return;
              // mark paid + time
              setManualData((v)=>({ ...v, paymentStatus:"P", paidAt: toHmma(new Date()), qrCodeID: v.qrCodeID || generateUniqueQR(existingRows) }));
              setErrors({});
              setStep(4);
            }}
          />
        )}

        {step === 4 && (
          <QrCode
            passengerInfo={passengerInfo}
            data={manualData}
            onBack={()=>setStep(3)}
            onFinish={()=>{
              const newRow = {
                ...manualData,
                paidAmount: Number(manualData.paidAmount || 0),
                departureDate: (manualData.departureDate || "").replace(/-/g, "/"),
                bookingSource: "MB",
                bookingStatus: "PE",
                paymentStatus: manualData.paymentStatus || "PG",
                userID: manualData.userID,
              };
              addPassengerRow?.(newRow);
              onClose?.();
            }}
          />
        )}
      </div>
    </div>
  );
}

function generateUniqueQR(existing) {
  const exists = (code) => existing.some((p) => p.qrCodeID === code);
  let code = "";
  do { code = "TC" + Math.floor(10000 + Math.random() * 89999); } while (exists(code));
  return code;
}
