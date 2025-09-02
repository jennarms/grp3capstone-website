import React, { useEffect, useRef, useState } from "react";
import { Navbar } from "../components/navBar";
import { HeaderButton } from "../components/headerButton";
import "./uiCustomization.css";

/** Single accordion item with smooth height animation (auto to content) */
function AccordionItem({ id, openId, setOpenId, icon, title, children }) {
  const isOpen = openId === id;
  const panelRef = useRef(null);
  const [maxH, setMaxH] = useState(0);

  // Measure content height on open/resize
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

    // Re-measure while open if content size changes
    let ro;
    if (isOpen && panelRef.current) {
      const inner = panelRef.current.querySelector(".panel-inner");
      if (inner && "ResizeObserver" in window) {
        ro = new ResizeObserver(() => measure());
        ro.observe(inner);
      }
    }

    return () => {
      window.removeEventListener("resize", measure);
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
    };
  }, [isOpen, children]);

  const handleToggle = () => {
    // Preserve scroll position to avoid any “jump” during expand/collapse
    const y = window.scrollY;
    setOpenId(isOpen ? null : id);
    requestAnimationFrame(() => window.scrollTo(0, y));
  };

  return (
    <div className={`ui-acc-item ${isOpen ? "open" : ""}`} style={{ overflowAnchor: "none" }}>
      <button
        id={`${id}-head`}
        type="button"
        className="ui-acc-head"
        onClick={handleToggle}
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
        ref={panelRef}
        style={{ maxHeight: `${maxH}px`, overflowAnchor: "none" }}
      >
        <div className="panel-inner">{children}</div>
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
        {/* Sticky title bar wrapper prevents borders from showing beside the title */}
        <div className="ui-titlebar">
          <h1 className="ui-title">UI Customization</h1>
        </div>

        {/* Accordion */}
        <section className="ui-accordion" style={{ overflowAnchor: "none" }}>
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

          {/* Company Name */}
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
              <input
                id="companyName"
                className="ui-input"
                placeholder="e.g. Pasig Ferry"
              />
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
              {["#0B1A78", "#1BC882", "#FFB020", "#E66C6C", "#8C54FF"].map(
                (c) => (
                  <label key={c} className="ui-swatch" style={{ background: c }}>
                    <input type="radio" name="brandColor" value={c} />
                  </label>
                )
              )}
            </div>
          </AccordionItem>
        </section>

        {/* Actions */}
        <div className="ui-actions">
          <button type="button" className="ui-btn secondary">
            Reset to Default
          </button>
          <button type="button" className="ui-btn primary">
            Save Customization
          </button>
        </div>
      </main>
    </>
  );
}