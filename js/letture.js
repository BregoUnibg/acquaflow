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

    loadLetture(true);

    // Debounce search
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadLetture(true);
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
            loadLetture(true);
        });
    }

    // Rimuovi filtri
    const clearBtn = document.getElementById('clear-filters');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            document.getElementById('filter-zona').value = 'all';
            document.getElementById('filter-tipo').value = 'all';
            document.getElementById('filter-date-from').value = '';
            document.getElementById('filter-date-to').value = '';

            if (searchInput) searchInput.value = '';

            loadLetture(true);
        });
    }

    // Mostra Altri
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            if (hasMore) {
                currentPage++;
                loadLetture(false);
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
            loadLetture(true);
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

async function loadLetture(reset = false) {
    if (reset) {
        currentPage = 0;
        hasMore = true;
        document.getElementById('table-body').innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    Caricamento in corso...
                </td>
            </tr>
        `;
        document.getElementById('load-more-btn').style.display = 'none';
    }

    const search = document.getElementById('search-input')?.value || '';
    const zona = document.getElementById('filter-zona')?.value || 'all';
    const tipo = document.getElementById('filter-tipo')?.value || 'all';
    const data_da = document.getElementById('filter-date-from')?.value || '';
    const data_a = document.getElementById('filter-date-to')?.value || '';

    const offset = currentPage * LIMIT;
    const sortParams = currentSorts.map(s => `${s.by}:${s.dir}`).join(',');

    const params = new URLSearchParams({
        limit: LIMIT,
        offset: offset,
        search: search,
        zona: zona,
        tipo: tipo,
        data_da: data_da,
        data_a: data_a,
        sort: sortParams
    });

    const data = await fetchAPI(`api/letture/list.php?${params.toString()}`);

    if (data && data.success) {
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
                <td colspan="6" style="text-align: center; color: var(--accent-danger); padding: 2rem;">
                    Errore nel caricamento dei dati. Riprovare.
                </td>
            </tr>
        `;
    }
}

function renderTable(letture, reset) {
    const tbody = document.getElementById('table-body');

    if (reset) {
        tbody.innerHTML = '';
    }

    if (letture.length === 0 && reset) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    Nessuna lettura trovata con i filtri attuali.
                </td>
            </tr>
        `;
        return;
    }

    const formatter = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    letture.forEach(l => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-border-soft hover:bg-background-light/50 transition-colors";

        const tipoStr = l.tipo_lettura.charAt(0).toUpperCase() + l.tipo_lettura.slice(1);

        // Valore e Anomalia
        const valoreFloat = parseFloat(l.valore);
        const isAnomalia = valoreFloat === 0;
        const valoreFormattato = formatter.format(valoreFloat);

        // Calcolo consumo effettivo rispetto alla lettura precedente
        let consumoHtml = '';
        if (l.valore_precedente !== null && l.valore_precedente !== undefined) {
            const prevFloat = parseFloat(l.valore_precedente);
            let consumoGenerato = valoreFloat - prevFloat;

            // Gestione del giro/reset del contatore (es. superamento di 99999)
            if (consumoGenerato < 0) {
                // Assumiamo un contatore classico a 5 cifre
                consumoGenerato += 100000;
            }

            const consumoFormattato = formatter.format(consumoGenerato);

            consumoHtml = `
                <div class="text-[12px] text-text-muted mt-0.5 compact-hide">
                    +${consumoFormattato}
                </div>`;
        }

        // Tipo Badge
        let tipoBadgeHtml = '';
        if (isAnomalia) {
            tipoBadgeHtml = `<span class="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-accent-danger/10 text-accent-danger rounded-lg"><span class="w-2 h-2 rounded-full bg-accent-danger mr-2"></span>Anomalia</span>`;
        } else if (l.tipo_lettura === 'reale') {
            tipoBadgeHtml = `<span class="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-accent-success/10 text-accent-success rounded-lg">Reale</span>`;
        } else if (l.tipo_lettura === 'stimata') {
            tipoBadgeHtml = `<span class="inline-flex items-center px-2.5 py-0.5 text-xs font-bold rounded-lg" style="background-color: rgba(255, 159, 67, 0.1); color: rgb(255, 159, 67);">Stimata</span>`;
        } else if (l.tipo_lettura === 'autolettura') {
            tipoBadgeHtml = `<span class="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-accent-info/10 text-accent-info rounded-lg">Autolettura</span>`;
        } else {
            tipoBadgeHtml = `<span class="inline-flex items-center px-2.5 py-0.5 text-xs font-bold bg-gray-100 text-gray-700 rounded-lg">${tipoStr}</span>`;
        }

        // Fattura
        let fatturaHtml = '';
        if (l.fattura_codice_parlante) {
            fatturaHtml = `<a href="fatture.html?search=${encodeURIComponent(l.fattura_codice_parlante)}" class="text-on-surface font-medium hover:text-primary transition-colors cursor-pointer">${l.fattura_codice_parlante}</a>`;
        } else {
            fatturaHtml = `<span class="inline-flex items-center px-2.5 py-0.5 text-xs font-medium bg-accent-warning/10 text-accent-warning rounded-lg"><span class="w-2 h-2 rounded-full bg-accent-warning mr-2"></span>Da Fatturare</span>`;
        }

        tr.innerHTML = `
            <td class="px-6 py-4 font-semibold text-primary">${l.codice_parlante || ''}</td>
            <td class="px-6 py-4">
                <div class="font-medium text-text-main">${l.indirizzo_completo || 'Indirizzo Sconosciuto'}</div>
                <a href="utenze.html?search=${encodeURIComponent(l.utenza_codice || '')}" class="text-[12px] text-text-muted hover:text-primary transition-colors cursor-pointer block w-fit">${l.utenza_codice || ''}</a>
            </td>
            <td class="px-6 py-4">
                ${fatturaHtml}
            </td>
            <td class="px-6 py-4 text-on-surface">${l.data_formattata}</td>
            <td class="px-6 py-4">
                <div class="font-semibold text-text-main">${valoreFormattato}</div>
                ${consumoHtml}
            </td>
            <td class="px-6 py-4">
                ${tipoBadgeHtml}
            </td>
        `;

        tbody.appendChild(tr);
    });
}
