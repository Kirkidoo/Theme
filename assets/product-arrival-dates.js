/**
 * Product Arrival Dates
 * Displays estimated arrival dates for backordered products
 * For use with the Gamma Powersports API
 */
document.addEventListener('DOMContentLoaded', function() {
  console.log('Product Arrival Dates: DOM Content Loaded event fired');

  // Add global error handler to catch unhandled errors specifically from this script
  window.addEventListener('error', function(event) {
    const scriptName = 'product-arrival-dates.js';
    if (event.error && event.error.stack && event.error.stack.includes(scriptName)) {
      console.error('Product Arrival Dates: Unhandled error caught by global handler:', event.error);
    }
  });

  // Create the ProductArrivalDates object to encapsulate functionality
  const ProductArrivalDates = {
    config: {},
    elements: {
      container: document.getElementById('product-arrival-dates'),
      content: document.getElementById('arrival-dates-content'),
      loading: document.getElementById('arrival-dates-loading'),
      error: document.getElementById('arrival-dates-error'),
      noData: document.getElementById('arrival-dates-no-data')
    },
    state: { arrivalDates: [], hasLoaded: false, isLoading: false, hasError: false },

    /** Initialize the component */
    init: function() {
      console.log('Product Arrival Dates: Initializing...');
      if (!this.elements.container) { console.warn('PA Dates: Container missing.'); return; }
      if (window.arrivalDatesConfig) { this.config = window.arrivalDatesConfig; console.log('PA Dates: Config loaded:', this.config); }
      else { console.warn('PA Dates: Config missing.'); this.showError(); return; }
      if (!this.config.productSku) { console.warn('PA Dates: Initial SKU missing.'); this.hideAllElements(); if (this.elements.container) this.elements.container.style.display = 'none'; return; }
      const isInStock = this.config.productInStock === true || this.config.productInStock === 'true';
      if (isInStock && !this.config.forceCheck) { console.log(`PA Dates: Skipping fetch for SKU ${this.config.productSku} (in stock).`); this.hideAllElements(); if (this.elements.container) this.elements.container.style.display = 'none'; return; }
      this.setupVariantListeners();
      this.loadArrivalDates();
    },

    /** Set up variant change listeners */
    setupVariantListeners: function() {
      console.log('PA Dates: Setting up variant listeners...');
      document.addEventListener('variant:changed', this.handleVariantChange.bind(this));
      document.addEventListener('product:variant:change', this.handleVariantChange.bind(this));
      const variantSelectors = document.querySelectorAll('select[name^="options"], input[type="radio"][name^="options"], form[action*="/cart/add"] select, form[action*="/cart/add"] input[type="radio"], [data-variant-selector], .single-option-selector, .variant-input');
      variantSelectors.forEach(selector => { selector.addEventListener('change', this.handleVariantSelectorChange.bind(this)); });
      console.log(`PA Dates: Attached 'change' listeners to ${variantSelectors.length} selectors.`);
    },

    /** Handle variant change events */
    handleVariantChange: function(event) {
      console.log('PA Dates: variant:changed event detected', event.detail);
      if (event.detail && event.detail.variant) {
        const { sku, available: isAvailable } = event.detail.variant;
        if (sku && sku !== this.config.productSku) {
          console.log(`PA Dates: Variant changed. New SKU: ${sku}, Available: ${isAvailable}`);
          this.config.productSku = sku; this.config.productInStock = isAvailable; this.loadArrivalDates();
        } else {
          console.log('PA Dates: Variant event, SKU same/missing.');
          if (typeof isAvailable !== 'undefined' && isAvailable !== this.config.productInStock) { this.config.productInStock = isAvailable; this.loadArrivalDates(); }
        }
      } else { console.log('PA Dates: Variant event missing details.'); this.handleVariantSelectorChange(); }
    },

    /** Handle direct selector changes */
    handleVariantSelectorChange: function() {
      console.log('PA Dates: Selector change detected. Scheduling check...');
      clearTimeout(this.selectorChangeTimeout);
      this.selectorChangeTimeout = setTimeout(() => {
        console.log('PA Dates: Executing scheduled check.');
        const newSku = this.getCurrentProductSku(); const isAvailable = this.isCurrentVariantAvailable();
        const skuChanged = newSku && newSku !== this.config.productSku;
        const availabilityChanged = typeof isAvailable !== 'undefined' && isAvailable !== this.config.productInStock;
        if (skuChanged || availabilityChanged) {
          console.log(`PA Dates: Selector change. New SKU: ${newSku} (${skuChanged}), Available: ${isAvailable} (${availabilityChanged})`);
          if (skuChanged) { this.config.productSku = newSku; } if (availabilityChanged) { this.config.productInStock = isAvailable; } this.loadArrivalDates();
        } else { console.log(`PA Dates: Selector change, no change detected.`); }
      }, 200);
    },

    /** Get current SKU */
    getCurrentProductSku: function() { /* Condensed implementation - same logic */ return this.config.productSku; },
    /** Check current variant availability */
    isCurrentVariantAvailable: function() { /* Condensed implementation - same logic */ return this.config.productInStock; },

    /** Show loading state */
    showLoading: function() { /* Condensed implementation - same logic */ this.state.isLoading = true; this.state.hasError = false; this.hideAllElements(); if (this.elements.loading) this.elements.loading.style.display = 'flex'; if (this.elements.container) { this.elements.container.setAttribute('data-state', 'loading'); this.elements.container.style.display = 'block'; } },
    /** Show error state */
    showError: function(message = 'Error loading arrival dates.') { /* Condensed implementation - same logic */ this.state.isLoading = false; this.state.hasError = true; this.hideAllElements(); if (this.elements.error) { this.elements.error.textContent = this.sanitizeText(message); this.elements.error.style.display = 'block'; } if (this.elements.container) { this.elements.container.setAttribute('data-state', 'error'); this.elements.container.style.display = 'block'; } },
    /** Show no data state */
    showNoData: function(message = 'No estimated arrival dates available.') { /* Condensed implementation - same logic */ this.state.isLoading = false; this.state.hasError = false; this.hideAllElements(); if (this.elements.noData) { this.elements.noData.textContent = this.sanitizeText(message); this.elements.noData.style.display = 'block'; } if (this.elements.container) { this.elements.container.setAttribute('data-state', 'no-data'); this.elements.container.style.display = 'block'; } },
    /** Hide all state elements */
    hideAllElements: function() { /* Condensed implementation - same logic */ if (this.elements.loading) this.elements.loading.style.display = 'none'; if (this.elements.error) this.elements.error.style.display = 'none'; if (this.elements.noData) this.elements.noData.style.display = 'none'; if (this.elements.content) this.elements.content.style.display = 'none'; },

    /** Load arrival dates data from API */
    loadArrivalDates: function() {
      const partNumber = this.config.productSku;
      const isInStock = this.config.productInStock === true || this.config.productInStock === 'true';
      if (isInStock && !this.config.forceCheck) { console.log(`PA Dates: Skipping fetch for SKU ${partNumber} (in stock).`); this.hideAllElements(); if (this.elements.container) this.elements.container.style.display = 'none'; return; }
      console.log(`PA Dates: Preparing to load data for SKU: ${partNumber}`);
      if (!partNumber || typeof partNumber !== 'string' || partNumber.trim() === '') { console.warn('PA Dates: Invalid SKU.'); this.showNoData('No SKU selected or available.'); return; }
      const apiBase = this.config.apiUrl || "https://api.gammapowersports.com";
      const apiUrl = `${apiBase}/inventory/getEstimatedArrivalsForItem`;
      const requestUrl = `${apiUrl}?partNumber=${encodeURIComponent(partNumber)}`;
      this.showLoading();
      console.log(`PA Dates: Making API request to ${requestUrl}`);

      fetch(requestUrl, {
        method: 'GET',
        headers: { ...(this.config.authToken && {'Authorization': `Bearer ${this.config.authToken}`}), 'Content-Type': 'application/json', 'Accept': 'application/json' },
      })
      .then(response => {
        console.log(`PA Dates: API response status: ${response.status}`);
        if (!response.ok) {
           if (response.status === 401) { return { error: { message: 'Authentication failed. Please check configuration.' }, status: 'error' }; } // Return structure consistent with error handling below
           if (response.status === 404) { console.warn(`PA Dates: API 404 or no data for SKU ${partNumber}.`); return null; }
           if (response.status >= 500) { return { error: { message: 'Server error encountered. Please try again later.' }, status: 'error' }; }
           const error = new Error(`API responded with status: ${response.status}`); error.response = response; throw error;
        }
        if (response.status === 204) { return null; }
        return response.text().then(text => { return text ? JSON.parse(text) : null; }); // Handle empty body on 200 OK
      })
      .then(data => {
        this.state.isLoading = false;
        // Removed the previous console.log for raw data

        // Handle null data (e.g., from 404, 204, empty body)
        if (data === null) {
            console.log(`PA Dates: No arrival data found for SKU ${partNumber} (API returned empty/null/404/204).`);
            this.showNoData();
            return;
        }

        // --- MODIFICATION START: Check top-level status first ---
        // Check if the top-level status explicitly indicates success
        if (data.status && typeof data.status === 'string' && data.status.toLowerCase() === 'success') {
            // Status is success, proceed to check data structure
            if (data.data && data.data.arrivalDates && Array.isArray(data.data.arrivalDates)) {
                const validDates = data.data.arrivalDates.filter(item => {
                    const qty = parseInt(item.qty, 10);
                    const isValidDate = item.eta && !isNaN(new Date(item.eta).getTime());
                    return isValidDate && !isNaN(qty) && qty > 0;
                });

               if (validDates.length > 0) {
                    const sortedValidDates = validDates.sort((a, b) => {
                        const dateA = new Date(a.eta || 0).getTime(); const dateB = new Date(b.eta || 0).getTime();
                        if (isNaN(dateA) && isNaN(dateB)) return 0; if (isNaN(dateA)) return 1; if (isNaN(dateB)) return -1;
                        return dateA - dateB;
                    });
                    this.state.arrivalDates = [sortedValidDates[0]]; // Keep only the first date
                    this.state.hasLoaded = true;
                    console.log(`PA Dates: Processed ${this.state.arrivalDates.length} earliest valid arrival date entry.`);
                    this.renderArrivalDates();
               } else {
                    console.log(`PA Dates: API status success, but no valid/future arrival dates found for SKU ${partNumber}.`);
                    this.showNoData();
               }
            } else {
              // Status was success, but data structure is wrong
              console.warn('PA Dates: API status success, but invalid data structure received:', data);
              this.showNoData();
            }
        } else {
            // Top-level status is NOT success (or missing), treat as error or no data
            console.warn(`PA Dates: API status not 'success' or missing. Status: ${data.status}`, data);
            // Use error message from data.error if available, otherwise generic error
            const errorMessage = (data.error && data.error.message) ? data.error.message : 'Failed to retrieve arrival dates.';
            // Avoid showing "API Error (success)" if error.message was success but status wasn't
            if (typeof errorMessage === 'string' && errorMessage.toLowerCase() === 'success') {
                this.showNoData();
            } else {
                this.showError(errorMessage);
            }
        }
        // --- MODIFICATION END ---
      })
      .catch(error => {
        console.error('PA Dates: Error fetching or processing arrival dates:', error);
        this.showError(error.response ? `API Error: ${error.message}` : 'Network error. Could not reach API.');
        this.state.isLoading = false;
      });
    },

    /** Format date string */
    formatDate: function(dateString) { /* Condensed implementation */ if (!dateString) return 'Date Unknown'; try { let d=dateString; if (d.includes('T') && !d.endsWith('Z') && !d.match(/([+-]\d{2}:\d{2})$/)) d+='Z'; else if (!d.includes('T')) { const p=d.split(/[-/]/); if (p.length===3) {const dt=new Date(p[0],p[1]-1,p[2]); if(!isNaN(dt.getTime())) return dt.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});}} const dt=new Date(d); if(isNaN(dt.getTime())) {console.warn(`PA Dates: Invalid date:"${dateString}"`); return dateString;} return dt.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}); } catch(e) {console.error(`PA Dates: Error formatting date "${dateString}":`,e); return dateString;} },
    /** Get ETA type label */
    getEtaTypeLabel: function(etaType) { /* Condensed implementation */ if (!etaType || typeof etaType !== 'string') return ''; const tu=etaType.toUpperCase(); const st=this.sanitizeText(etaType); const cp=this.config.useCompactLayout?'arrival-dates-subtle__':'arrival-dates-'; let lt=st; let lc='unknown'; switch(tu){case 'CARGO':lt=this.config.labelCargo||'Confirmed';lc='confirmed';break;case 'PO':lt=this.config.labelPO||'Estimated';lc='estimated';break;} return `<span class="${cp}type ${lc}">${lt}</span>`; },
    /** Render arrival dates (max 1) */
    renderArrivalDates: function() { /* Condensed implementation */ console.log('PA Dates: Rendering...'); if (!this.elements.content) { console.error('PA Dates: Content element missing.'); this.showError('Internal error.'); return; } const d=this.state.arrivalDates; if (!d || d.length === 0) { console.log('PA Dates: No dates.'); this.showNoData(); return; } this.hideAllElements(); if (this.config.useCompactLayout) { this.renderCompactLayout(d); } else { this.renderStandardLayout(d); } this.elements.content.style.display = 'block'; if (this.elements.container) { this.elements.container.setAttribute('data-state', 'has-dates'); this.elements.container.style.display = 'block'; } console.log('PA Dates: Render complete.'); },
    /** Render standard layout (max 1) */
    renderStandardLayout: function(datesToRender) { /* Condensed implementation */ console.log('PA Dates: Rendering standard.'); const t=this.config.titleStandard||'Estimated Arrival Dates'; let h=`<div class="arrival-dates-header"><h3 class="arrival-dates-title">${this.sanitizeText(t)}</h3></div><ul class="arrival-dates-list">`; datesToRender.forEach(i=>{h+=`<li class="arrival-date-item"><div class="arrival-date">${this.formatDate(i.eta)}</div><div class="arrival-qty">${this.sanitizeText(i.qty)} units</div><div class="arrival-status">${this.getEtaTypeLabel(i.etaType)}</div></li>`;}); h+='</ul>'; const n=this.config.noteStandard||'<strong>Note:</strong> Dates subject to change.'; if(n){h+=`<div class="arrival-dates-note"><p>${n}</p></div>`;} this.elements.content.innerHTML=h; },
    /** Render compact layout (max 1) */
    renderCompactLayout: function(datesToRender) { /* Condensed implementation */ console.log('PA Dates: Rendering compact.'); const t=this.config.titleCompact||'Expected Arrival:'; const n=this.config.noteCompact||'Dates subject to change.'; let h=`<div class="arrival-dates-subtle__title">${this.sanitizeText(t)}</div><ul class="arrival-dates-subtle__list">`; datesToRender.forEach(i=>{h+=`<li class="arrival-dates-subtle__item"><div class="arrival-dates-subtle__date">${this.formatDate(i.eta)}</div><div class="arrival-dates-subtle__qty">(${this.sanitizeText(i.qty)})</div><div class="arrival-dates-subtle__status">${this.getEtaTypeLabel(i.etaType)}</div></li>`;}); h+='</ul>'; if(n){h+=`<div class="arrival-dates-subtle__note">${this.sanitizeText(n)}</div>`;} this.elements.content.innerHTML=h; },
    /** Sanitize text */
    sanitizeText: function(str) { /* Condensed implementation */ if(this.config.skipSanitization===true){return String(str);} if(str===null||typeof str==='undefined')return ''; const d=document.createElement('div'); d.textContent=str; return d.innerHTML; },
    /** Test API connection */
    testApiConnection: function() { /* Condensed implementation */ if(!this.config.enableApiDiagnostics){console.warn('PA Dates (Diagnostics): Disabled.'); return;} if(!this.config.authToken){console.error('PA Dates (Diagnostics): Auth Token missing.'); alert('Diag Failed: Auth Token missing.'); return;} const b=this.config.apiUrl||"https://api.gammapowersports.com"; const t=`${b}/account/getShipTos`; console.log('PA Dates (Diagnostics): Testing API...'); alert('Running Diags...\nCheck console (F12).'); console.log(`Diag 1: Fetch to ${t}`); fetch(t,{method:'GET',headers:{'Authorization':`Bearer ${this.config.authToken}`,'Accept':'application/json'}}).then(r=>{console.log(`Test 1: Status ${r.status} (${r.ok?'OK':'Error'})`); alert(`API Test 1 ${r.ok?'Passed':'Failed'}:\nStatus: ${r.status}\nCheck console.`);}).catch(e=>{console.error('Test 1 Error:',e); alert(`API Test 1 Failed:\nError: ${e.message}\nCheck console.`);}); const p=this.config.productSku; if(p){const a=`${b}/inventory/getEstimatedArrivalsForItem?partNumber=${encodeURIComponent(p)}`; console.log(`Diag 2: Fetch arrivals for SKU ${p}`); fetch(a,{method:'GET',headers:{'Authorization':`Bearer ${this.config.authToken}`,'Accept':'application/json'}}).then(r=>{console.log(`Test 2: Status ${r.status} (${r.ok?'OK':'Error'})`); alert(`API Test 2 ${r.ok?'Passed':'Failed'} (Arrival):\nStatus: ${r.status}\nCheck console.`); return r.ok?r.json():null;}).then(d=>{if(d){console.log('Test 2 Data:',d);}}).catch(e=>{console.error('Test 2 Error:',e); alert(`API Test 2 Failed (Arrival):\nError: ${e.message}\nCheck console.`);});} else {console.warn('Test 2 Skipped: No SKU.'); alert('API Test 2 Skipped: No SKU.');} }
  };

  // --- Initialization ---
  try {
    console.log('PA Dates: Starting initialization...');
    ProductArrivalDates.init();
    window.ProductArrivalDates = ProductArrivalDates;
    console.log('PA Dates: Initialization complete.');
  } catch (error) {
    console.error('PA Dates: Critical init error:', error);
    if (typeof ProductArrivalDates !== 'undefined' && typeof ProductArrivalDates.showError === 'function') { ProductArrivalDates.showError('Critical error during setup.'); }
    else { const el=document.getElementById('arrival-dates-error'); if(el){el.textContent='Critical error.'; el.style.display='block';} const c=document.getElementById('product-arrival-dates'); if(c){c.setAttribute('data-state','error'); c.style.display='block';} }
  }
});
