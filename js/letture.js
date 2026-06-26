import { fetchAPI } from './api.js';

let currentPage = 0;
const LIMIT = 20;
let hasMore = true;
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    loadLetture(true);

    // Debounce search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadLetture(true);
            }, 300);
        });
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
});

async function loadLetture(reset = false) {
    if (reset) {
        currentPage = 0;
        hasMore = true;
        document.getElementById('table-body').innerHTML = '';
        document.getElementById('load-more-btn').style.display = 'none';
    }

    const search = document.getElementById('search-input')?.value || '';
    const zona = document.getElementById('filter-zona')?.value || 'all';
    const tipo = document.getElementById('filter-tipo')?.value || 'all';
    const data_da = document.getElementById('filter-date-from')?.value || '';
    const data_a = document.getElementById('filter-date-to')?.value || '';
    
    const offset = currentPage * LIMIT;
    
    const params = new URLSearchParams({
        limit: LIMIT,
        offset: offset,
        search: search,
        zona: zona,
        tipo: tipo,
        data_da: data_da,
        data_a: data_a
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

    const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    letture.forEach(l => {
        const tr = document.createElement('tr');
        
        // Tipo Badge
        let tipoBadgeClass = 'primary';
        if (l.tipo_lettura === 'reale') tipoBadgeClass = 'success';
        if (l.tipo_lettura === 'stimata') tipoBadgeClass = 'warning';
        if (l.tipo_lettura === 'autolettura') tipoBadgeClass = 'blue';

        const tipoStr = l.tipo_lettura.charAt(0).toUpperCase() + l.tipo_lettura.slice(1);
        
        // Valore e Anomalia
        const valoreFloat = parseFloat(l.valore);
        const isAnomalia = valoreFloat === 0;
        const valoreFormattato = formatter.format(valoreFloat);
        
        const anomaliaBadge = isAnomalia 
            ? `<div style="margin-top: 0.25rem;"><span class="status-badge danger" style="padding: 0.125rem 0.5rem;"><span class="dot"></span>Anomalia</span></div>` 
            : '';

        // Fattura
        let fatturaHtml = '';
        if (l.fattura) {
            fatturaHtml = `<span style="font-weight: 500; color: var(--text-main);">${l.fattura}</span>`;
        } else {
            fatturaHtml = `<span class="status-badge warning"><span class="dot"></span>Da Fatturare</span>`;
        }

        tr.innerHTML = `
            <td class="font-bold text-primary" style="font-size: 14px;">${l.codice || l.codice_parlante || ''}</td>
            <td>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 600; color: var(--text-main);">${l.indirizzo_completo || 'Indirizzo Sconosciuto'}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">${l.utenza_codice || ''}</span>
                </div>
            </td>
            <td>
                ${fatturaHtml}
            </td>
            <td style="color: var(--text-main);">${l.data_formattata}</td>
            <td>
                <div style="display: flex; flex-direction: column; align-items: flex-start;">
                    <span style="font-weight: 600; color: var(--text-main);">${valoreFormattato}</span>
                    ${anomaliaBadge}
                </div>
            </td>
            <td>
                <span class="badge badge-${tipoBadgeClass}">${tipoStr}</span>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}
