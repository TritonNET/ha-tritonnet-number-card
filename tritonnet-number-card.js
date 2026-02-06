class TritonNetNumberCard extends HTMLElement {
    constructor() {
        super();
        this.loadFonts();
        this.resizeObserver = null;
        this._fontsLoaded = false;
    }

    loadFonts() {
        const fontId = 'tritonnet-fonts';
        if (!document.getElementById(fontId)) {
            const link = document.createElement('link');
            link.id = fontId;
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600&display=swap';
            document.head.appendChild(link);
        }

        // Wait for fonts to be ready before first calculation
        document.fonts.ready.then(() => {
            this._fontsLoaded = true;
            this.fitToBox();
            this.fitTitle();
        });
    }

    setConfig(config) {
        if (!config.number_entity_id) {
            throw new Error('You must define a number_entity_id');
        }
        this.config = config;
    }

    set hass(hass) {
        this._hass = hass;
        const entityId = this.config.number_entity_id;
        const stateObj = hass.states[entityId];

        if (stateObj) {
            const value = stateObj.state;
            const unit = stateObj.attributes.unit_of_measurement || this.config.unit || "";
            let description = this.config.description || 'System status normal.';

            description = description.replace(/\{([a-z0-9_.]+)\}/g, (match, entity) => {
                const ent = hass.states[entity];
                return ent ? ent.state : match;
            });

            if (this._lastValue !== value || this._lastUnit !== unit || this._lastDesc !== description) {
                this._lastValue = value;
                this._lastUnit = unit;
                this._lastDesc = description;
                this.render(value, unit, description);
            }
        }
    }

    render(value, unit, description) {
        if (!this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
        }

        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                }
                * { box-sizing: border-box; }

                .card-wrapper {
                    position: relative;
                    width: 100%;
                    height: 120px;
                    margin: 0 auto;
                    clip-path: polygon(
                        0 0, calc(100% - 15px) 0, 100% 15px, 
                        100% 100%, 15px 100%, 0 calc(100% - 15px)
                    );
                    background: linear-gradient(135deg, rgba(0, 243, 255, 0.4), rgba(0, 243, 255, 0.1));
                    padding: 1px;
                }

                .hud-card {
                    width: 100%;
                    height: 100%;
                    background: rgba(15, 15, 20, 0.85);
                    clip-path: polygon(
                        0 0, calc(100% - 15px) 0, 100% 15px, 
                        100% 100%, 15px 100%, 0 calc(100% - 15px)
                    );
                    display: flex;
                    flex-direction: column;
                    padding: 10px; /* Reduced padding to give more space to content */
                    position: relative;
                    backdrop-filter: blur(10px);
                }

                /* Header (Top) */
                .card-header {
                    flex: 0 0 auto;
                    width: 100%;
                    margin-bottom: 2px;
                    overflow: hidden;
                }

                .card-title {
                    font-family: 'Orbitron', sans-serif;
                    font-size: 22px; 
                    font-weight: 700;
                    color: #c8d6e5;
                    text-transform: uppercase;
                    letter-spacing: 0.5px; 
                    text-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
                    line-height: 1;
                    white-space: nowrap;
                    display: block;
                }

                /* Content Row */
                .content-row {
                    flex: 1; 
                    display: flex;
                    flex-direction: row;
                    align-items: center; 
                    width: 100%;
                    overflow: hidden; 
                }

                /* --- 30% TEXT SECTION --- */
                .card-desc {
                    flex: 0 0 30%;
                    width: 30%;
                    max-width: 30%;
                    min-width: 0; /* Crucial for preventing overflow */
                    
                    padding-right: 8px; /* Slight buffer */
                    
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 11px;
                    font-weight: 500;
                    color: #8a8a9b;
                    line-height: 1.2; 
                    white-space: normal;
                    word-wrap: break-word; 
                }

                /* --- 70% NUMBER SECTION --- */
                .value-section {
                    flex: 0 0 70%;
                    width: 70%;
                    max-width: 70%;
                    min-width: 0; /* Crucial for preventing overflow */
                    
                    display: flex;
                    align-items: baseline;
                    justify-content: flex-end;
                    padding-top: 5px;
                }

                .number-wrapper {
                    display: inline-flex;
                    align-items: baseline;
                    white-space: nowrap;
                }

                .number {
                    font-family: 'Orbitron', sans-serif;
                    font-size: 54px; 
                    font-weight: 900;
                    color: #00d2d3;
                    text-shadow: 0 0 20px rgba(0, 243, 255, 0.5);
                    line-height: 1; 
                    transition: font-size 0.1s ease-out; 
                }

                .unit {
                    font-family: 'Orbitron', sans-serif;
                    font-size: 18px;
                    margin-left: 3px;
                    color: rgba(0, 243, 255, 0.8);
                    font-weight: 700;
                    transform: translateY(-4px); 
                }
            </style>

            <div class="card-wrapper" id="cardWrapper">
                <div class="hud-card">
                    <div class="card-header">
                        <div class="card-title" id="cardTitle">${this.config.title || 'Power Usage'}</div>
                    </div>

                    <div class="content-row">
                        <div class="card-desc">${description}</div>

                        <div class="value-section" id="valueSection">
                            <div class="number-wrapper" id="scaler">
                                <span class="number" id="displayNumber">${value}</span>
                                <span class="unit" id="displayUnit">${unit}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Start observation
        this.attachResizeObserver();

        // Try fitting immediately in case fonts are cached
        if (this._fontsLoaded) {
            this.fitToBox();
            this.fitTitle();
        }
    }

    attachResizeObserver() {
        if (this.resizeObserver) this.resizeObserver.disconnect();
        const wrapper = this.shadowRoot.getElementById('cardWrapper');
        if (!wrapper) return;

        this.resizeObserver = new ResizeObserver(() => {
            // Debounce slightly to allow layout to settle
            requestAnimationFrame(() => {
                this.fitToBox();
                this.fitTitle();
            });
        });
        this.resizeObserver.observe(wrapper);
    }

    // --- FIT TITLE LOGIC ---
    fitTitle() {
        const titleEl = this.shadowRoot.getElementById('cardTitle');
        if (!titleEl) return;

        const parentWidth = titleEl.parentElement.clientWidth;
        if (parentWidth === 0) return;

        // Reset to max to re-measure
        let fontSize = 22;
        titleEl.style.fontSize = fontSize + 'px';

        while (titleEl.scrollWidth > parentWidth && fontSize > 14) {
            fontSize--;
            titleEl.style.fontSize = fontSize + 'px';
        }
    }

    // --- FIT NUMBER LOGIC (With Font Loading Fix) ---
    fitToBox() {
        const display = this.shadowRoot.getElementById('displayNumber');
        const unitEl = this.shadowRoot.getElementById('displayUnit');
        const scaler = this.shadowRoot.getElementById('scaler');
        const valueSection = this.shadowRoot.getElementById('valueSection');

        if (!display || !scaler || !valueSection) return;

        // Reset to max size to measure true width
        let currentFontSize = 54;
        display.style.fontSize = currentFontSize + 'px';

        // Get actual available pixel width of the 70% container
        const containerWidth = valueSection.clientWidth;

        // Safety check: if container is 0 (hidden), stop
        if (containerWidth === 0) return;

        let contentWidth = scaler.scrollWidth;

        // Shrink loop - allows shrinking down to 14px to prevent overlap
        while (contentWidth > containerWidth && currentFontSize > 14) {
            currentFontSize -= 2;
            display.style.fontSize = currentFontSize + 'px';
            contentWidth = scaler.scrollWidth;
        }

        // Adjust Unit Vertical Alignment
        if (currentFontSize < 30) {
            unitEl.style.transform = "translateY(0px)";
            unitEl.style.fontSize = "12px";
        } else if (currentFontSize < 40) {
            unitEl.style.transform = "translateY(-2px)";
            unitEl.style.fontSize = "14px";
        } else {
            unitEl.style.transform = "translateY(-4px)";
            unitEl.style.fontSize = "18px";
        }
    }

    getCardSize() {
        return 3;
    }

    disconnectedCallback() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }
}

customElements.define('custom-ha-tritonnet-number-card', TritonNetNumberCard);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "custom-ha-tritonnet-number-card",
    name: "TritonNet Number Card",
    description: "Futuristic HUD card with auto-scaling text and templates."
});