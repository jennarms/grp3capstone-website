// src/modules/ManualBooking/BookingInfo.jsx
import { DEPARTURE_SCHEDULES, STATIONS, getFare } from "../boarding_shared.jsx";

export default function BookingInfo({ data, errors, setData, isValid, onBack, onNext }) {
  return (
    <div className="boarding-manual-section">
      <h4 className="boarding-manual-subtitle">Booking Information</h4>
      <p className="boarding-manual-desc">Please present passenger’s ID for manual confirmation.</p>

      <div className="boarding-manual-grid">
        <Field label="Booking ID" value={data.bookingID} onChange={(v)=>setData((s)=>({...s, bookingID:v}))} error={errors.bookingID}/>
        <Field label="User ID"    value={data.userID}    onChange={(v)=>setData((s)=>({...s, userID:v}))}    error={errors.userID}/>
        <Field label="QR Code ID (optional)" value={data.qrCodeID} onChange={(v)=>setData((s)=>({...s, qrCodeID:v}))} error={errors.qrCodeID}/>

        <Select
          span2
          label="Origin"
          value={data.origin}
          onChange={(origin)=>{
            const next = { ...data, origin, destination: data.destination === origin ? "" : data.destination };
            const fare = getFare(origin, next.destination);
            setData({ ...next, paidAmount: fare === "" ? "" : Number(fare).toFixed(2) });
          }}
          options={STATIONS}
          error={errors.origin}
        />

        <Select
          label="Destination"
          value={data.destination}
          onChange={(destination)=>{
            const fare = getFare(data.origin, destination);
            setData((s)=>({ ...s, destination, paidAmount: fare === "" ? "" : Number(fare).toFixed(2) }));
          }}
          options={STATIONS.filter((s)=> s !== data.origin)}
          error={errors.destination}
        />

        <DateField label="Departure Date" value={data.departureDate} onChange={(v)=>setData((s)=>({...s, departureDate:v}))} error={errors.departureDate} span2/>
        <Select label="Departure Time" value={data.departureTime} onChange={(v)=>setData((s)=>({...s, departureTime:v}))} options={DEPARTURE_SCHEDULES} error={errors.departureTime}/>
        <Field  label="Paid At" value={data.paidAt} onChange={(v)=>setData((s)=>({...s, paidAt:v}))} error={errors.paidAt}/>
        <Field  span2 label="Booking Status" value={data.bookingStatus} onChange={()=>{}} error={errors.bookingStatus} readOnly/>
        <Field  label="Booking Source" value={data.bookingSource} onChange={()=>{}} error={errors.bookingSource} readOnly/>
      </div>

      <div className="wizard-actions-split">
        <button className="boarding-modal-btn boarding-modal-cancel" onClick={onBack}>Back</button>
        <button className="boarding-manual-next" onClick={onNext} aria-disabled={!isValid} title={!isValid ? "Fill all fields correctly to continue" : "Next"}>Next</button>
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
          onChange={(e)=>onChange(e.target.value)}
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
          onChange={(e)=>onChange(e.target.value)}
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
          onChange={(e)=>onChange(e.target.value)}
        >
          <option value="" disabled>Select {label}</option>
          {options.map((o)=> <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
      {error && <div className="boarding-error-text">{error}</div>}
    </div>
  );
}
