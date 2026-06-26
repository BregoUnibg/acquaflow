import { fetchAPI } from './api.js';

let currentPage = 0;
const LIMIT = 20;
let hasMore = true;
let searchTimeout = null;

const currencyFormatter = new Intl.NumberFormat('it-IT', { 
    style: 'currency', 
    currency: 'EUR' 
});

document.addEventListener('DOMContentLoaded', () => {
    loadFatture(true);

    // Debounce search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadFatture(true);
            }, 300);
        });
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
});

async function loadFatture(reset = false) {
    if (reset) {
        currentPage = 0;
        hasMore = true;
        document.getElementById('table-body').innerHTML = '';
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
    
    const params = new URLSearchParams({
        limit: LIMIT,
        offset: offset,
        search: search,
        zona: zona,
        stato: stato,
        data_da: data_da,
        data_a: data_a,
        importo_min: importo_min,
        importo_max: importo_max
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
        
        // Stato Badge
        let statoBadgeClass = 'neutral';
        if (f.stato_pagamento === 'Pagata') statoBadgeClass = 'success';
        if (f.stato_pagamento === 'Scaduta') statoBadgeClass = 'danger';
        if (f.stato_pagamento === 'Emessa') statoBadgeClass = 'info';

        const dataPagamentoHtml = (f.stato_pagamento === 'Pagata' && f.data_pagamento_fmt) 
            ? `<span style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">${f.data_pagamento_fmt}</span>` 
            : '';

        tr.innerHTML = `
            <td class="font-bold text-primary" style="font-size: 14px;">${f.codice_parlante || f.codice}</td>
            <td>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 600; color: var(--text-main);">${f.ragSoc || ''}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">${f.cf_piva || ''}</span>
                </div>
            </td>
            <td>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 600; color: var(--text-main);">${f.utenza_str || 'Non definito'}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">${f.utenza || ''}</span>
                </div>
            </td>
            <td style="color: var(--text-main);">${f.data_emissione_fmt}</td>
            <td style="color: var(--text-main);">${f.data_scadenza_fmt}</td>
            <td style="text-align: center; color: var(--text-main);">${f.num_letture || 0}</td>
            <td style="text-align: right;">
                <div style="display: flex; flex-direction: column; align-items: flex-end;">
                    <span style="font-weight: 600; color: var(--text-main);">${currencyFormatter.format(f.totale || 0)}</span>
                    <span style="font-size: 10px; color: var(--text-muted);">Imponibile: ${currencyFormatter.format(f.imponibile || 0)} | IVA: ${currencyFormatter.format(f.iva || 0)}</span>
                </div>
            </td>
            <td style="text-align: center;">
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <span class="status-badge ${statoBadgeClass}">
                        <span class="dot"></span>${f.stato_pagamento}
                    </span>
                    ${dataPagamentoHtml}
                </div>
            </td>
            <td style="color: var(--text-main); font-size: 14px;">${f.spedizione_str || 'Sconosciuto'}</td>
        `;
        
        tbody.appendChild(tr);
    });
}
