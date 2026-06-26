import { fetchAPI } from './api.js';

let currentPage = 0;
const LIMIT = 20;
let hasMore = true;
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Carica i dati iniziali
    loadPuntiFornitura(true);

    // 2. Event Listener per barra di ricerca (Debounce)
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadPuntiFornitura(true);
            }, 300);
        });
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
});

async function loadPuntiFornitura(reset = false) {
    if (reset) {
        currentPage = 0;
        hasMore = true;
        document.getElementById('table-body').innerHTML = '';
        document.getElementById('load-more-btn').style.display = 'none';
    }

    const search = document.getElementById('search-input')?.value || '';
    const zona = document.getElementById('filter-zona')?.value || 'all';
    const stato = document.getElementById('filter-stato')?.value || 'all';
    
    // Raccogli valori diametri selezionati
    const checkboxes = document.querySelectorAll('.diametro-checkbox:checked');
    const diametriSelezionati = Array.from(checkboxes).map(cb => cb.value).join(',');

    const offset = currentPage * LIMIT;
    
    // Costruisci query string
    const params = new URLSearchParams({
        limit: LIMIT,
        offset: offset,
        search: search,
        zona: zona,
        stato: stato,
        diametri: diametriSelezionati
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
        
        const badgeClass = pf.stato_calcolato === 'Libero' ? 'success' : 'neutral';

        tr.innerHTML = `
            <td class="font-bold text-primary" style="font-size: 14px;">${pf.codice_pod}</td>
            <td>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 600; color: var(--text-main);">${pf.indirizzo || ''}${pf.città ? ', ' + pf.città : ''}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">${pf.distretto || 'Non Definito'}</span>
                </div>
            </td>
            <td>
                <div style="display: flex; flex-direction: column;">
                    <span style="color: var(--text-main); font-weight: 500;">${pf.diametro_tubo || 'N/D'}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">${pf.portata_massima ? pf.portata_massima + ' mc/h' : ''}</span>
                </div>
            </td>
            <td>
                <span class="status-badge ${badgeClass}">
                    <span class="dot"></span>${pf.stato_calcolato}
                </span>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}
