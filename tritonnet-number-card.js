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
        document.fonts.ready.then(() => {
            this._fontsLoaded = true;
            this.fitAll();
        });
    }

    setConfig(config) {
        if (!config.number_entity_id) throw new Error('You must define a number_entity_id');
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
                :host { display: block; width: 100%; height: 100%; }
                * { box-sizing: border-box; }
                
                .card-wrapper {
                    position: relative; 
                    width: 100%; 
                    height: 120px; 
                    margin: 0 auto;
                    clip-path: polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px));
                    background: linear-gradient(135deg, rgba(0, 243, 255, 0.4), rgba(0, 243, 255, 0.1));
                    padding: 1px;
                }
                
                .hud-card {
                    width: 100%; 
                    height: 100%; 
                    background: rgba(15, 15, 20, 0.85);
                    clip-path: polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px));
                    display: flex; 
                    flex-direction: column; 
                    padding: 12px;
                    position: relative; 
                    backdrop-filter: blur(10px);
                }
                
                /* HEADER - Top Section */
                .card-header { 
                    flex: 0 0 auto; 
                    width: 100%; 
                    margin-bottom: 8px; 
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
                    width: 100%;
                }
                
                /* CONTENT GRID - 30% / 70% Split */
                .content-grid { 
                    flex: 1; 
                    width: 100%;
                    display: grid;
                    grid-template-columns: 30% 70%; 
                    gap: 0; 
                    align-items: center;
                    overflow: hidden;
                    min-height: 0;
                }
                
                /* 30% Description Section */
                .card-desc {
                    min-width: 0;
                    height: 100%;
                    padding-right: 12px;
                    font-family: 'Rajdhani', sans-serif;
                    font-size: 14px; 
                    font-weight: 500; 
                    color: #8a8a9b; 
                    line-height: 1.3;
                    display: flex;
                    align-items: center;
                    overflow: hidden;
                }
                
                .desc-text {
                    width: 100%;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    hyphens: auto;
                }
                
                /* 70% Value Section */
                .value-section {
                    min-width: 0;
                    height: 100%;
                    position: relative;
                    display: flex; 
                    justify-content: flex-end;
                    align-items: center;
                    overflow: hidden;
                }
                
                .number-wrapper { 
                    display: inline-flex; 
                    align-items: baseline; 
                    white-space: nowrap;
                    max-width: 100%;
                }
                
                .number {
                    font-family: 'Orbitron', sans-serif; 
                    font-size: 54px; 
                    font-weight: 900;
                    color: #00d2d3; 
                    text-shadow: 0 0 20px rgba(0, 243, 255, 0.5);
                    line-height: 1;
                }
                
                .unit {
                    font-family: 'Orbitron', sans-serif; 
                    font-size: 18px; 
                    margin-left: 4px;
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
                    
                    <div class="content-grid">
                        <div class="card-desc" id="descSection">
                            <div class="desc-text" id="descText">${description}</div>
                        </div>
                        
                        <div class="value-section" id="valueSection">
                            <div class="number-wrapper" id="numberWrapper">
                                <span class="number" id="displayNumber">${value}</span>
                                <span class="unit" id="displayUnit">${unit}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachResizeObserver();
        requestAnimationFrame(() => {
            if (this._fontsLoaded) {
                this.fitAll();
            }
        });
    }

    attachResizeObserver() {
        if (this.resizeObserver) this.resizeObserver.disconnect();
        const wrapper = this.shadowRoot.getElementById('cardWrapper');
        if (!wrapper) return;

        this.resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(() => {
                this.fitAll();
            });
        });
        this.resizeObserver.observe(wrapper);
    }

    fitAll() {
        this.fitTitle();
        this.fitDescription();
        this.fitNumber();
    }

    fitTitle() {
        const titleEl = this.shadowRoot.getElementById('cardTitle');
        if (!titleEl) return;

        const parentWidth = titleEl.parentElement.clientWidth;
        if (parentWidth === 0) return;

        let fontSize = 22;
        titleEl.style.fontSize = fontSize + 'px';

        while (titleEl.scrollWidth > parentWidth && fontSize > 12) {
            fontSize--;
            titleEl.style.fontSize = fontSize + 'px';
        }
    }

    fitDescription() {
        const descSection = this.shadowRoot.getElementById('descSection');
        const descText = this.shadowRoot.getElementById('descText');
        if (!descSection || !descText) return;

        const availableWidth = descSection.clientWidth;
        const availableHeight = descSection.clientHeight;
        if (availableWidth === 0 || availableHeight === 0) return;

        let fontSize = 14;
        descText.style.fontSize = fontSize + 'px';

        // Shrink if text overflows vertically or horizontally
        while ((descText.scrollHeight > availableHeight || descText.scrollWidth > availableWidth) && fontSize > 9) {
            fontSize--;
            descText.style.fontSize = fontSize + 'px';
        }
    }

    fitNumber() {
        const displayNumber = this.shadowRoot.getElementById('displayNumber');
        const unitEl = this.shadowRoot.getElementById('displayUnit');
        const numberWrapper = this.shadowRoot.getElementById('numberWrapper');
        const valueSection = this.shadowRoot.getElementById('valueSection');

        if (!displayNumber || !numberWrapper || !valueSection) return;

        const availableWidth = valueSection.clientWidth;
        if (availableWidth === 0) return;

        // Start at maximum size
        let currentFontSize = 54;
        displayNumber.style.fontSize = currentFontSize + 'px';

        // Shrink until it fits
        let contentWidth = numberWrapper.scrollWidth;
        while (contentWidth > availableWidth && currentFontSize > 14) {
            currentFontSize--;
            displayNumber.style.fontSize = currentFontSize + 'px';
            contentWidth = numberWrapper.scrollWidth;
        }

        // Adjust unit size and position based on number size
        if (currentFontSize < 30) {
            unitEl.style.transform = "translateY(0px)";
            unitEl.style.fontSize = "12px";
        } else if (currentFontSize < 40) {
            unitEl.style.transform = "translateY(-2px)";
            unitEl.style.fontSize = "14px";
        } else if (currentFontSize < 50) {
            unitEl.style.transform = "translateY(-3px)";
            unitEl.style.fontSize = "16px";
        } else {
            unitEl.style.transform = "translateY(-4px)";
            unitEl.style.fontSize = "18px";
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