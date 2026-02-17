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
        if (!config.number_entity) throw new Error('You must define a number_entity');

        // HA passes a frozen/read-only config object. We must clone it before setting defaults!
        this.config = { ...config };
        this.config.theme = this.config.theme || 'minimal-dark';
    }

    set hass(hass) {
        this._hass = hass;

        const inputEntity = this.config.number_entity;
        let value, unit;
        let icon = this.config.icon || "";

        if (hass.states[inputEntity]) {
            const stateObj = hass.states[inputEntity];
            value = stateObj.state;
            unit = stateObj.attributes.unit_of_measurement || this.config.unit || "";

            if (!icon && stateObj.attributes.icon) {
                icon = stateObj.attributes.icon;
            }
        } else {
            value = inputEntity.replace(/\{([a-z0-9_.]+)\}/g, (match, entityId) => {
                const ent = hass.states[entityId];
                return ent ? ent.state : match;
            });
            unit = this.config.unit || "";
        }

        const autoFormat = (this.config.number_auto_format !== false);

        if (autoFormat) {
            const result = this.autoScale(value, unit);
            value = result.value;
            unit = result.unit;
        }

        let description = this.config.description || '';
        description = description.replace(/\{([a-z0-9_.]+)\}/g, (match, entity) => {
            const ent = hass.states[entity];
            return ent ? ent.state : match;
        });

        if (this._lastValue !== value ||
            this._lastUnit !== unit ||
            this._lastDesc !== description ||
            this._lastTheme !== this.config.theme ||
            this._lastResolvedIcon !== icon ||
            this._lastTitle !== this.config.title) {

            this._lastValue = value;
            this._lastUnit = unit;
            this._lastDesc = description;
            this._lastTheme = this.config.theme;
            this._lastResolvedIcon = icon;
            this._lastTitle = this.config.title;

            this.render(value, unit, description, icon);
        }
    }

    autoScale(value, unit) {
        let num = parseFloat(value);
        if (isNaN(num)) return { value, unit };

        const originalUnit = (unit || "").trim();
        const lowerUnit = originalUnit.toLowerCase();

        const rules = {
            'wh': ['kWh', 'MWh', 'GWh'],
            'kwh': ['MWh', 'GWh'],
            'w': ['kW', 'MW', 'GW'],
            'kw': ['MW', 'GW'],
            'va': ['kVA', 'MVA'],
            'var': ['kvar', 'Mvar']
        };

        if (!rules[lowerUnit]) {
            return { value, unit: originalUnit };
        }

        const suffixes = rules[lowerUnit];
        let currentSuffixIndex = -1;

        while (num >= 1000 && currentSuffixIndex < suffixes.length - 1) {
            num /= 1000;
            currentSuffixIndex++;
        }

        if (currentSuffixIndex >= 0) {
            return {
                value: parseFloat(num.toFixed(2)).toString(),
                unit: suffixes[currentSuffixIndex]
            };
        }

        return { value, unit: originalUnit };
    }

    render(value, unit, description, icon) {
        if (!this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
        }

        const themeClass = `theme-${this.config.theme}`;
        const iconHtml = icon ? `<ha-icon icon="${icon}" class="header-icon"></ha-icon>` : '';
        const titleText = this.config.title !== undefined ? this.config.title : 'Unknown Entity';

        this.shadowRoot.innerHTML = `
            <style>
                :host { 
                    display: block; 
                    width: 100%; 
                    height: 100%; 
                    --tnc-default-font: 'Roboto', Noto, -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", sans-serif;
                }
                * { box-sizing: border-box; }

                /* --- THEME DEFINITIONS --- */

                .theme-triton-hud {
                    --tnc-bg-wrapper: linear-gradient(135deg, rgba(0, 243, 255, 0.4), rgba(0, 243, 255, 0.1));
                    --tnc-wrapper-padding: 1px;
                    --tnc-bg-card: rgba(15, 15, 20, 0.85);
                    --tnc-card-border: none;
                    --tnc-clip-path: polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px));
                    --tnc-border-radius: 0px;
                    --tnc-card-padding: 12px;
                    --tnc-backdrop-filter: blur(10px);
                    
                    --tnc-title-font: 'Orbitron', sans-serif;
                    --tnc-title-color: #c8d6e5;
                    --tnc-title-weight: 700;
                    --tnc-title-transform: uppercase;
                    --tnc-title-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
                    
                    --tnc-value-font: 'Orbitron', sans-serif;
                    --tnc-value-color: #00d2d3;
                    --tnc-value-weight: 900;
                    --tnc-value-shadow: 0 0 20px rgba(0, 243, 255, 0.5);
                    
                    --tnc-unit-font: 'Orbitron', sans-serif;
                    --tnc-unit-color: rgba(0, 243, 255, 0.8);
                    --tnc-unit-weight: 700;

                    --tnc-desc-font: 'Rajdhani', sans-serif;
                    --tnc-desc-color: #8a8a9b;
                    
                    --tnc-grid-cols: 30% 70%;
                    --tnc-desc-display: flex; 
                    --tnc-value-align: flex-end;
                    --tnc-icon-display: none; 
                    --tnc-header-justify: flex-start;
                    --tnc-content-margin-top: 0px;
                }

                .theme-minimal-dark {
                    --tnc-bg-wrapper: transparent;
                    --tnc-wrapper-padding: 0px;
                    --tnc-bg-card: rgb(32, 33, 36); 
                    --tnc-card-border: 1px solid rgb(42, 43, 46); 
                    --tnc-clip-path: none;
                    --tnc-border-radius: 12px;
                    --tnc-card-padding: 16px;
                    --tnc-backdrop-filter: none;
                    
                    --tnc-title-font: var(--tnc-default-font);
                    --tnc-title-color: #9e9e9e; 
                    --tnc-title-weight: 500;
                    --tnc-title-transform: none;
                    --tnc-title-shadow: none;
                    
                    --tnc-value-font: var(--tnc-default-font);
                    --tnc-value-color: #e1e1e1; 
                    --tnc-value-weight: 400;
                    --tnc-value-shadow: none;
                    
                    --tnc-unit-font: var(--tnc-default-font);
                    --tnc-unit-color: #9e9e9e; 
                    --tnc-unit-weight: 400;

                    --tnc-desc-font: var(--tnc-default-font);
                    --tnc-desc-color: #9e9e9e;

                    --tnc-grid-cols: 1fr; 
                    --tnc-desc-display: none; 
                    --tnc-value-align: flex-start; 
                    --tnc-icon-display: block;
                    --tnc-icon-color: #9e9e9e; 
                    --tnc-header-justify: space-between;
                    --tnc-content-margin-top: 12px;
                }

                /* --- COMPONENT STYLES --- */
                
                .card-wrapper {
                    position: relative; 
                    width: 100%; 
                    height: 100%; 
                    margin: 0 auto;
                    clip-path: var(--tnc-clip-path);
                    background: var(--tnc-bg-wrapper);
                    padding: var(--tnc-wrapper-padding);
                    border-radius: var(--tnc-border-radius);
                }
                
                .hud-card {
                    width: 100%; 
                    height: 100%; 
                    background: var(--tnc-bg-card);
                    border: var(--tnc-card-border);
                    clip-path: var(--tnc-clip-path);
                    border-radius: var(--tnc-border-radius);
                    display: flex; 
                    flex-direction: column; 
                    padding: var(--tnc-card-padding);
                    position: relative; 
                    backdrop-filter: var(--tnc-backdrop-filter);
                }
                
                .card-header { 
                    flex: 0 0 auto; 
                    width: 100%; 
                    overflow: hidden;
                    display: flex;
                    justify-content: var(--tnc-header-justify);
                    align-items: center;
                }
                
                .card-title {
                    font-family: var(--tnc-title-font); 
                    font-weight: var(--tnc-title-weight);
                    color: var(--tnc-title-color);
                    text-transform: var(--tnc-title-transform);
                    letter-spacing: 0.5px; 
                    text-shadow: var(--tnc-title-shadow);
                    line-height: 1.2; 
                    white-space: nowrap; 
                    display: block;
                    text-overflow: ellipsis;
                    overflow: hidden;
                }

                .header-icon {
                    display: var(--tnc-icon-display);
                    color: var(--tnc-icon-color);
                    --mdc-icon-size: 24px; 
                    margin-left: 8px;
                    flex-shrink: 0;
                }
                
                .content-grid { 
                    flex: 1; 
                    width: 100%;
                    margin-top: var(--tnc-content-margin-top);
                    display: grid;
                    grid-template-columns: var(--tnc-grid-cols);
                    gap: 0; 
                    align-items: center;
                    overflow: hidden;
                    min-height: 0;
                }
                
                .card-desc {
                    display: var(--tnc-desc-display); 
                    min-width: 0;
                    height: 100%;
                    padding-right: 12px;
                    font-family: var(--tnc-desc-font);
                    font-size: 14px; 
                    font-weight: 500; 
                    color: var(--tnc-desc-color);
                    line-height: 1.3;
                    align-items: center;
                    overflow: hidden;
                }
                
                .desc-text {
                    width: 100%;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                    hyphens: auto;
                }
                
                .value-section {
                    min-width: 0;
                    height: 100%;
                    position: relative;
                    display: flex; 
                    justify-content: var(--tnc-value-align);
                    align-items: baseline;
                    overflow: hidden;
                }
                
                .number-wrapper { 
                    display: inline-flex; 
                    align-items: baseline; 
                    white-space: nowrap;
                    max-width: 100%;
                }
                
                .number {
                    font-family: var(--tnc-value-font);
                    font-weight: var(--tnc-value-weight);
                    color: var(--tnc-value-color);
                    text-shadow: var(--tnc-value-shadow);
                    line-height: 1;
                }
                
                .unit {
                    font-family: var(--tnc-unit-font);
                    margin-left: 6px;
                    color: var(--tnc-unit-color);
                    font-weight: var(--tnc-unit-weight);
                }
            </style>
            
            <div class="card-wrapper ${themeClass}" id="cardWrapper">
                <div class="hud-card">
                    <div class="card-header">
                        <div class="card-title" id="cardTitle">${titleText}</div>
                        ${iconHtml}
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
            this.fitAll();
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
        if (!this.shadowRoot.getElementById('cardTitle')) return;

        this.fitTitle();

        const descSection = this.shadowRoot.getElementById('descSection');
        if (descSection && getComputedStyle(descSection).display !== 'none') {
            this.fitDescription();
        }

        this.fitNumber();
    }

    fitTitle() {
        const titleEl = this.shadowRoot.getElementById('cardTitle');
        if (!titleEl) return;

        const parentWidth = titleEl.parentElement.clientWidth;
        const iconEl = this.shadowRoot.querySelector('.header-icon');
        const iconWidth = iconEl ? iconEl.clientWidth + 8 : 0;
        const availableWidth = parentWidth - iconWidth;

        if (availableWidth <= 0) return;

        const isMinimal = this.config.theme === 'minimal-dark';

        let fontSize = isMinimal ? 14 : 22;
        let minFontSize = isMinimal ? 11 : 12;

        titleEl.style.fontSize = fontSize + 'px';

        while (titleEl.scrollWidth > availableWidth && fontSize > minFontSize) {
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

        if (availableWidth < 5 || availableHeight === 0) return;

        let fontSize = 14;
        descText.style.fontSize = fontSize + 'px';

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

        const isMinimal = this.config.theme === 'minimal-dark';

        let currentFontSize = isMinimal ? 28 : 54;
        let minFontSize = 14;
        displayNumber.style.fontSize = currentFontSize + 'px';

        while (numberWrapper.scrollWidth > availableWidth && currentFontSize > minFontSize) {
            currentFontSize--;
            displayNumber.style.fontSize = currentFontSize + 'px';
        }

        let unitSize;
        let unitTransform = "translateY(0px)";

        if (isMinimal) {
            unitSize = Math.min(14, currentFontSize * 0.75);
        } else {
            if (currentFontSize < 30) {
                unitSize = 14;
            } else if (currentFontSize < 40) {
                unitSize = 16;
            } else if (currentFontSize < 50) {
                unitSize = 18;
                unitTransform = "translateY(-2px)";
            } else {
                unitSize = 20;
                unitTransform = "translateY(-4px)";
            }
        }

        unitEl.style.fontSize = unitSize + 'px';
        unitEl.style.transform = unitTransform;
    }
}

customElements.define('custom-ha-tritonnet-number-card', TritonNetNumberCard);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "custom-ha-tritonnet-number-card",
    name: "TritonNet Number Card",
    description: "Futuristic HUD card with auto-scaling text, templates, and themes."
});