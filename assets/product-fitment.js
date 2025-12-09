/**
 * Product Fitment Script (Apex Theme Version)
 */
document.addEventListener('DOMContentLoaded', () => {
  const fitmentSections = document.querySelectorAll('.product-fitment-section');

  fitmentSections.forEach(section => {
    const sectionId = section.dataset.sectionId;
    const endpoint = section.dataset.apiEndpoint;
    const apiToken = section.dataset.apiToken;
    const partNumber = section.dataset.partNumber;
    const hideIfEmpty = section.dataset.hideIfEmpty === 'true';
    const hasInitError = section.dataset.initError === 'true';

    // DOM Elements
    const loadingElement = section.querySelector('.product-fitment__loading');
    const resultsContainer = section.querySelector('.product-fitment__results');
    const tableHeader = section.querySelector('.product-fitment__table-header');
    const errorMessageElement = section.querySelector('.product-fitment__error-message');
    const filterInput = section.querySelector(`#fitment-filter-${sectionId}`);
    const sectionWrapper = section.closest('.product-fitment-wrapper');

    let allFitments = [];

    if (hasInitError) {
        if (loadingElement) loadingElement.style.display = 'none';
        return;
    }

    const toggleUI = (state) => {
      if (state === 'loading') {
        if (loadingElement) loadingElement.style.display = 'flex';
        if (tableHeader) tableHeader.style.display = 'none';
        if (resultsContainer) resultsContainer.innerHTML = '';
      } else if (state === 'ready') {
        if (loadingElement) loadingElement.style.display = 'none';
      } else if (state === 'error') {
        if (loadingElement) loadingElement.style.display = 'none';
        if (tableHeader) tableHeader.style.display = 'none';
      }
    };

    const displayError = (message) => {
      toggleUI('error');
      if (errorMessageElement) {
        errorMessageElement.textContent = message;
        errorMessageElement.style.display = 'block';
      }
      console.error(`Product Fitment Error (${sectionId}): ${message}`);
    };

    const displayResults = (fitmentsToDisplay) => {
      toggleUI('ready');
      if (errorMessageElement) errorMessageElement.style.display = 'none';

      // Handle Empty API Result
      if (allFitments.length === 0) {
         resultsContainer.innerHTML = '<p class="product-fitment__results--empty">No specific vehicle fitment data found for this part.</p>';
         if (filterInput) filterInput.disabled = true;
         if (tableHeader) tableHeader.style.display = 'none';
         
         if (hideIfEmpty && sectionWrapper) {
             sectionWrapper.style.display = 'none';
         }
         return;
      }

      // Handle No Filter Match
      if (fitmentsToDisplay.length === 0) {
          resultsContainer.innerHTML = '<p class="product-fitment__results--no-match">No matching vehicles found.</p>';
          if (tableHeader) tableHeader.style.display = 'none';
          return;
      }

      // Show Header Row
      if (tableHeader) tableHeader.style.display = 'grid';

      // Build List
      const listHtml = fitmentsToDisplay.map(fitment => `
        <li class="product-fitment__list-item">
          <span class="product-fitment__make">${escapeHtml(fitment.fitmentMake || '')}</span>
          <span class="product-fitment__model">${escapeHtml(fitment.fitmentModel || '')}</span>
          <span class="product-fitment__years">${escapeHtml(fitment.fitmentYears || '')}</span>
        </li>
      `).join('');

      resultsContainer.innerHTML = `<ul class="product-fitment__list" id="product-fitment-results-list-${sectionId}">${listHtml}</ul>`;
    };

    const escapeHtml = (unsafe) => {
        if (!unsafe) return '';
        return unsafe.toString()
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
     };

    const handleFilter = (event) => {
        const searchTerm = event.target.value.trim().toLocaleLowerCase();
        if (!allFitments) return;

        const filteredFitments = allFitments.filter(fitment => {
            const make = (fitment.fitmentMake || '').toLocaleLowerCase();
            const model = (fitment.fitmentModel || '').toLocaleLowerCase();
            const years = (fitment.fitmentYears || '').toLocaleLowerCase();
            return make.includes(searchTerm) || model.includes(searchTerm) || years.includes(searchTerm);
        });

        displayResults(filteredFitments);
    };

    if (filterInput) filterInput.addEventListener('input', handleFilter);

    const fetchFitmentData = async () => {
      toggleUI('loading');
      const url = `${endpoint}?itemNumber=${encodeURIComponent(partNumber)}`;

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Accept': 'application/json'
          }
        });

        if (!response.ok) throw new Error(`Status ${response.status}`);

        const result = await response.json();

        if (result.status === 'success') {
          allFitments = result.data?.fitments || [];
          
          // Sort: Make (A-Z), then Year (Newest-Oldest), then Model
          allFitments.sort((a, b) => {
            const makeA = (a.fitmentMake || '').toLowerCase();
            const makeB = (b.fitmentMake || '').toLowerCase();
            if (makeA < makeB) return -1;
            if (makeA > makeB) return 1;
            // If Makes match, sort by Year
            /* Note: Years often come as ranges "2000-2005". 
               This logic is simplistic string comparison. 
            */
            if (b.fitmentYears > a.fitmentYears) return 1;
            if (b.fitmentYears < a.fitmentYears) return -1;
            
            return 0;
          });

          displayResults(allFitments);
          if (filterInput && allFitments.length > 0) filterInput.disabled = false;

        } else {
          displayError(result.error?.message || 'API Error');
        }

      } catch (error) {
        displayError('Unable to load fitment data.');
      }
    };

    fetchFitmentData();
  });
});