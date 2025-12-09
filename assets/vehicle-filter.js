class VehicleFilter {
    constructor(container, apiToken, apiUrl) {
        this.container = container;
        this.apiToken = apiToken;
        this.apiUrl = apiUrl || 'https://api.gammapowersports.com';

        this.typeSelect = this.container.querySelector('[data-filter-type]');
        this.yearSelect = this.container.querySelector('[data-filter-year]');
        this.makeSelect = this.container.querySelector('[data-filter-make]');
        this.modelSelect = this.container.querySelector('[data-filter-model]');
        this.submitBtn = this.container.querySelector('[data-filter-submit]');
        this.resetBtn = this.container.querySelector('[data-filter-reset]');
        this.STORAGE_KEY = 'pf_my_garage';

        this.init();
    }

    init() {
        this.fetchTypes().then(() => {
            this.loadFromStorage();
        });
        this.addEventListeners();
    }

    addEventListeners() {
        this.typeSelect.addEventListener('change', () => this.onTypeChange());
        this.yearSelect.addEventListener('change', () => this.onYearChange());
        this.makeSelect.addEventListener('change', () => this.onMakeChange());
        this.modelSelect.addEventListener('change', () => this.updateState());
        this.submitBtn.addEventListener('click', () => this.onSubmit());

        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.onReset());
        }
    }

    async fetchFromApi(endpoint, params = {}) {
        const url = new URL(`${this.apiUrl}/${endpoint}`);
        Object.keys(params).forEach(key => {
            if (params[key]) url.searchParams.append(key, params[key]);
        });

        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
            const json = await response.json();
            return json.data;
        } catch (error) {
            console.error('Fitment API Error:', error);
            return null;
        }
    }

    async fetchTypes() {
        this.setLoading(true);
        const data = await this.fetchFromApi('fitment/getTypeOptions');
        this.populateSelect(this.typeSelect, data ? data.types : [], 'Select Type');
        this.setLoading(false);
        this.updateState();
    }

    async onTypeChange() {
        const type = this.typeSelect.value;
        this.clearSelect(this.yearSelect);
        this.clearSelect(this.makeSelect);
        this.clearSelect(this.modelSelect);

        if (type) {
            this.setLoading(true);
            const data = await this.fetchFromApi('fitment/getYearOptions', { type });
            this.populateSelect(this.yearSelect, data ? data.years.sort((a, b) => b - a) : [], 'Select Year'); // Sort years desc
            this.setLoading(false);
        }
        this.updateState();
    }

    async onYearChange() {
        const type = this.typeSelect.value;
        const year = this.yearSelect.value;
        this.clearSelect(this.makeSelect);
        this.clearSelect(this.modelSelect);

        if (type && year) {
            this.setLoading(true);
            const data = await this.fetchFromApi('fitment/getMakeOptions', { type, year });
            this.populateSelect(this.makeSelect, data ? data.makes : [], 'Select Make');
            this.setLoading(false);
        }
        this.updateState();
    }

    async onMakeChange() {
        const type = this.typeSelect.value;
        const year = this.yearSelect.value;
        const make = this.makeSelect.value;
        this.clearSelect(this.modelSelect);

        if (type && year && make) {
            this.setLoading(true);
            const data = await this.fetchFromApi('fitment/getModelOptions', { type, year, make });
            if (data && data.models) {
                this.processAndPopulateModels(data.models);
            } else {
                this.populateSelect(this.modelSelect, [], 'Select Model');
            }
            this.setLoading(false);
        }
        this.updateState();
    }

    populateSelect(selectElement, options, placeholder) {
        selectElement.innerHTML = `<option value="">${placeholder}</option>`;
        options.forEach(option => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            selectElement.appendChild(opt);
        });
        selectElement.disabled = false;
    }

    clearSelect(selectElement) {
        selectElement.innerHTML = '<option value="">Select...</option>';
        selectElement.disabled = true;
    }

    setLoading(isLoading) {
        if (isLoading) {
            this.container.classList.add('loading');
        } else {
            this.container.classList.remove('loading');
        }
    }

    updateState() {
        // Enable submit only if all fields selected
        const isReady = this.typeSelect.value && this.yearSelect.value && this.makeSelect.value && this.modelSelect.value;
        this.submitBtn.disabled = !isReady;
    }

    async onSubmit() {
        const type = this.typeSelect.value;
        const year = this.yearSelect.value;
        const make = this.makeSelect.value;
        const model = this.modelSelect.value;

        if (!type || !year || !make || !model) return;

        this.setLoading(true);
        this.submitBtn.textContent = 'Filtering...';

        const data = await this.fetchFromApi('fitment/getFitmentProducts', { make, year, model });

        if (data && data.fitmentProducts) {
            const matchingSkus = new Set(data.fitmentProducts.map(p => p.itemNumber.trim()));
            this.filterGrid(matchingSkus);
        } else {
            alert('No matching products found for this vehicle.');
        }

        this.submitBtn.textContent = 'Apply Filter';
        this.setLoading(false);
        this.saveToStorage();
    }

    saveToStorage() {
        try {
            const vehicleData = {
                type: this.typeSelect.value,
                year: this.yearSelect.value,
                make: this.makeSelect.value,
                model: this.modelSelect.value
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(vehicleData));
        } catch (e) { console.error('Error saving vehicle', e); }
    }

    async loadFromStorage() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) return;

        try {
            const v = JSON.parse(stored);
            if (!v.type || !v.year || !v.make || !v.model) return;

            // 1. Set Type
            if (!this.setSelectValue(this.typeSelect, v.type)) return;

            // 2. Fetch & Set Year
            this.setLoading(true);
            const yearsData = await this.fetchFromApi('fitment/getYearOptions', { type: v.type });
            this.populateSelect(this.yearSelect, yearsData ? yearsData.years.sort((a, b) => b - a) : [], 'Select Year');
            if (!this.setSelectValue(this.yearSelect, v.year)) { this.setLoading(false); return; }

            // 3. Fetch & Set Make
            const makesData = await this.fetchFromApi('fitment/getMakeOptions', { type: v.type, year: v.year });
            this.populateSelect(this.makeSelect, makesData ? makesData.makes : [], 'Select Make');
            if (!this.setSelectValue(this.makeSelect, v.make)) { this.setLoading(false); return; }

            // 4. Fetch & Set Model
            const modelsData = await this.fetchFromApi('fitment/getModelOptions', { type: v.type, year: v.year, make: v.make });
            if (modelsData && modelsData.models) {
                this.processAndPopulateModels(modelsData.models);
            } else {
                this.populateSelect(this.modelSelect, [], 'Select Model');
            }
            if (!this.setSelectValue(this.modelSelect, v.model)) { this.setLoading(false); return; }

            this.setLoading(false);
            this.updateState();

            // Auto Submit to filter grid
            this.onSubmit();

        } catch (e) {
            console.error('Error loading vehicle from storage', e);
            this.setLoading(false);
        }
    }

    setSelectValue(select, value) {
        // Simple check if value exists in options
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value === value) {
                select.value = value;
                return true;
            }
        }
        return false;
    }

    filterGrid(matchingSkus) {
        const productCards = document.querySelectorAll('.product-grid .grid__item');
        let hiddenCount = 0;

        productCards.forEach(cardWrapper => {
            const productCard = cardWrapper.querySelector('[data-sku]');
            const sku = productCard ? productCard.getAttribute('data-sku') : null;

            if (sku && matchingSkus.has(sku.trim())) {
                cardWrapper.style.display = '';
            } else {
                if (productCard) {
                    cardWrapper.style.display = 'none';
                    hiddenCount++;
                }
            }
        });
    }

    onReset() {
        this.typeSelect.value = '';
        this.onTypeChange();

        const productCards = document.querySelectorAll('.product-grid .grid__item');
        productCards.forEach(card => card.style.display = '');
        localStorage.removeItem(this.STORAGE_KEY);
    }

    // --- Normalization Logic (Synced with product-finder.js) ---
    normalizeModelName(model) {
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

    processAndPopulateModels(rawModelsList) {
        let modelMap = {};
        const distinctCleanModels = new Set();
        rawModelsList.forEach(rawModel => {
            const cleanName = this.normalizeModelName(rawModel) || rawModel;
            if (!modelMap[cleanName]) modelMap[cleanName] = [];
            modelMap[cleanName].push(rawModel);
            distinctCleanModels.add(cleanName);
        });
        const sortedModels = Array.from(distinctCleanModels).sort();
        this.modelSelect.innerHTML = '<option value="">Select Model</option>';
        sortedModels.forEach(cleanName => {
            const option = document.createElement('option');
            option.value = cleanName;
            const count = modelMap[cleanName].length;
            if (count > 1) { option.textContent = `${cleanName} +`; } else { option.textContent = cleanName; }
            this.modelSelect.appendChild(option);
        });
        this.modelSelect.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('vehicle-filter-component');
    if (container) {
        const token = container.getAttribute('data-token');
        const url = container.getAttribute('data-api-url');
        if (token) {
            new VehicleFilter(container, token, url);
        } else {
            console.error('Vehicle Filter: API Token not found.');
        }
    }
});
