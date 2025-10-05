
export default function Payment({ data, onBack, onPaid }) {
  return (
    <div className="boarding-manual-section">
      <h4 className="boarding-manual-subtitle">Payment</h4>
      <p className="boarding-manual-desc">The fare is automatically calculated from origin/destination.</p>

      <div
        style={{
          border: "2px solid #111",
          borderRadius: 10,
          padding: "18px 22px",
          background: "#fff",
          textAlign: "center",
          marginTop: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 16, color: "#374151", fontWeight: 700 }}>Total Amount</div>
        <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.1 }}>
          ₱ {data.paidAmount || "0.00"}
        </div>
      </div>

      <div className="wizard-actions-split">
        <button className="boarding-modal-btn boarding-modal-cancel" onClick={onBack}>Back</button>
        <button 
          className="boarding-manual-next" 
          onClick={() => {
            console.log("Received Payment Button Clicked");  // Debugging log for button click
            onPaid(data.paidAmount);  // Trigger the onPaid function
          }} 
          title="Received Payment"
        >
          Received Payment
        </button>
      </div>
    </div>
  );
}
