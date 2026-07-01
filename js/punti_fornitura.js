import { fetchAPI } from './api.js';

let currentPage = 0;
const LIMIT = 20;
let hasMore = true;
let searchTimeout = null;
let currentSorts = [];

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');

    // Check if there is a search term in the URL query string
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    if (searchParam && searchInput) {
        searchInput.value = searchParam;
    }

    // 1. Carica i dati iniziali
    loadPuntiFornitura(true);

    // 2. Event Listener per barra di ricerca (Debounce)
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadPuntiFornitura(true);
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

    // 3. Event Listener per Bottone Applica Filtri
    const applyBtn = document.getElementById('apply-filters');
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            loadPuntiFornitura(true);
        });
    }

    // 4. Event Listener per Bottone Rimuovi Filtri
    const clearBtn = document.getElementById('clear-filters');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            document.getElementById('filter-zona').value = 'all';
            document.getElementById('filter-stato').value = 'all';

            // Uncheck all diametro checkboxes
            const checkboxes = document.querySelectorAll('.diametro-checkbox');
            checkboxes.forEach(cb => cb.checked = false);

            if (searchInput) searchInput.value = '';

            loadPuntiFornitura(true);
        });
    }

    // 5. Event Listener per Bottone "Mostra Altri"
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            if (hasMore) {
                currentPage++;
                loadPuntiFornitura(false);
            }
        });
    }

    // 6. Gestione Sorting
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
            loadPuntiFornitura(true);
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

async function loadPuntiFornitura(reset = false) {
    if (reset) {
        currentPage = 0;
        hasMore = true;
        document.getElementById('table-body').innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    Caricamento in corso...
                </td>
            </tr>
        `;
        document.getElementById('load-more-btn').style.display = 'none';
    }

    const search = document.getElementById('search-input')?.value || '';
    const zona = document.getElementById('filter-zona')?.value || 'all';
    const stato = document.getElementById('filter-stato')?.value || 'all';

    // Raccogli valori diametri selezionati
    const checkboxes = document.querySelectorAll('.diametro-checkbox:checked');
    const diametriSelezionati = Array.from(checkboxes).map(cb => cb.value).join(',');

    const offset = currentPage * LIMIT;

    const sortParams = currentSorts.map(s => `${s.by}:${s.dir}`).join(',');

    // Costruisci query string
    const params = new URLSearchParams({
        limit: LIMIT,
        offset: offset,
        search: search,
        zona: zona,
        stato: stato,
        diametri: diametriSelezionati,
        sort: sortParams
    });

    const data = await fetchAPI(`api/punti_fornitura/list.php?${params.toString()}`);

    if (data && data.success) {
        renderTable(data.data, reset);

        // Gestione bottone Load More
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
                <td colspan="4" style="text-align: center; color: var(--accent-danger); padding: 2rem;">
                    Errore nel caricamento dei dati. Riprovare.
                </td>
            </tr>
        `;
    }
}

function renderTable(punti, reset) {
    const tbody = document.getElementById('table-body');

    if (reset) {
        tbody.innerHTML = '';
    }

    if (punti.length === 0 && reset) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    Nessun punto di fornitura trovato con i filtri attuali.
                </td>
            </tr>
        `;
        return;
    }

    punti.forEach(pf => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-background-light transition-colors group h-[72px]";

        let statoBg = 'rgba(0, 184, 159, 0.1)';
        let statoColor = 'rgb(0, 184, 159)';
        if (pf.stato_calcolato !== 'Libero') {
            statoBg = 'rgba(132, 129, 122, 0.1)';
            statoColor = 'rgb(132, 129, 122)';
        }

        tr.innerHTML = `
            <td class="p-4 text-sm font-semibold text-primary">
                <a href="utenze.html?search=${encodeURIComponent(pf.codice_pod)}" class="hover:underline cursor-pointer">
                    ${pf.codice_pod}
                </a>
            </td>
            <td class="p-4">
                <div class="flex flex-col">
                    <span class="text-sm font-semibold text-text-main">${pf.indirizzo || ''}${pf.città ? ', ' + pf.città : ''}</span>
                    <span class="text-xs text-text-muted mt-0.5 compact-hide">${pf.distretto || 'Non Definito'}</span>
                </div>
            </td>
            <td class="p-4">
                <div class="flex flex-col">
                    <span class="text-sm text-text-main">${pf.diametro_tubo || 'N/D'}</span>
                    <span class="text-xs text-text-muted mt-0.5 compact-hide">${pf.portata_massima ? pf.portata_massima : ''}</span>
                </div>
            </td>
            <td class="p-4">
                <span class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold" style="background-color: ${statoBg}; color: ${statoColor};">
                    <span class="w-1.5 h-1.5 rounded-full mr-1.5" style="background-color: currentcolor;"></span>
                    ${pf.stato_calcolato}
                </span>
            </td>
        `;

        tbody.appendChild(tr);
    });
}
