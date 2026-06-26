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
        // Popola i KPI
        document.getElementById('kpi-clienti').textContent = formatNumber(data.kpi.clienti_attivi);
        document.getElementById('kpi-utenze').textContent = formatNumber(data.kpi.utenze_attive);
        document.getElementById('kpi-letture').textContent = formatNumber(data.kpi.letture_effettuate);
        document.getElementById('kpi-fatturato').textContent = '€ ' + formatCurrency(data.kpi.fatturato_stimato);

        // Costruisci la tabella
        buildTable(data.utenze_recenti);
    } else {
        // Errore o API non raggiungibile (es. server PHP non attivo)
        console.error('Impossibile caricare i dati reali dal database.');
        document.getElementById('table-body').innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--color-accent-danger);">
                    Impossibile connettersi al database. (Errore API)
                </td>
            </tr>
        `;
        document.getElementById('kpi-clienti').textContent = '0';
        document.getElementById('kpi-utenze').textContent = '0';
        document.getElementById('kpi-letture').textContent = '0';
        document.getElementById('kpi-fatturato').textContent = '€ 0,00';
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

        // Badge style basato sulla tipologia
        let badgeClass = 'primary';
        if (u.tipologia === 'Business' || u.tipologia === 'Condominio') {
            badgeClass = 'success';
        }

        // Format date
        let dataAttivazioneHtml = '-';
        if (u.data_attivazione) {
            const dateObj = new Date(u.data_attivazione);
            const mesi = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
            dataAttivazioneHtml = dateObj.getDate() + ' ' + mesi[dateObj.getMonth()] + ' ' + dateObj.getFullYear();
        }

        tr.innerHTML = `
            <td class="text-primary-bold">${u.id_utenza}</td>
            <td style="color: #000; font-weight: 500;">${u.cliente || '-'}</td>
            <td style="color: #000; font-weight: 500;">${u.punto_erogazione || '-'}</td>
            <td style="color: #000;">${dataAttivazioneHtml}</td>
            <td>
                <span class="badge ${badgeClass}">${u.tipologia}</span>
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
