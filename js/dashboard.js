// /js/dashboard.js
import { fetchAPI } from './api.js';

document.addEventListener('DOMContentLoaded', () => {
    // Carica i dati della dashboard
    loadDashboardData();

    // Event listeners per i bottoni dei filtri
    document.getElementById('apply-filters').addEventListener('click', () => {
        loadDashboardData();
    });

    document.getElementById('clear-filters').addEventListener('click', () => {
        document.getElementById('zone-filter').value = 'all';
        document.getElementById('filter-date-30').checked = true;
        loadDashboardData();
    });

    // Gestione clic all'esterno dei dropdown per chiuderli
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.td-actions')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });
});

async function loadDashboardData() {
    const zone = encodeURIComponent(document.getElementById('zone-filter').value);
    let date = '30days';
    if (document.getElementById('filter-date-month').checked) date = 'month';
    if (document.getElementById('filter-date-year').checked) date = 'year';

    // Chiamata all'API PHP
    const data = await fetchAPI(`api/dashboard/stats.php?zone=${zone}&date=${date}`);

    if (data && data.success) {
        // Popola i KPI (valori assoluti)
        document.getElementById('kpi-clienti').textContent = formatNumber(data.kpi.clienti_attivi.valore);
        document.getElementById('kpi-utenze').textContent = formatNumber(data.kpi.utenze_attive.valore);
        document.getElementById('kpi-letture').textContent = formatNumber(data.kpi.letture_effettuate.valore);
        document.getElementById('kpi-fatturato').textContent = '€ ' + formatCurrency(data.kpi.fatturato_stimato.valore);

        // Aggiorna indicatori di trend (percentuali)
        updateTrendUI('clienti', data.kpi.clienti_attivi.delta);
        updateTrendUI('utenze', data.kpi.utenze_attive.delta);
        updateTrendUI('letture', data.kpi.letture_effettuate.delta);
        updateTrendUI('fatturato', data.kpi.fatturato_stimato.delta);

        // Costruisci la tabella
        buildTable(data.utenze_recenti);
    } else {
        // Errore o API non raggiungibile
        console.error('Impossibile caricare i dati reali dal database.');
        document.getElementById('table-body').innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--color-accent-danger);">
                    Impossibile connettersi al database. (Errore API)
                </td>
            </tr>
        `;
        document.getElementById('kpi-clienti').textContent = '-';
        document.getElementById('kpi-utenze').textContent = '-';
        document.getElementById('kpi-letture').textContent = '-';
        document.getElementById('kpi-fatturato').textContent = '-';
        updateTrendUI('clienti', 0);
        updateTrendUI('utenze', 0);
        updateTrendUI('letture', 0);
        updateTrendUI('fatturato', 0);
    }
}

function updateTrendUI(kpiName, delta) {
    const iconEl = document.getElementById(`trend-icon-${kpiName}`);
    const valEl = document.getElementById(`trend-val-${kpiName}`);
    if (!iconEl || !valEl) return;
    
    const deltaNum = parseFloat(delta) || 0;
    
    if (deltaNum > 0) {
        iconEl.textContent = 'trending_up';
        iconEl.style.color = '#10b981'; // verde
        valEl.textContent = '+' + deltaNum.toFixed(1) + '%';
        valEl.style.color = '#10b981';
    } else if (deltaNum < 0) {
        iconEl.textContent = 'trending_down';
        iconEl.style.color = '#ef4444'; // rosso
        valEl.textContent = deltaNum.toFixed(1) + '%';
        valEl.style.color = '#ef4444';
    } else {
        iconEl.textContent = 'trending_flat';
        iconEl.style.color = '#6b7280'; // grigio
        valEl.textContent = '0.0%';
        valEl.style.color = '#6b7280';
    }
}

function buildTable(utenze) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = ''; // Pulisci tabella

    if (!utenze || utenze.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--color-text-muted);">
                    Nessuna utenza trovata nel database.
                </td>
            </tr>
        `;
        return;
    }

    utenze.forEach((u, index) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-background-light/50 transition-colors group";

        // Badge style basato sulla tipologia
        let badgeBg = 'rgba(0, 210, 211, 0.1)';
        let badgeColor = 'rgb(0, 210, 211)'; // Domestico Residente (Azzurro)
        if (u.tipologia === 'Domestico Non Residente') {
            badgeBg = 'rgba(46, 134, 222, 0.1)';
            badgeColor = 'rgb(46, 134, 222)'; // Blu
        } else if (u.tipologia === 'Commerciale') {
            badgeBg = 'rgba(245, 183, 0, 0.1)';
            badgeColor = 'rgb(245, 183, 0)'; // Giallo
        } else if (u.tipologia === 'Industriale') {
            badgeBg = 'rgba(255, 159, 67, 0.1)';
            badgeColor = 'rgb(255, 159, 67)'; // Arancio
        }

        // Format date
        let dataAttivazioneHtml = '-';
        if (u.data_attivazione) {
            const dateObj = new Date(u.data_attivazione);
            const mesi = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
            dataAttivazioneHtml = dateObj.getDate() + ' ' + mesi[dateObj.getMonth()] + ' ' + dateObj.getFullYear();
        }

        tr.innerHTML = `
            <td class="px-6 py-4 text-primary font-semibold whitespace-normal">
                <a href="utenze.html?search=${encodeURIComponent(u.id_utenza)}" class="hover:underline cursor-pointer">
                    ${u.id_utenza}
                </a>
            </td>
            <td class="px-6 py-4 text-text-main font-semibold whitespace-normal">
                <a href="clienti.html?search=${encodeURIComponent(u.cliente)}" class="hover:text-primary transition-colors cursor-pointer">
                    ${u.cliente || '-'}
                </a>
            </td>
            <td class="px-6 py-4 text-text-main font-semibold whitespace-normal">
                <a href="punti_fornitura.html?search=${encodeURIComponent(u.pod || '')}" class="hover:text-primary transition-colors cursor-pointer">
                    ${u.punto_erogazione || '-'}
                </a>
            </td>
            <td class="px-6 py-4 text-text-main whitespace-normal">${dataAttivazioneHtml}</td>
            <td class="px-6 py-4 whitespace-normal">
                <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold" style="background-color: ${badgeBg}; color: ${badgeColor};">${u.tipologia}</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Utility per formattare i numeri (es. 12450 -> 12.450)
function formatNumber(num) {
    return new Intl.NumberFormat('it-IT').format(num);
}

// Utility per formattare i valori in euro
function formatCurrency(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}
