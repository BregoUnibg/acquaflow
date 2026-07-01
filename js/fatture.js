import { fetchAPI } from './api.js';

let currentPage = 0;
const LIMIT = 20;
let hasMore = true;
let searchTimeout = null;
let currentSorts = [];

const currencyFormatter = new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR'
});

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');

    // Check if there is a search term in the URL query string
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam && searchInput) {
        searchInput.value = searchParam;
    }

    loadFatture(true);

    // Debounce search
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadFatture(true);
            }, 300);
        });
    }

    // Toggle Vista Compatta
    const compactToggle = document.getElementById('compact-view-toggle');
    if (compactToggle) {
        compactToggle.addEventListener('click', (e) => {
            if (compactToggle.tagName.toLowerCase() === 'input' && compactToggle.type === 'checkbox') {
                if (compactToggle.checked) {
                    document.getElementById('table-body').classList.add('table-compact-view');
                } else {
                    document.getElementById('table-body').classList.remove('table-compact-view');
                }
            } else {
                const isChecked = compactToggle.getAttribute('aria-checked') === 'true';
                if (isChecked) {
                    compactToggle.setAttribute('aria-checked', 'false');
                    compactToggle.classList.remove('bg-primary');
                    compactToggle.classList.add('bg-secondary/30');
                    compactToggle.querySelector('span:not(.sr-only)').classList.remove('translate-x-5');
                    compactToggle.querySelector('span:not(.sr-only)').classList.add('translate-x-0');
                    document.getElementById('table-body').classList.remove('table-compact-view');
                } else {
                    compactToggle.setAttribute('aria-checked', 'true');
                    compactToggle.classList.remove('bg-secondary/30');
                    compactToggle.classList.add('bg-primary');
                    compactToggle.querySelector('span:not(.sr-only)').classList.remove('translate-x-0');
                    compactToggle.querySelector('span:not(.sr-only)').classList.add('translate-x-5');
                    document.getElementById('table-body').classList.add('table-compact-view');
                }
            }
        });

        if (compactToggle.tagName.toLowerCase() === 'input' && compactToggle.type === 'checkbox') {
            compactToggle.addEventListener('change', () => {
                if (compactToggle.checked) {
                    document.getElementById('table-body').classList.add('table-compact-view');
                } else {
                    document.getElementById('table-body').classList.remove('table-compact-view');
                }
            });
        }
    }

    // Applica filtri
    const applyBtn = document.getElementById('apply-filters');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            loadFatture(true);
        });
    }

    // Rimuovi filtri
    const clearBtn = document.getElementById('clear-filters');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            document.getElementById('filter-zona').value = 'all';
            document.getElementById('filter-stato').value = 'all';
            document.getElementById('filter-date-from').value = '';
            document.getElementById('filter-date-to').value = '';
            document.getElementById('filter-importo-min').value = '';
            document.getElementById('filter-importo-max').value = '';

            if (searchInput) searchInput.value = '';

            loadFatture(true);
        });
    }

    // Mostra Altri
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            if (hasMore) {
                currentPage++;
                loadFatture(false);
            }
        });
    }

    // Gestione Sorting
    document.querySelectorAll('.sortable-col').forEach(th => {
        th.addEventListener('click', () => {
            const sortBy = th.getAttribute('data-sort');
            const existingIndex = currentSorts.findIndex(s => s.by === sortBy);

            if (existingIndex >= 0) {
                if (currentSorts[existingIndex].dir === 'asc') {
                    currentSorts[existingIndex].dir = 'desc';
                } else {
                    currentSorts.splice(existingIndex, 1);
                }
            } else {
                currentSorts = [{ by: sortBy, dir: 'asc' }];
            }

            updateSortUI();
            loadFatture(true);
        });
    });
    updateSortUI();
});

function updateSortUI() {
    document.querySelectorAll('.sortable-col').forEach(th => {
        th.classList.remove('active');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.textContent = 'unfold_more';
    });

    currentSorts.forEach((sort) => {
        const activeTh = document.querySelector(`.sortable-col[data-sort="${sort.by}"]`);
        if (activeTh) {
            activeTh.classList.add('active');
            const icon = activeTh.querySelector('.sort-icon');
            if (icon) {
                icon.textContent = sort.dir === 'asc' ? 'arrow_upward' : 'arrow_downward';
            }
        }
    });
}

async function loadFatture(reset = false) {
    if (reset) {
        currentPage = 0;
        hasMore = true;
        document.getElementById('table-body').innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    Caricamento in corso...
                </td>
            </tr>
        `;
        document.getElementById('load-more-btn').style.display = 'none';
    }

    const search = document.getElementById('search-input')?.value || '';
    const zona = document.getElementById('filter-zona')?.value || 'all';
    const stato = document.getElementById('filter-stato')?.value || 'all';
    const data_da = document.getElementById('filter-date-from')?.value || '';
    const data_a = document.getElementById('filter-date-to')?.value || '';
    const importo_min = document.getElementById('filter-importo-min')?.value || '';
    const importo_max = document.getElementById('filter-importo-max')?.value || '';

    const offset = currentPage * LIMIT;
    const sortParams = currentSorts.map(s => `${s.by}:${s.dir}`).join(',');

    const params = new URLSearchParams({
        limit: LIMIT,
        offset: offset,
        search: search,
        zona: zona,
        stato: stato,
        data_da: data_da,
        data_a: data_a,
        importo_min: importo_min,
        importo_max: importo_max,
        sort: sortParams
    });

    const data = await fetchAPI(`api/fatture/list.php?${params.toString()}`);

    if (data && data.success) {
        if (reset && data.kpis) {
            updateKPIs(data.kpis);
        }

        renderTable(data.data, reset);

        const loadMoreBtn = document.getElementById('load-more-btn');
        if (data.data.length < LIMIT) {
            hasMore = false;
            loadMoreBtn.style.display = 'none';
        } else {
            hasMore = true;
            loadMoreBtn.style.display = 'block';
        }
    } else {
        document.getElementById('table-body').innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; color: var(--accent-danger); padding: 2rem;">
                    Errore nel caricamento dei dati. Riprovare.
                </td>
            </tr>
        `;
    }
}

