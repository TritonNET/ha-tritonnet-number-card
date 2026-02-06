class TritonNetNumberCard extends HTMLElement {
    // strict: configuration validation
    setConfig(config) {
        if (!config.number_entity_id) {
            throw new Error('You must define a number_entity_id');
        }
        this.config = config;
    }

    // strict: reactive update when HA state changes
    set hass(hass) {
        this._hass = hass;
        const entityId = this.config.number_entity_id;
        const stateObj = hass.states[entityId];

        // Only render if we have state
        if (stateObj) {
            const value = stateObj.state;
            // Use attribute unit, or config unit, or empty string
            const unit = stateObj.attributes.unit_of_measurement || this.config.unit || "";

            // Check if value changed to avoid unnecessary re-renders
            if (this._lastValue !== value || this._lastUnit !== unit) {
                this._lastValue = value;
                this._lastUnit = unit;
                this.render(value, unit);
            }
        }
    }

    render(value, unit) {
        // Create shadow DOM if it doesn't exist
        if (!this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
        }

        // --- HTML TEMPLATE (Based on V28) ---
        // We inject the CSS directly here for encapsulation
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    --card-width: 290px;
                    --card-height: 120px;
                }
                
                /* Reset standard HA card styles if needed */
                * {
                    box-sizing: border-box;
                }

                .card-wrapper {
                    position: relative;
                    width: 100%;
                    max-width: var(--card-width);
                    height: var(--card-height);
                    margin: 0 auto; /* Center in Lovelace column */
                    
                    clip-path: polygon(
                        0 0,                        
                        calc(100% - 15px) 0,       
                        100% 15px,                 
                        100% 100%,                  
                        15px 100%,                  
                        0 calc(100% - 15px)         
                    );
                    background: linear-gradient(135deg, rgba(0, 243, 255, 0.4), rgba(0, 243, 255, 0.1));
                    padding: 1px;
                }

                .hud-card {
                    width: 100%;
                    height: 100%;
                    background: rgba(15, 15, 20, 0.85);
                    clip-path: polygon(
                        0 0,                        
                        calc(100% - 15px) 0,        
                        100% 15px,                  
                        100% 100%,                  
                        15px 100%,                  
                        0 calc(100% - 15px)         
                    );
                    
                    display: flex;
                    flex-direction: column;
                    padding: 12px;
                    position: relative;
                    backdrop-filter: blur(10px);
                }

                /* Header */
                .card-header {
                    flex: 0 0 auto;
                    margin-bottom: 0px; 
                }

                .card-title {
                    font-family: 'Segoe UI', Roboto, Helvetica, sans-serif; /* Fallback for Orbitron */
                    font-size: 22px; 
                    font-weight: 700;
                    color: #c8d6e5;
                    text-transform: uppercase;
                    letter-spacing: 0.5px; 
                    text-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
                    line-height: 1;
                    white-space: nowrap;
                }

                /* Content Row */
                .content-row {
                    flex: 1; 
                    display: flex;
                    flex-direction: row;
                    align-items: center; 
                    width: 100%;
                    gap: 20px;
                }

                .card-desc {
                    flex: 1; 
                    min-width: 0; 
                    font-family: 'Segoe UI', Roboto, Helvetica, sans-serif; /* Fallback for Rajdhani */
                    font-size: 11px;
                    font-weight: 500;
                    color: #8a8a9b;
                    line-height: 1.2; 
                    white-space: normal;
                    word-wrap: break-word; 
                }

                /* Value Section */
                .value-section {
                    flex: 0 0 auto;
                    display: flex;
                    align-items: baseline;
                    justify-content: flex-end;
                    max-width: 70%;
                }

                .number-wrapper {
                    display: inline-flex;
                    align-items: baseline;
                    white-space: nowrap;
                }

                .number {
                    font-family: 'Segoe UI', Roboto, Helvetica, sans-serif;
                    font-size: 54px; 
                    font-weight: 900;
                    color: #00d2d3;
                    text-shadow: 0 0 20px rgba(0, 243, 255, 0.5);
                    line-height: 1; 
                    transition: font-size 0.2s ease;
                }

                .unit {
                    font-family: 'Segoe UI', Roboto, Helvetica, sans-serif;
                    font-size: 18px;
                    margin-left: 3px;
                    color: rgba(0, 243, 255, 0.8);
                    font-weight: 700;
                    transform: translateY(-4px); 
                }
            </style>

            <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600&display=swap" rel="stylesheet">
            <style>
                /* Apply loaded fonts with specificity to override fallbacks */
                .card-title, .number, .unit { font-family: 'Orbitron', sans-serif !important; }
                .card-desc { font-family: 'Rajdhani', sans-serif !important; }
            </style>

            <div class="card-wrapper">
                <div class="hud-card">
                    <div class="card-header">
                        <div class="card-title">${this.config.title || 'Power Usage'}</div>
                    </div>

                    <div class="content-row">
                        <div class="card-desc">${this.config.description || 'System status normal.'}</div>

                        <div class="value-section">
                            <div class="number-wrapper" id="scaler">
                                <span class="number" id="displayNumber">${value}</span>
                                <span class="unit" id="displayUnit">${unit}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Trigger the sizing logic immediately after DOM update
        this.fitToBox();
    }

    // --- AUTO SCALING LOGIC ---
    fitToBox() {
        const display = this.shadowRoot.getElementById('displayNumber');
        const unitEl = this.shadowRoot.getElementById('displayUnit');
        const scaler = this.shadowRoot.getElementById('scaler');

        if (!display || !scaler) return;

        // Reset to max size to measure true width
        let currentFontSize = 54;
        display.style.fontSize = currentFontSize + 'px';

        // Calculate max allowed width (approx 70% of card width 290px -> ~203px)
        // We subtract a buffer for the unit and gap
        const maxAllowed = 200;

        // Wait a tick for DOM to reflow, then measure
        requestAnimationFrame(() => {
            let contentWidth = scaler.scrollWidth;

            // Shrink loop
            while (contentWidth > maxAllowed && currentFontSize > 20) {
                currentFontSize -= 2; // Step down faster for performance
                display.style.fontSize = currentFontSize + 'px';
                contentWidth = scaler.scrollWidth;
            }

            // Adjust Unit Vertical Alignment based on final font size
            if (currentFontSize < 40) {
                unitEl.style.transform = "translateY(0px)";
                unitEl.style.fontSize = "14px";
            } else {
                unitEl.style.transform = "translateY(-4px)";
                unitEl.style.fontSize = "18px";
            }
        });
    }

    // Optional: Define card size for Lovelace layout engine
    getCardSize() {
        return 3;
    }
}

// Register the custom element
customElements.define('custom-ha-tritonnet-number-card', TritonNetNumberCard);

// Add card to picker (optional, purely for UI editor)
window.customCards = window.customCards || [];
window.customCards.push({
    type: "custom-ha-tritonnet-number-card",
    name: "TritonNet Number Card",
    description: "A futuristic HUD-style number card with auto-scaling text."
});