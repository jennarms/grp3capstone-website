export default function PassengerInfo({ data, errors, setData, onNext }) {
  return (
    <div className="boarding-manual-section">
      <h4 className="boarding-manual-subtitle">Passenger Information</h4>
      <p className="boarding-manual-desc">Please enter the passenger’s details. All fields are required except for the email.</p>

      <div className="boarding-manual-grid">
        {/* First Name */}
        <Field 
          label="First Name" 
          value={data.firstName} 
          onChange={(v) => setData((s) => ({ ...s, firstName: v }))} 
          error={errors.firstName} 
        />
        
        {/* Last Name */}
        <Field 
          label="Last Name"  
          value={data.lastName}  
          onChange={(v) => setData((s) => ({ ...s, lastName: v }))}  
          error={errors.lastName} 
        />
        
        {/* Profession */}
        <Field 
          label="Profession" 
          value={data.profession} 
          onChange={(v) => setData((s) => ({ ...s, profession: v }))} 
          error={errors.profession} 
        />
        
        {/* Address */}
        <Field 
          label="Address"    
          value={data.address}    
          onChange={(v) => setData((s) => ({ ...s, address: v }))}    
          error={errors.address} 
          span2
        />

        {/* Contact Number */}
        <Field 
          label="Contact Number" 
          value={data.contactNumber} 
          onChange={(v) => setData((s) => ({ ...s, contactNumber: v }))} 
          error={errors.contactNumber}
        />
        
        {/* Age */}
        <Field 
          label="Age" 
          value={data.age} 
          onChange={(v) => {
            const age = Number(v);
            if (isNaN(age) || age <= 0 || age > 120) {
              setData((s) => ({ ...s, age: "" }));
              errors.age = "Enter a valid age (1–120)";
            } else {
              setData((s) => ({ ...s, age }));
            }
          }} 
          error={errors.age}
        />
        
        {/* Gender */}
        <Select
          label="Gender"
          value={data.gender}
          onChange={(v) => setData((s) => ({ ...s, gender: v }))} 
          error={errors.gender}
          options={["Male", "Female", "Other"]}
        />

        {/* Email (Optional) */}
        <Field 
          label="Email" 
          value={data.email} 
          onChange={(v) => setData((s) => ({ ...s, email: v }))} 
          error={errors.email}
        />
      </div>

      {/* Hidden Field for platformSource */}
      <input
        type="hidden"
        value="M"
        onChange={() => {}}
        readOnly
      />

      <div className="boarding-manual-actions">
        <button className="boarding-manual-next" onClick={onNext} title="Next">Next</button>
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

function Select({ label, value, onChange, error, options }) {
  return (
    <div>
      <div className="boarding-field">
        <label className="boarding-field-label">{label}</label>
        <select
          className={"boarding-manual-input boarding-manual-select " + (error ? "boarding-field-error" : "")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>Select {label}</option>
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      </div>
      {error && <div className="boarding-error-text">{error}</div>}
    </div>
  );
}
