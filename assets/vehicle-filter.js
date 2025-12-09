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

        this.init();
    }

    init() {
        this.fetchTypes();
        this.addEventListeners();
    }

    addEventListeners() {
        this.typeSelect.addEventListener('change', () => this.onTypeChange());
        this.yearSelect.addEventListener('change', () => this.onYearChange());
        this.makeSelect.addEventListener('change', () => this.onMakeChange());
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
            this.populateSelect(this.modelSelect, data ? data.models : [], 'Select Model');
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