function updateKPIs(kpis) {
    document.getElementById('kpi-emesso').innerText = currencyFormatter.format(kpis.totale_emesso || 0);
    document.getElementById('kpi-incassare').innerText = currencyFormatter.format(kpis.totale_incassare || 0);
    document.getElementById('kpi-scadute-count').innerText = kpis.scadute_count || 0;
    document.getElementById('kpi-scadute-sum').innerText = currencyFormatter.format(kpis.scadute_sum || 0);
}

function renderTable(fatture, reset) {
    const tbody = document.getElementById('table-body');

    if (reset) {
        tbody.innerHTML = '';
    }

    if (fatture.length === 0 && reset) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    Nessuna fattura trovata con i filtri attuali.
                </td>
            </tr>
        `;
        return;
    }

    fatture.forEach(f => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-background-light/50 transition-colors group cursor-pointer";

        // Stato Badge
        let statoBadgeHtml = '';
        if (f.stato_pagamento === 'Pagata') {
            statoBadgeHtml = `
                <div class="flex flex-col items-center gap-1">
                    <span class="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-accent-success/10 text-accent-success rounded-lg">
                        <span class="w-1.5 h-1.5 rounded-full bg-accent-success mr-1.5"></span>
                        Pagata
                    </span>
                    ${f.data_pagamento_fmt ? `<span class="text-[10px] text-text-muted compact-hide">${f.data_pagamento_fmt}</span>` : ''}
                </div>
            `;
        } else if (f.stato_pagamento === 'Scaduta') {
            statoBadgeHtml = `
                <div class="flex flex-col items-center gap-1">
                    <span class="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-accent-danger/10 text-accent-danger rounded-lg">
                        <span class="w-1.5 h-1.5 rounded-full bg-accent-danger mr-1.5"></span>
                        Scaduta
                    </span>
                </div>
            `;
        } else if (f.stato_pagamento === 'Emessa') {
            statoBadgeHtml = `
                <div class="flex flex-col items-center gap-1">
                    <span class="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-accent-info/10 text-accent-info rounded-lg">
                        <span class="w-1.5 h-1.5 rounded-full bg-accent-info mr-1.5"></span>
                        Emessa
                    </span>
                </div>
            `;
        } else {
            statoBadgeHtml = `
                <div class="flex flex-col items-center gap-1">
                    <span class="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-gray-100 text-gray-600 rounded-lg">
                        <span class="w-1.5 h-1.5 rounded-full bg-text-muted mr-1.5"></span>
                        ${f.stato_pagamento}
                    </span>
                </div>
            `;
        }

        tr.innerHTML = `
            <td class="p-4 font-semibold text-primary text-sm">${f.codice_parlante || ''}</td>
            <td class="p-4">
                <a href="clienti.html?search=${encodeURIComponent(f.ragSoc + ' - ' + f.cf_piva)}" class="flex flex-col hover:text-primary transition-colors cursor-pointer">
                    <span class="text-sm font-semibold">${f.ragSoc || ''}</span>
                    <span class="text-xs text-text-muted mt-0.5 compact-hide">${f.cf_piva || ''}</span>
                </a>
            </td>
            <td class="p-4">
                <a href="utenze.html?search=${encodeURIComponent(f.utenza_codice_parlante)}" class="flex flex-col hover:text-primary transition-colors cursor-pointer">
                    <span class="text-sm font-semibold">${f.utenza_str || 'Non definito'}</span>
                    <span class="text-xs text-text-muted mt-0.5 compact-hide">${f.utenza_codice_parlante || ''}</span>
                </a>
            </td>
            <td class="p-4 text-on-surface text-sm">${f.data_emissione_fmt}</td>
            <td class="p-4 text-on-surface text-sm">${f.data_scadenza_fmt}</td>
            <td class="p-4">
                <a href="letture.html?search=${encodeURIComponent(f.codice_parlante)}" class="text-sm text-on-surface hover:text-primary transition-colors cursor-pointer">
                    ${f.num_letture || 0}
                </a>
            </td>
            <td class="p-4">
                <div class="flex flex-col">
                    <span class="text-sm font-semibold">${currencyFormatter.format(f.totale || 0)}</span>
                    <span class="text-[10px] text-text-muted compact-hide">Imponibile: ${currencyFormatter.format(f.imponibile || 0)} | IVA: ${currencyFormatter.format(f.iva || 0)}</span>
                </div>
            </td>
            <td class="p-4">
                ${statoBadgeHtml}
            </td>
            <td class="p-4 text-sm text-on-surface">${f.spedizione_str || 'Sconosciuto'}</td>
        `;

        tbody.appendChild(tr);
    });
}
