import { useState } from "react";

export default function Payment({ data, onBack, onPaid }) {
  const [loading, setLoading] = useState(false);  // State to track loading status

  // Function to handle the "Received Payment" button click
  const handlePayment = async () => {
    setLoading(true);  // Set loading to true when payment process starts
    try {
      console.log("Received Payment Button Clicked"); // Debugging log for button click
      await onPaid(data.paidAmount); // Trigger the onPaid function (assuming it's async)
    } catch (error) {
      console.error("Payment failed", error);
    } finally {
      setLoading(false); // Reset loading state after payment is processed
    }
  };

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
        <button className="boarding-modal-btn boarding-modal-cancel" onClick={onBack}>
          Back
        </button>
        
        {/* Received Payment Button */}
        <button 
          className="boarding-manual-next" 
          onClick={handlePayment} // Use the handlePayment function
          title="Received Payment"
          disabled={loading} // Disable the button when loading
        >
          {loading ? (
            <span>Processing...</span> // Show "Processing..." when loading
          ) : (
            "Received Payment"
          )}
        </button>
      </div>

      {/* Optionally, you can show a loading spinner here */}
      {loading && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <div className="spinner"></div> {/* You can replace this with a spinner component */}
          <p>Saving payment...</p>
        </div>
      )}
    </div>
  );
}
