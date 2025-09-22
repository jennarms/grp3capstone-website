import { useEffect, useRef, useState } from "react";
import { HeaderButton } from "../components/headerButton";
import { Navbar } from "../components/navBar";
import "./uiCustomization.css";

const apiUrl = import.meta.env.VITE_API_URL;

/** Color picker component with predefined swatches and custom RGB picker */
function ColorPicker({ label, value, onChange, name }) {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customColor, setCustomColor] = useState(value || "#0B1A78");

  const predefinedColors = [
    "#0B1A78", "#1BC882", "#FFB020", "#E66C6C",
    "#8C54FF", "#2196F3", "#FF5722", "#4CAF50",
    "#9C27B0", "#795548", "#3fe19b", "#3c65e6"
  ];

  const handleColorChange = (color) => onChange(name, color);

  const handleCustomColorChange = (e) => {
    const color = e.target.value;
    setCustomColor(color);
    handleColorChange(color);
  };

  return (
    <div className="color-picker-container">
      <label className="ui-field-label">{label}</label>

      {/* Predefined Color Swatches */}
      <div className="ui-swatches">
        {predefinedColors.map((color) => (
          <label key={color} className="ui-swatch" style={{ background: color }}>
            <input
              type="radio"
              name={`${name}-preset`}
              value={color}
              checked={value === color}
              onChange={() => handleColorChange(color)}
            />
            {value === color && <span className="checkmark">✓</span>}
          </label>
        ))}
      </div>

      {/* Custom Color Picker */}
      <div className="custom-color-section">
        <button
          type="button"
          className="custom-color-toggle"
          onClick={() => setShowCustomPicker(!showCustomPicker)}
        >
          {showCustomPicker ? "Hide" : "Show"} Custom Color Picker
        </button>

        {showCustomPicker && (
          <div className="custom-color-picker">
            <div className="color-input-group">
              <input
                type="color"
                value={customColor}
                onChange={handleCustomColorChange}
                className="color-input"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                    handleColorChange(e.target.value);
                  }
                }}
                placeholder="#FFFFFF"
                className="color-text-input"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
            <small>Enter a hex color code or use the color picker</small>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="current-color-preview">
        <span>Current Color: </span>
        <div className="color-preview-box" style={{ backgroundColor: value }}></div>
        <span>{value}</span>
      </div>
    </div>
  );
}

/** Accordion item */
function AccordionItem({ id, openId, setOpenId, icon, title, children }) {
  const isOpen = openId === id;
  const panelRef = useRef(null);
  const [maxH, setMaxH] = useState(0);

  useEffect(() => {
    function measure() {
      if (!panelRef.current) return;
      const inner = panelRef.current.querySelector(".panel-inner");
      const h = inner ? inner.scrollHeight : panelRef.current.scrollHeight;
      setMaxH(isOpen ? h : 0);
    }

    measure();
    window.addEventListener("resize", measure);
    const raf = requestAnimationFrame(measure);

    return () => {
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(raf);
    };
  }, [isOpen, children]);

  return (
    <div className={`ui-acc-item ${isOpen ? "open" : ""}`}>
      <button
        id={`${id}-head`}
        type="button"
        className="ui-acc-head"
        onClick={() => setOpenId(isOpen ? null : id)}
        aria-expanded={isOpen}
        aria-controls={`${id}-panel`}
      >
        <span className="ui-acc-left">
          <span className="ui-acc-icon">{icon}</span>
          <span className="ui-acc-title">{title}</span>
        </span>
        <span className="ui-acc-caret" aria-hidden="true" />
      </button>

      <div
        id={`${id}-panel`}
        className="ui-acc-panel"
        ref={panelRef}
        style={{ maxHeight: `${maxH}px` }}
      >
        <div className="panel-inner">{children}</div>
      </div>
    </div>
  );
}

