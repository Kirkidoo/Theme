document.addEventListener('DOMContentLoaded', function() {
    // --- FIX SCROLL POSITION ON REFRESH ---
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    const section = document.querySelector('.product-finder-section');
    if (!section) return;

    if (window.pfInitialized) return;
    window.pfInitialized = true;

    const config = {
        token: section.dataset.apiToken,
        baseUrl: section.dataset.apiBase,
        sectionId: section.dataset.sectionId,
        concurrency: 5, 
        debug: true,
        cacheDuration: 60 * 60 * 1000, 
        dropdownCacheDuration: 24 * 60 * 60 * 1000 
    };

    if (!config.token) {
        console.error('Product Finder: API Token is missing.');
        return;
    }

    // --- INJECT MODAL HTML INTO BODY ---
    if (!document.getElementById('pf-fitment-modal')) {
        const modalHTML = `
        <div id="pf-fitment-modal" class="pf-modal-overlay">
          <div class="pf-modal-content">
            <div class="pf-modal-header">
              <h3 class="pf-modal-title">Vehicle Fitment</h3>
              <button class="pf-modal-close" type="button">&times;</button>
            </div>
            <div class="pf-modal-body" id="pf-modal-body"></div>
          </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    const els = {
        container: section.querySelector('.pf-container'),
        header: section.querySelector('.pf-header-row'),
        toggleIcon: section.querySelector('.pf-toggle-icon'),
        body: section.querySelector('.pf-body'),
        type: document.getElementById(`pf-type-${config.sectionId}`),
        year: document.getElementById(`pf-year-${config.sectionId}`),
        make: document.getElementById(`pf-make-${config.sectionId}`),
        model: document.getElementById(`pf-model-${config.sectionId}`),
        submit: document.getElementById(`pf-submit-${config.sectionId}`),
        reset: document.getElementById(`pf-reset-${config.sectionId}`),
        error: document.getElementById(`pf-error-${config.sectionId}`),
        results: document.getElementById(`pf-results-${config.sectionId}`),
        status: document.getElementById(`pf-status-${config.sectionId}`),
        filterWrapper: document.getElementById(`pf-filter-wrapper-${config.sectionId}`),
        filter: document.getElementById(`pf-filter-${config.sectionId}`),
        modal: document.getElementById('pf-fitment-modal'),
        modalBody: document.getElementById('pf-modal-body'),
        modalClose: document.querySelector('.pf-modal-close')
    };

    let state = { type: '', year: '', make: '', model: '' };
    let modelMap = {}; 
    const skuCache = new Map();
    const STORAGE_KEY = 'pf_my_garage';
    const RESULTS_CACHE_KEY = 'pf_garage_results';
    const DROPDOWN_CACHE_PREFIX = 'pf_dd_';

    // --- MODAL LOGIC (Updated with Scroll Lock) ---
    function toggleScrollLock(locked) {
        if (locked) {
            document.body.classList.add('overflow-hidden'); // Theme class
            document.body.style.overflow = 'hidden';        // Direct override
        } else {
            document.body.classList.remove('overflow-hidden');
            document.body.style.overflow = '';
        }
    }

    function closeModal() {
        const m = document.getElementById('pf-fitment-modal');
        if(m) {
            m.classList.remove('open');
            toggleScrollLock(false); // Unlock scroll
        }
    }

    if(els.modalClose) els.modalClose.addEventListener('click', closeModal);
    if(els.modal) els.modal.addEventListener('click', (e) => {
        if(e.target === els.modal) closeModal();
    });

    async function openFitmentModal(sku, title) {
        const m = document.getElementById('pf-fitment-modal');
        const mBody = document.getElementById('pf-modal-body');
        const mTitle = m.querySelector('.pf-modal-title');
        
        const existingFooter = m.querySelector('.pf-modal-footer');
        if(existingFooter) existingFooter.remove();

        mBody.innerHTML = '<div class="pf-modal-loading">Loading fitment data...</div>';
        mTitle.textContent = title || 'Vehicle Fitment';
        
        m.classList.add('open');
        toggleScrollLock(true); // Lock scroll

        try {
            const data = await fetchData('/item/getFitmentMachines', { itemNumber: sku }, true);
            
            if(data && data.fitments && data.fitments.length > 0) {
                data.fitments.sort((a, b) => {
                    if(a.fitmentMake !== b.fitmentMake) return a.fitmentMake.localeCompare(b.fitmentMake);
                    if(a.fitmentModel !== b.fitmentModel) return a.fitmentModel.localeCompare(b.fitmentModel);
                    return b.fitmentYears.localeCompare(a.fitmentYears, undefined, {numeric: true});
                });

                let html = '<table class="pf-fitment-table"><thead><tr><th>Make</th><th>Model</th><th>Year(s)</th></tr></thead><tbody>';
                data.fitments.forEach(m => {
                    html += `<tr><td>${m.fitmentMake}</td><td>${m.fitmentModel}</td><td>${m.fitmentYears}</td></tr>`;
                });
                html += '</tbody></table>';
                mBody.innerHTML = html;
            } else {
                mBody.innerHTML = '<div class="pf-modal-loading">No specific machine fitment data returned.</div>';
            }
        } catch(e) {
            mBody.innerHTML = '<div class="pf-error">Error loading fitment data.</div>';
        }
    }

    // --- REFRESH CART DRAWER FUNCTION (Silent Update) ---
    async function refreshCartDrawer() {
        console.log('PF: Starting Silent Cart Update...');

        // 1. Update Cart Count Bubbles
        try {
            const cartRes = await fetch(window.Shopify.routes.root + 'cart.js');
            const cartData = await cartRes.json();
            
            const badgeSelectors = '.cart-count-bubble, .cart-count, [data-cart-count], .header__cart-count, .header-cart__count';
            document.querySelectorAll(badgeSelectors).forEach(el => {
                el.textContent = cartData.item_count;
                el.classList.remove('hidden');
                el.style.display = 'block'; 
            });
        } catch (e) { console.error('PF: Error updating badges', e); }

        // 2. Update Drawer HTML
        try {
            const pageRes = await fetch(window.location.href);
            const pageText = await pageRes.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(pageText, 'text/html');

            const selectorMap = [
                { target: '#header-mini-cart-content', source: '#header-mini-cart-content' }, 
                { target: '#HeaderMiniCart form', source: '#HeaderMiniCart form' }
            ];

            for (const map of selectorMap) {
                const currentEl = document.querySelector(map.target);
                const newEl = doc.querySelector(map.source);

                if (currentEl && newEl) {
                    if(map.target === '#HeaderMiniCart') {
                         currentEl.innerHTML = newEl.innerHTML;
                    } else {
                         currentEl.replaceWith(newEl);
                    }
                    console.log(`PF: Silently updated cart using ${map.target}`);
                    break;
                }
            }
        } catch (e) {
            console.error('PF: Error checking background cart', e);
        }
    }

    async function openSpecsModal(sku, title, variantId, available, inventoryQty, inventoryPolicy, inventoryManagement) {
        const m = document.getElementById('pf-fitment-modal');
        const mBody = document.getElementById('pf-modal-body');
        
        const existingFooter = m.querySelector('.pf-modal-footer');
        if(existingFooter) existingFooter.remove();

        const mTitle = m.querySelector('.pf-modal-title');
        
        mBody.innerHTML = '<div class="pf-modal-loading">Fetching technical specifications...</div>';
        mTitle.textContent = title ? `Specs: ${title}` : 'Product Specifications';
        
        m.classList.add('open');
        toggleScrollLock(true); // Lock scroll

        try {
            const [detailsData, inventoryData] = await Promise.all([
                fetchData('/item/getDetail', { itemNumber: sku }, true),
                fetchData('/inventory', { partNumber: sku }, false)
            ]);
            
            if(detailsData && detailsData.details) {
                const specs = detailsData.details.techSpecs;
                const desc = detailsData.details.extendedDescription;
                const img = detailsData.details.imgRef;
                
                let html = '<div class="pf-specs-content">';
                
                if(img) {
                    const imgSrc = img.startsWith('/') ? `https://www.gammasales.com/images${img}` : img;
                     html += `<div style="text-align:center; margin-bottom:20px;"><img src="${imgSrc}" style="max-height:200px; width:auto;"></div>`;
                }

                if (specs) { html += `<h4>Technical Specifications</h4><div>${specs}</div>`; }
                if (desc) { html += `<h4 style="margin-top:15px;">Description</h4><div>${desc}</div>`; }
                if (!specs && !desc) { html += '<p>No specific technical data available for this item.</p>'; }
                
                html += '</div>';
                mBody.innerHTML = html;

                if (variantId && variantId !== "undefined" && variantId !== "null") {
                    const footer = document.createElement('div');
                    footer.className = 'pf-modal-footer';
                    
                    const isAvailable = available === 'true';
                    let maxQty = 999;
                    let stockText = "";
                    
                    let liveQty = 0;
                    if (inventoryData && inventoryData.inventoryLevel) {
                        liveQty = parseInt(inventoryData.inventoryLevel.quantity) || 0;
                    } else {
                        liveQty = parseInt(inventoryQty) || 0;
                    }

                    if (isAvailable) {
                        if (liveQty > 0) {
                            stockText = `${liveQty} in Stock`;
                        } else {
                            stockText = "In Stock"; 
                        }
                    }

                    if (inventoryManagement === 'shopify' && inventoryPolicy === 'deny') {
                        maxQty = liveQty > 0 ? liveQty : 1; 
                    }

                    let innerHTML = '';
                    
                    if (isAvailable) {
                        innerHTML = `
                        <div class="pf-qty-wrapper">
                            <div class="pf-qty-row">
                                <label class="pf-qty-label" for="pf-modal-qty">Qty:</label>
                                <input type="number" id="pf-modal-qty" class="pf-qty-input" value="1" min="1" max="${maxQty}">
                            </div>
                            <div class="pf-stock-info">${stockText}</div>
                        </div>
                        <button type="button" class="pf-btn-modal-atc">Add to Cart</button>`;
                    } else {
                        innerHTML = `<button type="button" class="pf-btn-modal-atc" disabled>Out of Stock</button>`;
                    }
                    
                    footer.innerHTML = innerHTML;
                    m.querySelector('.pf-modal-content').appendChild(footer);

                    const atcBtn = footer.querySelector('.pf-btn-modal-atc');

                    if(atcBtn && isAvailable) {
                        const qtyInput = footer.querySelector('#pf-modal-qty');
                        if(qtyInput) {
                            qtyInput.addEventListener('change', function() {
                                let val = parseInt(this.value);
                                if(val < 1) this.value = 1;
                                if(val > maxQty) this.value = maxQty;
                            });
                        }

                        atcBtn.addEventListener('click', async () => {
                            const finalQtyInput = document.getElementById('pf-modal-qty');
                            let qtyToAdd = 1;
                            if (finalQtyInput) {
                                qtyToAdd = parseInt(finalQtyInput.value);
                                if (isNaN(qtyToAdd) || qtyToAdd < 1) qtyToAdd = 1;
                            }

                            atcBtn.disabled = true;
                            atcBtn.textContent = 'Adding...';
                            
                            try {
                                const response = await fetch(window.Shopify.routes.root + 'cart/add.js', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ items: [{ id: parseInt(variantId), quantity: qtyToAdd }] })
                                });
                                
                                if(response.ok) {
                                    atcBtn.classList.add('success');
                                    atcBtn.textContent = 'Added!';
                                    
                                    await refreshCartDrawer();

                                    setTimeout(() => {
                                        atcBtn.disabled = false;
                                        atcBtn.classList.remove('success');
                                        atcBtn.textContent = 'Add to Cart';
                                    }, 3000);

                                } else {
                                    throw new Error('Failed to add');
                                }
                            } catch(err) {
                                atcBtn.disabled = false;
                                atcBtn.textContent = 'Add to Cart';
                                const msg = document.createElement('span');
                                msg.className = 'pf-modal-error-msg';
                                msg.textContent = 'Error adding item.';
                                if(!footer.querySelector('.pf-modal-error-msg')) footer.insertBefore(msg, footer.firstChild);
                            }
                        });
                    }
                }

            } else {
                mBody.innerHTML = '<div class="pf-modal-loading">No details found for this item.</div>';
            }
        } catch(e) {
            console.error(e);
            mBody.innerHTML = '<div class="pf-error">Error loading specifications.</div>';
        }
    }
    
    // --- GLOBAL CLICK LISTENER ---
    document.addEventListener('click', function(e) {
        const specsBtn = e.target.closest('.pf-specs-btn');
        if(specsBtn) {
            e.preventDefault();
            e.stopPropagation();
            
            const sku = specsBtn.dataset.sku;
            const title = specsBtn.dataset.title;
            const variantId = specsBtn.dataset.variantId;
            const available = specsBtn.dataset.available;
            const invQty = specsBtn.dataset.inventoryQty;
            const invPolicy = specsBtn.dataset.inventoryPolicy;
            const invMgmt = specsBtn.dataset.inventoryManagement;
            
            openSpecsModal(sku, title, variantId, available, invQty, invPolicy, invMgmt);
            return;
        }

        const fitBtn = e.target.closest('.pf-fitment-btn');
        if(fitBtn) {
            e.preventDefault();
            e.stopPropagation();
            const sku = fitBtn.dataset.sku;
            const title = fitBtn.dataset.title;
            openFitmentModal(sku, title);
            return;
        }

        const contactBtn = e.target.closest('.pf-btn-contact');
        if(contactBtn) {
            e.stopPropagation();
            return; 
        }

        const card = e.target.closest('.pf-result-card');
        if(card && !fitBtn && !contactBtn && !specsBtn) {
            const url = card.dataset.href;
            if (url) {
                window.location.href = url;
            }
        }
    });

    let isExpanded = false;
    if(els.header) {
        els.header.addEventListener('click', () => toggleSection(!isExpanded));
    }

    function toggleSection(open) {
        isExpanded = open;
        if (open) {
            els.body.style.display = 'block';
            els.body.style.maxHeight = els.body.scrollHeight + "px";
            section.classList.add('pf-open');
            section.classList.remove('pf-closed');
            setTimeout(() => { els.body.style.maxHeight = 'none'; }, 300);
        } else {
            els.body.style.maxHeight = els.body.scrollHeight + "px";
            void els.body.offsetHeight; 
            els.body.style.maxHeight = '0px';
            setTimeout(() => { if(!isExpanded) els.body.style.display = 'none'; }, 300);
            section.classList.remove('pf-open');
            section.classList.add('pf-closed');
        }
    }
    toggleSection(false);

    // --- MASTER MODEL NORMALIZATION ---
    function normalizeModelName(model) {
        if (!model) return null;
        let s = model.toUpperCase();
        const noise = /\b(POWER STEERING|AUTOMATIC|AUTO|MANUAL|ABS|EPS|SE|LE|H\.O\.|HO|EFI|4X4|2X4|4WD|2WD|AXI|DCT|LIMITED|LTD|TOURING|XT|DPS|XMR|XXC|XT-P|HUNTER|EDITION|CAMO|SPORT|UTILITY|PLUS|AS|FS|FSI|ASI|IRS|TBX|TRV|VP|FIS|ACT|MRP|ALL|GPA|GPH|GPS|KDH|KDX|KPA|KPH|KPS|AE|ES|SD|ESD|XN|LF|FA\d|FE\d|FM\d|TE\d|TM\d|S|R|RS|RR|XC|SP|L|M|N|F)\b/g;
        s = s.replace(noise, "");
        s = s.replace(/KING\s*QUAD/g, "KINGQUAD").replace(/BIG\s*BEAR/g, "BIG BEAR").replace(/SILVER\s*ADO/g, "SILVERADO").replace(/TRAIL\s*BOSS/g, "TRAIL BOSS").replace(/TRAIL\s*BLAZER/g, "TRAIL BLAZER").replace(/QUAD\s*SPORT/g, "QUADSPORT").replace(/QUAD\s*RACER/g, "QUADRACER").replace(/QUAD\s*RUNNER/g, "QUADRUNNER").replace(/FOUR\s*TRAX/g, "FOURTRAX").replace(/GOLD\s*WING/g, "GOLDWING").replace(/V\s*STROM/g, "V-STROM").replace(/FZ-1/g, "FZ1").replace(/FZ-6/g, "FZ6").replace(/FZ-8/g, "FZ8").replace(/FJR\s*1300/g, "FJR1300").replace(/MT\s*0/g, "MT-0");
        const families = ["KINGQUAD", "EIGER", "VINSON", "OZARK", "QUADRUNNER", "TWIN PEAKS", "QUADSPORT", "QUADRACER", "SPORTSMAN", "SCRAMBLER", "RANGER", "RZR", "MAGNUM", "XPEDITION", "TRAIL BLAZER", "TRAIL BOSS", "HAWKEYE", "ACE", "GENERAL", "GRIZZLY", "KODIAK", "RAPTOR", "BANSHEE", "BIG BEAR", "WOLVERINE", "BRUIN", "RHINO", "YXZ", "VIKING", "BLASTER", "WARRIOR", "OUTLANDER", "RENEGADE", "COMMANDER", "MAVERICK", "TRAXTER", "QUEST", "DEFENDER", "RANCHER", "FOREMAN", "RUBICON", "RINCON", "RECON", "FOURTRAX", "PIONEER", "TALON", "BRUTE FORCE", "PRAIRIE", "BAYOU", "MULE", "TERYX", "ALTERRA", "THUNDERCAT", "MUDPRO", "PROWLER", "WILDCAT", "CFORCE", "UFORCE", "ZFORCE", "KATANA", "HAYABUSA", "V-STROM", "INTRUDER", "MARAUDER", "VOLUSIA", "SAVAGE", "BANDIT", "GLADIUS", "BOULEVARD", "BURGMAN", "NINJA", "VULCAN", "VERSYS", "CONCOURS", "KLR", "KLX", "GOLDWING", "SHADOW", "VALKYRIE", "MAGNA", "REBEL", "INTERCEPTOR", "AFRICA TWIN", "GROM", "RUCKUS", "METROPOLITAN", "V-STAR", "ROAD STAR", "ROYAL STAR", "STRATOLINER", "ROADLINER", "RAIDER", "BOLT", "VIRAGO", "MAXIM", "SECA", "VINO", "ZUMA", "MAJESTY", "CRYPTON", "ENTICER", "FAZER", "TENERE", "SUPER TENERE", "INDY", "RMK", "SWITCHBACK", "RUSH", "ASSAULT", "VOYAGEUR", "MXZ", "SUMMIT", "RENEGADE", "GRAND TOURING", "SKANDIC", "TUNDRA", "FREERIDE", "ZR", "ZL", "PANTERA", "PANTHER", "FIRECAT", "CROSSFIRE", "M-SERIES", "SNO PRO"];
        let foundFamily = null;
        for (const fam of families) { if (s.includes(fam)) { foundFamily = fam; break; } }
        const ccMatch = s.match(/\b(50|60|65|80|85|90|100|110|125|135|150|170|175|185|200|225|230|250|300|325|330|335|350|375|400|425|450|500|520|550|570|600|650|660|680|700|750|800|850|900|925|950|1000|1100|1200|1300|1400|1500|1600|1700|1800|1900|2000)\b/);
        const cc = ccMatch ? ccMatch[0] : null;
        const codeMatch = s.match(new RegExp(`\\b(GS|GSX|GSXR|GR|GN|GV|GL|DR|DRZ|RM|RMZ|ZR|ZL|VL|VZ|AN|DL|SV|LT|LTA|LTF|LTZ|LTR|CB|CBR|VFR|VT|VTX|GL|ST|XR|XL|CRF|TRX|SXS|YZF|FZ|FJR|MT|XT|TTR|PW|XV|XVS|YFM|YFZ|YXZ|YXR|XSR|TMAX|XMAX|ZX|KX|KLX|VN|KZ|KVF|KLF|KRF|CF)(-?[A-Z]*)?\\s*(\\d{1,4})([A-Z0-9]*)?\\b`));
        if (codeMatch) {
            let rawPrefix = codeMatch[1];
            let codeCC = codeMatch[3];
            if (foundFamily) return codeCC ? `${foundFamily} ${codeCC}` : foundFamily; 
            return `${rawPrefix}${codeCC}`; 
        }
        if (foundFamily && cc) { return `${foundFamily} ${cc}`; }
        let clean = s.replace(/[^a-zA-Z0-9\-\s]/g, "").replace(/\s+/g, " ").trim();
        return clean.length > 1 ? clean : model;
    }

    function processAndPopulateModels(rawModelsList) {
        modelMap = {}; 
        const distinctCleanModels = new Set();
        rawModelsList.forEach(rawModel => {
            const cleanName = normalizeModelName(rawModel) || rawModel;
            if (!modelMap[cleanName]) modelMap[cleanName] = [];
            modelMap[cleanName].push(rawModel);
            distinctCleanModels.add(cleanName);
        });
        const sortedModels = Array.from(distinctCleanModels).sort();
        els.model.innerHTML = '<option value="">Select Model</option>';
        sortedModels.forEach(cleanName => {
            const option = document.createElement('option');
            option.value = cleanName; 
            const count = modelMap[cleanName].length;
            if (count > 1) { option.textContent = `${cleanName} +`; } else { option.textContent = cleanName; }
            els.model.appendChild(option);
        });
        els.model.disabled = false;
    }

    function getDropdownCache(key) {
        const item = localStorage.getItem(DROPDOWN_CACHE_PREFIX + key);
        if (!item) return null;
        try {
            const parsed = JSON.parse(item);
            if (Date.now() - parsed.ts > config.dropdownCacheDuration) {
                localStorage.removeItem(DROPDOWN_CACHE_PREFIX + key);
                return null;
            }
            return parsed.data;
        } catch (e) { return null; }
    }

    function setDropdownCache(key, data) {
        try {
            localStorage.setItem(DROPDOWN_CACHE_PREFIX + key, JSON.stringify({
                ts: Date.now(),
                data: data
            }));
        } catch (e) { }
    }

    async function fetchData(endpoint, params = {}, useCache = false) {
        const queryString = new URLSearchParams(params).toString();
        const cacheKey = `${endpoint}?${queryString}`;
        if (useCache) {
            const cached = getDropdownCache(cacheKey);
            if (cached) return cached;
        }
        const url = new URL(`${config.baseUrl}${endpoint}`);
        Object.keys(params).forEach(key => {
            if(params[key]) url.searchParams.append(key, params[key]);
        });
        try {
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${config.token}`, 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const json = await response.json();
            if (useCache && json.data) { setDropdownCache(cacheKey, json.data); }
            return json.data;
        } catch (err) { return null; }
    }

    async function fetchArrivalDate(sku) {
        if(!sku) return null;
        try {
            const data = await fetchData('/inventory/getEstimatedArrivalsForItem', { partNumber: sku }, false);
            if (data && data.arrivalDates && Array.isArray(data.arrivalDates) && data.arrivalDates.length > 0) {
                const sorted = data.arrivalDates.sort((a, b) => new Date(a.eta) - new Date(b.eta));
                const nextArrival = sorted[0];
                const dateObj = new Date(nextArrival.eta);
                const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                return {
                    date: dateStr,
                    type: nextArrival.etaType === 'CARGO' ? 'Confirmed' : 'Est.',
                    qty: nextArrival.qty
                };
            }
        } catch (e) {}
        return null;
    }

    async function fetchGammaProductDetails(sku) {
        if (!sku) return null;
        try {
            const data = await fetchData('/item/getDetail', { itemNumber: sku }, true);
            if (data && data.details) {
                return data;
            }
        } catch (e) {}
        return null;
    }

    function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

    async function searchShopifyProduct(sku, retryCount = 0) {
        const cleanSku = sku ? sku.toString().trim() : '';
        if (!cleanSku) return null;
        if (skuCache.has(cleanSku) && skuCache.get(cleanSku) !== null) return skuCache.get(cleanSku);
        let productHandle = null;
        try {
            const safeSku = cleanSku.replace(/"/g, '');
            const encodedSkuQuery = encodeURIComponent(`variants.sku:"${safeSku}"`);
            const suggestUrl = `/search/suggest.json?q=${encodedSkuQuery}&resources[type]=product&resources[limit]=1&resources[options][unavailable_products]=show&resources[fields]=handle&_t=${Date.now()}`;
            const suggestResponse = await fetch(suggestUrl);
            if (suggestResponse.status === 429 || suggestResponse.status >= 500) {
                if (retryCount < 3) {
                    const waitTime = 1000 * Math.pow(2, retryCount);
                    await delay(waitTime);
                    return searchShopifyProduct(sku, retryCount + 1);
                }
                return null;
            }
            if (suggestResponse.ok) {
                const json = await suggestResponse.json();
                if (json.resources?.results?.products?.length > 0) productHandle = json.resources.results.products[0].handle;
            }
        } catch (error) {
            if (retryCount < 1) { await delay(1000); return searchShopifyProduct(sku, retryCount + 1); }
        }
        if (productHandle) {
            try {
                const productResponse = await fetch(`/products/${productHandle}.js`);
                if (productResponse.status === 429 || productResponse.status >= 500) {
                    if (retryCount < 3) {
                        await delay(1000);
                        return searchShopifyProduct(sku, retryCount + 1);
                    }
                }
                if (productResponse.ok) {
                    const data = await productResponse.json();
                    const target = cleanSku.toLowerCase();
                    const variant = data.variants.find(v => v.sku && String(v.sku).trim().toLowerCase() === target) || data.variants[0];
                    const result = { product: data, variant: variant };
                    skuCache.set(cleanSku, result);
                    return result;
                }
            } catch (e) {}
        }
        skuCache.set(cleanSku, null);
        return null;
    }

    function showError(msg) {
        els.error.textContent = msg;
        els.error.classList.remove('hidden');
        toggleSection(true); 
    }
    function clearError() { els.error.textContent = ''; els.error.classList.add('hidden'); }
    function showStatus(msg) { els.status.textContent = msg; els.status.classList.remove('hidden'); }
    function hideStatus() { els.status.classList.add('hidden'); }
    function resetSelect(el, txt) { el.innerHTML = `<option value="">${txt}</option>`; el.disabled = true; }
    function populateSelect(el, opts, defaultText) {
        el.innerHTML = `<option value="">${defaultText}</option>`;
        opts.forEach(o => { const op = document.createElement('option'); op.value = o; op.textContent = o; el.appendChild(op); });
        el.disabled = false;
    }
    function setSelectLoading(el) { el.innerHTML = `<option>Loading...</option>`; el.disabled = true; }

    function sortProducts(products) {
        return products.sort((a, b) => {
            const catA = (a.subCategory || '').toString().trim();
            const catB = (b.subCategory || '').toString().trim();
            const catCmp = catA.localeCompare(catB, undefined, { sensitivity: 'base' });
            if (catCmp !== 0) return catCmp;
            const descA = (a.description || a.title || '').toString().trim();
            const descB = (b.description || b.title || '').toString().trim();
            return descA.localeCompare(descB, undefined, { sensitivity: 'base' });
        });
    }

    function saveGarageSelection() {
        try {
            const vehicleData = {
                type: els.type.value,
                year: els.year.value,
                make: els.make.value,
                model: els.model.value
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(vehicleData));
        } catch (e) {}
    }

    function saveGarageResults(products) {
        try {
            const validProducts = products.filter(item => item !== null && item !== undefined);
            const cacheData = { timestamp: Date.now(), products: validProducts };
            localStorage.setItem(RESULTS_CACHE_KEY, JSON.stringify(cacheData));
        } catch (e) {}
    }

    async function loadFromGarage() {
        const storedSelection = localStorage.getItem(STORAGE_KEY);
        if (!storedSelection) return false;
        try {
            const vehicle = JSON.parse(storedSelection);
            if (!vehicle.type || !vehicle.year || !vehicle.make || !vehicle.model) return false;
            els.type.value = vehicle.type; state.type = vehicle.type;
            setSelectLoading(els.year);
            const yearsData = await fetchData('/fitment/getYearOptions', { type: state.type }, true);
            if (yearsData && yearsData.years) { populateSelect(els.year, yearsData.years, 'Select Year'); els.year.value = vehicle.year; state.year = vehicle.year; }
            setSelectLoading(els.make);
            const makesData = await fetchData('/fitment/getMakeOptions', { type: state.type, year: state.year }, true);
            if (makesData && makesData.makes) { populateSelect(els.make, makesData.makes, 'Select Make'); els.make.value = vehicle.make; state.make = vehicle.make; }
            setSelectLoading(els.model);
            const modelsData = await fetchData('/fitment/getModelOptions', { type: state.type, year: state.year, make: state.make }, true);
            if (modelsData && modelsData.models) { 
                processAndPopulateModels(modelsData.models);
                els.model.value = vehicle.model; 
                state.model = vehicle.model; 
            }
            els.submit.disabled = false;
            const cachedResults = localStorage.getItem(RESULTS_CACHE_KEY);
            if (cachedResults) {
                const cache = JSON.parse(cachedResults);
                const age = Date.now() - cache.timestamp;
                if (age < config.cacheDuration && Array.isArray(cache.products) && cache.products.length > 0) {
                    const sortedCached = sortProducts(cache.products);
                    setupFilter(sortedCached);
                    renderCachedCards(sortedCached);
                    return true;
                }
            }
            return true;
        } catch (e) {
            console.warn('Failed to load garage data', e);
            return false;
        }
    }

    async function init() {
        setSelectLoading(els.type);
        const data = await fetchData('/fitment/getTypeOptions', {}, true);
        if (data && data.types) {
            populateSelect(els.type, data.types, 'Select Type');
            await loadFromGarage();
        } else {
            resetSelect(els.type, 'Select Type');
        }
    }

    els.type.addEventListener('change', async function() {
        state.type = this.value; resetDownstream('type');
        if(!state.type) return;
        setSelectLoading(els.year);
        const data = await fetchData('/fitment/getYearOptions', { type: state.type }, true);
        if(data && data.years) populateSelect(els.year, data.years, 'Select Year');
    });

    els.year.addEventListener('change', async function() {
        state.year = this.value; resetDownstream('year');
        if(!state.year) return;
        setSelectLoading(els.make);
        const data = await fetchData('/fitment/getMakeOptions', { type: state.type, year: state.year }, true);
        if(data && data.makes) populateSelect(els.make, data.makes, 'Select Make');
    });

    els.make.addEventListener('change', async function() {
        state.make = this.value; resetDownstream('make');
        if(!state.make) return;
        setSelectLoading(els.model);
        const data = await fetchData('/fitment/getModelOptions', { type: state.type, year: state.year, make: state.make }, true);
        if(data && data.models) {
            processAndPopulateModels(data.models);
        }
    });

    els.model.addEventListener('change', function() {
        state.model = this.value;
        els.submit.disabled = !state.model;
    });

    function resetDownstream(level) {
        if (level === 'type') { resetSelect(els.year, 'Select Year'); resetSelect(els.make, 'Select Make'); resetSelect(els.model, 'Select Model'); }
        else if (level === 'year') { resetSelect(els.make, 'Select Make'); resetSelect(els.model, 'Select Model'); }
        else if (level === 'make') { resetSelect(els.model, 'Select Model'); }
        els.submit.disabled = true;
        els.results.innerHTML = '';
        els.results.classList.add('hidden');
        els.filterWrapper.classList.add('hidden');
        localStorage.removeItem(RESULTS_CACHE_KEY);
        modelMap = {}; 
    }

    els.reset.addEventListener('click', function() {
        els.type.value = "";
        state = { type: '', year: '', make: '', model: '' };
        resetDownstream('type');
        localStorage.removeItem(STORAGE_KEY); 
        localStorage.removeItem(RESULTS_CACHE_KEY);
    });

    els.submit.addEventListener('click', async function() {
        saveGarageSelection();
        els.results.innerHTML = '';
        els.results.classList.add('hidden');
        els.filterWrapper.classList.add('hidden');
        hideStatus();
        clearError();
        showStatus('Fetching parts list...');
        els.submit.disabled = true; els.reset.disabled = true;

        const selectedCleanModel = els.model.value;
        const variationsToSearch = modelMap[selectedCleanModel] || [selectedCleanModel];

        let allProducts = [];
        const batchSize = 4; 

        for (let i = 0; i < variationsToSearch.length; i += batchSize) {
            const batch = variationsToSearch.slice(i, i + batchSize);
            const promises = batch.map(realModel => 
                fetchData('/fitment/getFitmentProducts', { 
                    make: state.make, 
                    year: state.year, 
                    model: realModel 
                }, true)
            );
            const results = await Promise.all(promises);
            results.forEach(r => {
                if (r && r.fitmentProducts) {
                    allProducts = allProducts.concat(r.fitmentProducts);
                }
            });
        }
        
        if (allProducts.length === 0) {
            showError('No products found.');
            els.submit.disabled = false; els.reset.disabled = false;
            hideStatus();
            return;
        }

        const uniqueItems = []; const seen = new Set();
        allProducts.forEach(i => {
            const s = i.itemNumber ? i.itemNumber.toString().trim() : '';
            if(s && !seen.has(s)) { seen.add(s); uniqueItems.push(i); }
        });

        const sortedItems = sortProducts(uniqueItems);
        setupFilter(sortedItems);
        renderSkeletons(sortedItems);
        const finalResults = await processQueue(sortedItems);
        saveGarageResults(finalResults);

        els.submit.disabled = false; els.reset.disabled = false;
        if(!isExpanded) toggleSection(true);
    });

    function setupFilter(items) {
        const subCats = new Set(items.map(i => i.subCategory || i.gammaItem?.subCategory).filter(Boolean));
        const sorted = Array.from(subCats).sort();
        els.filter.innerHTML = '<option value="all">All Categories</option>';
        sorted.forEach(cat => { const o = document.createElement('option'); o.value = cat; o.textContent = cat; els.filter.appendChild(o); });
        els.filterWrapper.classList.remove('hidden');
    }

    els.filter.addEventListener('change', function() {
        const val = this.value;
        const cards = els.results.querySelectorAll('.pf-result-card');
        cards.forEach(c => { c.classList.toggle('hidden', val !== 'all' && c.dataset.cat !== val); });
        const dividers = els.results.querySelectorAll('.pf-category-divider');
        dividers.forEach(d => { d.classList.toggle('hidden', val !== 'all'); });
    });

    function renderSkeletons(items) {
        els.results.classList.remove('hidden');
        let lastCat = null;
        items.forEach((item, idx) => {
            const currentCat = (item.subCategory || 'Other Parts').toString();
            if (currentCat !== lastCat) {
                const div = document.createElement('div');
                div.className = 'pf-category-divider';
                div.textContent = currentCat;
                els.results.appendChild(div);
                lastCat = currentCat;
            }
            const card = document.createElement('div');
            card.id = `pf-card-idx-${idx}`; card.className = 'pf-result-card pf-loading';
            card.dataset.cat = item.subCategory; 
            card.innerHTML = `<div class="pf-card-image-wrapper"><div class="pf-img-placeholder"></div></div>
                <div class="pf-card-info"><div class="pf-card-title">${item.description}</div>
                <div class="pf-card-sku">Part #: ${item.itemNumber}</div>
                <div class="pf-card-meta"><span class="pf-loading-text">Waiting...</span></div></div>`;
            els.results.appendChild(card);
        });
    }

    function renderCachedCards(cachedItems) {
        els.results.classList.remove('hidden');
        let lastCat = null;
        cachedItems.forEach((item, idx) => {
            if (!item) return;
            const currentCat = (item.subCategory || 'Other Parts').toString();
            if (currentCat !== lastCat) {
                const div = document.createElement('div');
                div.className = 'pf-category-divider';
                div.textContent = currentCat;
                els.results.appendChild(div);
                lastCat = currentCat;
            }
            const card = document.createElement('div');
            card.id = `pf-card-idx-${idx}`; 
            
            const fitmentBtn = `<button class="pf-fitment-btn" type="button" data-sku="${item.sku}" data-title="${item.title.replace(/"/g, '&quot;')}">Fitment</button>`;
            
            // --- Prepare dynamic attributes for Specs button (Using existing cache) ---
            const specsBtn = `<button class="pf-specs-btn" type="button" 
                data-sku="${item.sku}" 
                data-title="${item.title.replace(/"/g, '&quot;')}" 
                data-variant-id="${item.variantId || ''}" 
                data-available="${item.available}"
                data-inventory-qty="${item.inventoryQty || 0}"
                data-inventory-policy="${item.inventoryPolicy || ''}"
                data-inventory-management="${item.inventoryManagement || ''}">
                Specs</button>`;
            
            const actionRow = `<div class="pf-action-row">${specsBtn}${fitmentBtn}</div>`;

            if (item.found) {
                card.className = 'pf-result-card pf-match';
                card.dataset.href = item.url;
                card.dataset.cat = item.subCategory;
                const cls = item.available ? 'pf-in-stock' : 'pf-out-stock';
                const txt = item.available ? 'In Stock' : 'Out of Stock';
                const price = `<span class="pf-price">$${(item.price/100).toFixed(2)}</span>`;
                
                let etaHtml = '';
                if (!item.available) {
                   let label = 'Arrival date:';
                   let value = 'No date';
                   if (item.arrivalData) {
                       value = item.arrivalData.date;
                       label = item.arrivalData.type === 'Confirmed' ? 'Arrival date confirmed :' : 'Arrival date Estimated :';
                   }
                   etaHtml = `<div class="pf-eta-info"><span class="pf-eta-label">${label}</span><span class="pf-eta-date">${value}</span></div>`;
                }
                
                card.innerHTML = `
                    <div class="pf-card-image-wrapper"><img src="${item.image}" alt="${item.title}" loading="lazy"></div>
                    <div class="pf-card-info">
                        <div class="pf-card-title">${item.title}</div>
                        <div class="pf-card-sku">Part #: ${item.sku}</div>
                        <div class="pf-card-cats">${item.subCategory || ''}</div>
                        <div class="pf-card-meta">
                             <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">${price}<span class="pf-badge ${cls}">${txt}</span></div>
                             ${etaHtml}
                             ${actionRow}
                        </div>
                    </div>`;
            } else {
                card.className = 'pf-result-card pf-no-match';
                card.dataset.cat = item.subCategory;
                
                let imgContent = `<div class="pf-img-placeholder no-img"><span>Catalog Item</span></div>`;
                if(item.gammaImage) {
                    imgContent = `<img src="${item.gammaImage}" alt="${item.title}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                                  <div class="pf-img-placeholder no-img" style="display:none;"><span>Catalog Item</span></div>`;
                }
                
                let priceHtml = '';
                if (item.msrp) {
                    priceHtml = `<div class="pf-price-container" style="margin-bottom:8px; font-weight:bold; color:#333;"><span class="pf-price-label">MSRP:</span> <span class="pf-price">$${item.msrp.toFixed(2)}</span></div>`;
                }
                
                const mailSubject = encodeURIComponent(`Inquiry: ${item.title} (Part #${item.sku})`);
                const contactBtn = `<a href="mailto:info@gammapowersports.com?subject=${mailSubject}" class="pf-btn-contact">Contact to Reserve</a>`;
                
                let etaHtml = '';
                let label = 'Arrival date:';
                let value = 'No date';
                if (item.arrivalData) {
                     value = item.arrivalData.date;
                     label = item.arrivalData.type === 'Confirmed' ? 'Arrival date confirmed :' : 'Arrival date Estimated :';
                }
                etaHtml = `<div class="pf-eta-info"><span class="pf-eta-label">${label}</span><span class="pf-eta-date">${value}</span></div>`;

                const fitmentBtn = `<button class="pf-fitment-btn" type="button" data-sku="${cacheObj.sku}" data-title="${cacheObj.title.replace(/"/g, '&quot;')}">Fitment</button>`;
                const specsBtn = `<button class="pf-specs-btn" type="button" data-sku="${cacheObj.sku}" data-title="${cacheObj.title.replace(/"/g, '&quot;')}">Specs</button>`;
                const actionRow = `<div class="pf-action-row">${specsBtn}${fitmentBtn}</div>`;

                metaEl.innerHTML = `
                    <div style="width:100%;">
                        ${priceHtml}
                        <span class="pf-badge pf-special-order" style="width:100%; text-align:center; margin-bottom:8px;">Not available yet</span>
                        ${contactBtn}
                        ${etaHtml}
                        ${actionRow}
                    </div>`;
            }
            els.results.appendChild(card);
        });
    }

    async function processQueue(items) {
        await delay(100);
        let completed = 0; let qIdx = 0;
        const updateStatus = () => showStatus(`Checking availability... ${completed} / ${items.length}`);
        updateStatus();
        const resultsToCache = new Array(items.length);
        const worker = async () => {
            while(qIdx < items.length) {
                const i = qIdx++; const item = items[i];
                const card = document.getElementById(`pf-card-idx-${i}`);
                if(card) card.querySelector('.pf-loading-text').textContent = 'Checking...';
                
                const res = await searchShopifyProduct(item.itemNumber);
                let arrivalData = null;
                let gammaDetails = null;

                if (res && res.variant) {
                    if (!res.variant.available) {
                        if(card) card.querySelector('.pf-loading-text').textContent = 'Checking dates...';
                        arrivalData = await fetchArrivalDate(item.itemNumber);
                    }
                } 
                else {
                    if(card) card.querySelector('.pf-loading-text').textContent = 'Fetching catalog details...';
                    gammaDetails = await fetchGammaProductDetails(item.itemNumber);
                    arrivalData = await fetchArrivalDate(item.itemNumber);
                }

                const cachedItem = updateCard(i, item, res, arrivalData, gammaDetails);
                resultsToCache[i] = cachedItem;
                completed++;
                if(completed % 5 === 0) updateStatus();
            }
        };
        const workers = [];
        for(let i=0; i<config.concurrency; i++) workers.push(worker());
        await Promise.all(workers);
        showStatus(`Done. ${completed} processed.`);
        setTimeout(hideStatus, 4000);
        return resultsToCache;
    }

    function updateCard(idx, gammaItem, data, arrivalData, gammaDetails) {
        const card = document.getElementById(`pf-card-idx-${idx}`);
        if(!card) return null;
        card.classList.remove('pf-loading');
        const imgWrap = card.querySelector('.pf-card-image-wrapper');
        const titleEl = card.querySelector('.pf-card-title');
        const metaEl = card.querySelector('.pf-card-meta');
        
        const cacheObj = { 
            sku: gammaItem.itemNumber, 
            subCategory: gammaItem.subCategory, 
            found: false, 
            title: gammaItem.description,
            gammaImage: null,
            msrp: null
        };

        // --- SCENARIO 1: FOUND IN SHOPIFY ---
        if(data && data.product && data.variant) {
            cacheObj.found = true;
            cacheObj.title = data.product.title;
            cacheObj.url = `/products/${data.product.handle}?variant=${data.variant.id}`;
            cacheObj.image = data.variant.featured_image?.src || data.product.featured_image || 'https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png';
            cacheObj.price = data.variant.price;
            cacheObj.available = data.variant.available;
            cacheObj.variantId = data.variant.id; 
            cacheObj.inventoryQty = data.variant.inventory_quantity; // New: Store Qty
            cacheObj.inventoryPolicy = data.variant.inventory_policy; // New: Store Policy
            cacheObj.inventoryManagement = data.variant.inventory_management; // New: Store Mgmt
            cacheObj.arrivalData = arrivalData;
            
            card.classList.add('pf-match');
            card.dataset.href = cacheObj.url;
            
            imgWrap.innerHTML = `<img src="${cacheObj.image}" alt="${cacheObj.title}" loading="lazy">`;
            titleEl.textContent = cacheObj.title;
            
            const cls = cacheObj.available ? 'pf-in-stock' : 'pf-out-stock';
            const txt = cacheObj.available ? 'In Stock' : 'Out of Stock';
            const priceHtml = `<span class="pf-price">$${(cacheObj.price/100).toFixed(2)}</span>`;
            
            let etaHtml = '';
            if (!cacheObj.available) {
               let label = 'Arrival date:';
               let value = 'No date';
               if (arrivalData) {
                   value = arrivalData.date;
                   label = arrivalData.type === 'Confirmed' ? 'Arrival date confirmed :' : 'Arrival date Estimated :';
               }
               etaHtml = `<div class="pf-eta-info"><span class="pf-eta-label">${label}</span><span class="pf-eta-date">${value}</span></div>`;
            }

            const shopifyFitmentBtn = `<button class="pf-fitment-btn" type="button" data-sku="${cacheObj.sku}" data-title="${cacheObj.title.replace(/"/g, '&quot;')}">Fitment</button>`;
            const shopifySpecsBtn = `<button class="pf-specs-btn" type="button" 
                data-sku="${cacheObj.sku}" 
                data-title="${cacheObj.title.replace(/"/g, '&quot;')}" 
                data-variant-id="${data.variant.id}" 
                data-available="${cacheObj.available}"
                data-inventory-qty="${cacheObj.inventoryQty}"
                data-inventory-policy="${cacheObj.inventoryPolicy}"
                data-inventory-management="${cacheObj.inventoryManagement}">Specs</button>`;
            const shopifyActionRow = `<div class="pf-action-row">${shopifySpecsBtn}${shopifyFitmentBtn}</div>`;

            metaEl.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%;">${priceHtml}<span class="pf-badge ${cls}">${txt}</span></div>${etaHtml}${shopifyActionRow}`;
        } 
        // --- SCENARIO 2: NOT FOUND (SPECIAL ORDER) ---
        else {
            cacheObj.found = false;
            if (gammaDetails && gammaDetails.details && gammaDetails.details.imgRef) {
                cacheObj.gammaImage = gammaDetails.details.imgRef;
            }
            
            // Extract MSRP
            if (gammaDetails && gammaDetails.pricing && gammaDetails.pricing.msrp) {
                cacheObj.msrp = gammaDetails.pricing.msrp;
            }

            card.classList.add('pf-no-match');
            
            let imgContent = `<div class="pf-img-placeholder no-img"><span>Catalog Item</span></div>`;
            if (cacheObj.gammaImage) {
                 // Append Base URL if relative path
                 if(cacheObj.gammaImage.startsWith('/')) {
                     cacheObj.gammaImage = 'https://www.gammasales.com/images' + cacheObj.gammaImage;
                 }

                 imgContent = `<img src="${cacheObj.gammaImage}" alt="${cacheObj.title}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
                               <div class="pf-img-placeholder no-img" style="display:none;"><span>Catalog Item</span></div>`;
            }
            imgWrap.innerHTML = imgContent;
            
            // Corrected Title Reference (using cacheObj instead of item)
            titleEl.textContent = cacheObj.title || 'Unknown Part';
            titleEl.style.color = '#333'; 

            let priceHtml = '';
            if (cacheObj.msrp) {
                priceHtml = `<div class="pf-price-container" style="margin-bottom:8px; font-weight:bold; color:#333;"><span class="pf-price-label">MSRP:</span> <span class="pf-price">$${cacheObj.msrp.toFixed(2)}</span></div>`;
            }

            // Corrected Email Link Reference (using cacheObj)
            const mailSubject = encodeURIComponent(`Inquiry: ${cacheObj.title} (Part #${cacheObj.sku})`);
            const contactBtn = `<a href="mailto:info@gammapowersports.com?subject=${mailSubject}" class="pf-btn-contact">Contact to Reserve</a>`;
            
            let etaHtml = '';
            let label = 'Arrival date:';
            let value = 'No date';
            if (arrivalData) {
                 value = arrivalData.date;
                 label = arrivalData.type === 'Confirmed' ? 'Arrival date confirmed :' : 'Arrival date Estimated :';
            }
            etaHtml = `<div class="pf-eta-info"><span class="pf-eta-label">${label}</span><span class="pf-eta-date">${value}</span></div>`;

            const fitmentBtn = `<button class="pf-fitment-btn" type="button" data-sku="${cacheObj.sku}" data-title="${cacheObj.title.replace(/"/g, '&quot;')}">Fitment</button>`;
            const specsBtn = `<button class="pf-specs-btn" type="button" data-sku="${cacheObj.sku}" data-title="${cacheObj.title.replace(/"/g, '&quot;')}">Specs</button>`;
            const actionRow = `<div class="pf-action-row">${specsBtn}${fitmentBtn}</div>`;

            metaEl.innerHTML = `
                <div style="width:100%;">
                    ${priceHtml}
                    <span class="pf-badge pf-special-order" style="width:100%; text-align:center; margin-bottom:8px;">Not available yet</span>
                    ${contactBtn}
                    ${etaHtml}
                    ${actionRow}
                </div>`;
        }
        return cacheObj;
    }

    init();
});