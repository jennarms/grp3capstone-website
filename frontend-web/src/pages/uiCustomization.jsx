import React, { useState } from "react";
import { Navbar } from "../components/navBar";
import { HeaderButton } from "../components/headerButton";
import "./uiCustomization.css";

function AccordionItem({ id, openId, setOpenId, icon, title, children }) {
  const isOpen = openId === id;
  return (
    <div className={`ui-acc-item ${isOpen ? "open" : ""}`}>
      <button
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
        role="region"
        aria-labelledby={`${id}-head`}
      >
        {children}
      </div>
    </div>
  );
}

export function UI() {
  const [openId, setOpenId] = useState(null);

  return (
    <>
      <Navbar />
      <HeaderButton />

      <main className="ui-main">
        <h1 className="ui-title">UI Customization</h1>

        {/* Accordion */}
        <section className="ui-accordion">

          {/* Logo */}
          <AccordionItem
            id="logo"
            openId={openId}
            setOpenId={setOpenId}
            icon="●"
            title="Logo"
          >
            <label className="ui-dropzone">
              <input
                type="file"
                accept="image/*"
                className="ui-drop-input"
                onChange={(e) => {
                  // hook up your upload logic here
                  if (e.target.files?.[0]) {
                    console.log("Selected file:", e.target.files[0]);
                  }
                }}
              />
              <div className="ui-drop-content">
                <div className="ui-drop-arrow">⬆</div>
                <div className="ui-drop-title">Upload media</div>
                <div className="ui-drop-note">File shouldn’t exceed 500kb</div>
              </div>
            </label>
          </AccordionItem>

          {/* Company Name / Transportation Name */}
          <AccordionItem
            id="company"
            openId={openId}
            setOpenId={setOpenId}
            icon="🚍"
            title="Company Name"
          >
            <div className="ui-field-row">
              <label className="ui-field-label" htmlFor="companyName">
                Company name
              </label>
              <input id="companyName" className="ui-input" placeholder="e.g. Pasig Ferry" />
            </div>
          </AccordionItem>

          {/* Color Scheme */}
          <AccordionItem
            id="colors"
            openId={openId}
            setOpenId={setOpenId}
            icon="🖌️"
            title="Color Scheme"
          >
            <div className="ui-swatches">
              {["#0B1A78", "#1BC882", "#FFB020", "#E66C6C", "#8C54FF"].map((c) => (
                <label key={c} className="ui-swatch" style={{ background: c }}>
                  <input type="radio" name="brandColor" value={c} />
                </label>
              ))}
            </div>
          </AccordionItem>

          {/* Splash Screen */}
          <AccordionItem
            id="splash"
            openId={openId}
            setOpenId={setOpenId}
            icon="⚙️"
            title="Splash Screen"
          >
            <div className="ui-field-row">
              <label className="ui-field-label" htmlFor="splashText">
                Splash text
              </label>
              <input id="splashText" className="ui-input" placeholder="Welcome aboard!" />
            </div>
          </AccordionItem>
        </section>

        {/* Actions */}
        <div className="ui-actions">
          <button type="button" className="ui-btn secondary">Reset to Default</button>
          <button type="button" className="ui-btn primary">Save Customization</button>
        </div>
      </main>
    </>
  );
}