export function UI() {
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [formData, setFormData] = useState({
    companyName: "",
    logo: "",
    firstColor: "#3fe19b",
    secondColor: "#3c65e6"
  });
  const [logoPreview, setLogoPreview] = useState(null);

  // Token helper
  const getAuthToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("token");

  // Fetch companyId dynamically
  const getCompanyId = async () => {
    let storedCompanyId = localStorage.getItem("companyId");
    if (storedCompanyId) return storedCompanyId;

    const token = getAuthToken();
    if (!token) return null;

    const res = await fetch(`${apiUrl}/api/ui/`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.companies?.length > 0) {
        const companyId = data.companies[0].id;
        localStorage.setItem("companyId", companyId);
        return companyId;
      }
    }
    return null;
  };

  const showMessage = (msg, type = "success") => {
    if (type === "success") {
      setSuccess(msg);
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(msg);
      setSuccess(null);
      setTimeout(() => setError(null), 5000);
    }
  };

  // Fetch UI customization
  const fetchUICustomization = async () => {
    try {
      const token = getAuthToken();
      if (!token) throw new Error("No authentication token found");

      const companyId = await getCompanyId();
      if (!companyId) throw new Error("No company ID found");

      const res = await fetch(`${apiUrl}/api/ui/${companyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.msg || "Failed to fetch customization");
      }

      const data = await res.json();
      setFormData({
        companyName: data.companyName || "",
        logo: data.logo || "",
        firstColor: data.firstColor || "#3fe19b",
        secondColor: data.secondColor || "#3c65e6"
      });
      if (data.logo) setLogoPreview(data.logo);
    } catch (err) {
      showMessage(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Save customization
  const saveCustomization = async () => {
    try {
      setSaving(true);
      const token = getAuthToken();
      const companyId = await getCompanyId();

      const res = await fetch(`${apiUrl}/api/ui/${companyId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.msg || "Failed to save customization");
      }

      showMessage("UI customization saved successfully!");
    } catch (err) {
      showMessage(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchUICustomization();
  }, []);

  if (loading) {
    return (
      <>
        <Navbar />
        <HeaderButton />
        <main className="ui-main">
          <p>Loading UI customization...</p>
        </main>
      </>
    );
  }

 return (
  <>
      <Navbar />
      <HeaderButton />

      {/* Title outside of .ui-main */}
      <div className="ui-top-header">
        <h1>UI Customization</h1>
      </div>

      {/* Spacer to push content down */}
      <div className="ui-header-spacer"></div>

    <main className="ui-main">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Logo */}
      <AccordionItem id="logo" openId={openId} setOpenId={setOpenId} icon="🖼️" title="Logo">
        <div>
          {logoPreview && <img src={logoPreview} alt="Logo" className="preview-image" />}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  setLogoPreview(ev.target.result);
                  setFormData((prev) => ({ ...prev, logo: ev.target.result }));
                };
                reader.readAsDataURL(file);
              }
            }}
          />
        </div>
      </AccordionItem>

      {/* Company Name */}
      <AccordionItem id="company" openId={openId} setOpenId={setOpenId} icon="🚍" title="Company Name">
        <input
          className="ui-input"
          placeholder="Company Name"
          value={formData.companyName}
          onChange={(e) => setFormData((p) => ({ ...p, companyName: e.target.value }))}
        />
      </AccordionItem>

      {/* Primary Color */}
      <AccordionItem id="primary-color" openId={openId} setOpenId={setOpenId} icon="🎨" title="Primary Color">
        <ColorPicker
          label="Primary Color"
          value={formData.firstColor}
          onChange={(n, v) => setFormData((p) => ({ ...p, [n]: v }))}
          name="firstColor"
        />
      </AccordionItem>

      {/* Secondary Color */}
      <AccordionItem id="secondary-color" openId={openId} setOpenId={setOpenId} icon="🖌️" title="Secondary Color">
        <ColorPicker
          label="Secondary Color"
          value={formData.secondColor}
          onChange={(n, v) => setFormData((p) => ({ ...p, [n]: v }))}
          name="secondColor"
        />
      </AccordionItem>
      
      <p style={{ fontSize: "15px", color: "#666", marginRight: "auto" }}>
          Note: Changes will be reflected on the mobile app.
        </p>
        
      <div className="ui-actions">
        <button onClick={saveCustomization} disabled={saving} className="ui-btn primary">
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </main>
  </>
);
}