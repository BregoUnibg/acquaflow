// /js/utenze.js
import { fetchAPI } from './api.js';

let currentPage = 0;
const limit = 20;
let debounceTimeout = null;
let undoTimeout = null; // Per il Toast
let pendingSaveData = null; // Dati in attesa di salvataggio
let initialEditPayload = null;
let clientiMap = {}; // Mappa p.iva/nome -> id_cliente
let pendingChiusuraData = null; // Dati per chiusura utenza
let chiusuraTimeout = null; // Per il Toast di chiusura

let currentSorts = [];

document.addEventListener('DOMContentLoaded', () => {
    // Check if there is a search term in the URL query string
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    const searchInput = document.getElementById('search-input');
    if (searchParam && searchInput) {
        searchInput.value = searchParam;
    }

    loadUtenze(true);
    setupModalEvents();
    setupCreateModalEvents();
    setupChiusuraModalEvents();

    // Event listeners
    const loadMoreBtn = document.getElementById('load-more-btn');
    const applyBtn = document.getElementById('apply-filters');
    const clearBtn = document.getElementById('clear-filters');

    // Debounce sulla ricerca
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                loadUtenze(true);
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

    // Filtri
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            loadUtenze(true);
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            document.getElementById('search-input').value = '';
            // Reset radio button (Stato)
            const radios = document.getElementsByName('stato');
            for (let i = 0; i < radios.length; i++) {
                if (radios[i].value === 'all') radios[i].checked = true;
            }
            // Reset dates
            document.getElementById('filter-date-from').value = '';
            document.getElementById('filter-date-to').value = '';
            // Reset selects
            document.getElementById('filter-tipologia').value = 'all';
            document.getElementById('filter-zona').value = 'all';

            loadUtenze(true);
        });
    }

    // Mostra Altri
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            loadUtenze(false);
        });
    }

    // Dropdown close logic (clicking outside)
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.td-actions')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.classList.remove('show');
            });
        }
    });

    // Gestione Sorting
    document.querySelectorAll('.sortable-col').forEach(th => {
        th.addEventListener('click', () => {
            const sortBy = th.getAttribute('data-sort');
            const existingIndex = currentSorts.findIndex(s => s.by === sortBy);

            if (existingIndex >= 0) {
                if (currentSorts[existingIndex].dir === 'asc') {
                    currentSorts[existingIndex].dir = 'desc';
                } else {
                    // Rimuovi se era desc
                    currentSorts.splice(existingIndex, 1);
                }
            } else {
                // Se è una colonna diversa, sovrascrivi per mantenere sort singolo
                currentSorts = [{ by: sortBy, dir: 'asc' }];
            }

            updateSortUI();
            loadUtenze(true);
        });
    });
    updateSortUI();
});

function updateSortUI() {
    document.querySelectorAll('.sortable-col').forEach(th => {
        th.classList.remove('active');
        const icon = th.querySelector('.sort-icon');
        if (icon) icon.textContent = 'unfold_more'; // default icon
        const badge = th.querySelector('.sort-badge');
        if (badge) badge.remove();
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

async function loadUtenze(reset = false) {
    if (reset) {
        currentPage = 0;
    }

    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? encodeURIComponent(searchInput.value) : '';

    // Get stato da radio button
    let statoFilter = 'all';
    const radios = document.getElementsByName('stato');
    for (let i = 0; i < radios.length; i++) {
        if (radios[i].checked) {
            statoFilter = radios[i].value;
            break;
        }
    }

    const tipologia = encodeURIComponent(document.getElementById('filter-tipologia')?.value || 'all');
    const zona = encodeURIComponent(document.getElementById('filter-zona')?.value || 'all');
    const dataDa = encodeURIComponent(document.getElementById('filter-date-from')?.value || '');
    const dataA = encodeURIComponent(document.getElementById('filter-date-to')?.value || '');

    const offset = currentPage * limit;

    const sortParams = currentSorts.map(s => `${s.by}:${s.dir}`).join(',');
    const queryParams = `?limit=${limit}&offset=${offset}&search=${searchTerm}&stato=${statoFilter}&tipologia=${tipologia}&zona=${zona}&data_da=${dataDa}&data_a=${dataA}&sort=${encodeURIComponent(sortParams)}`;

    const tbody = document.getElementById('table-body');
    const loadMoreBtn = document.getElementById('load-more-btn');

    if (reset) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    Caricamento in corso...
                </td>
            </tr>
        `;
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    }

    const data = await fetchAPI(`api/utenze/list.php${queryParams}`);

    if (reset) {
        tbody.innerHTML = '';
    }

    if (data && data.success) {
        const utenze = data.utenze;

        if (utenze.length === 0 && reset) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        Nessuna utenza trovata.
                    </td>
                </tr>
            `;
        } else {
            renderUtenze(utenze);
        }

        if (loadMoreBtn) {
            loadMoreBtn.style.display = data.has_more ? 'inline-block' : 'none';
        }

        if (data.has_more) {
            currentPage++;
        }
    } else {
        console.error('Errore API Utenze:', data?.error);
        if (reset) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--accent-danger); padding: 2rem;">
                        Impossibile connettersi al database.
                    </td>
                </tr>
            `;
        }
    }
}

function renderUtenze(utenze) {
    const tbody = document.getElementById('table-body');

    // Per gestire indici univoci dei dropdown, ci serve sapere quanti elementi ci sono già
    const startIndex = tbody.children.length;

    utenze.forEach((u, idx) => {
        const index = startIndex + idx;
        const tr = document.createElement('tr');
        tr.className = "border-b border-border-soft hover:bg-background-light/50 transition-colors group";

        // Badge Tipologia (come in dashboard)
        let tipologiaBg = 'rgba(0, 210, 211, 0.1)';
        let tipologiaColor = 'rgb(0, 210, 211)';
        if (u.tipologia === 'Domestico Non Residente') {
            tipologiaBg = 'rgba(46, 134, 222, 0.1)';
            tipologiaColor = 'rgb(46, 134, 222)';
        } else if (u.tipologia === 'Commerciale') {
            tipologiaBg = 'rgba(245, 183, 0, 0.1)';
            tipologiaColor = 'rgb(245, 183, 0)';
        } else if (u.tipologia === 'Industriale') {
            tipologiaBg = 'rgba(255, 159, 67, 0.1)';
            tipologiaColor = 'rgb(255, 159, 67)';
        }

        // Badge Stato
        let statoBg = 'rgba(0, 184, 159, 0.1)';
        let statoColor = 'rgb(0, 184, 159)';
        let statoDotColor = 'bg-green-700';
        let statoText = 'Attiva';

        if (u.stato !== 'attiva') {
            statoBg = 'rgba(132, 129, 122, 0.1)';
            statoColor = 'rgb(132, 129, 122)';
            statoDotColor = 'bg-text-muted';
            statoText = 'Inattiva';
        }

        tr.innerHTML = `
            <td class="py-4 px-6 font-semibold text-primary">${u.codice_parlante || ''}</td>
            <td class="py-4 px-6">
                <a href="clienti.html?search=${encodeURIComponent(u.cliente + ' - ' + u.cliente_cf)}" class="flex flex-col hover:text-primary transition-colors cursor-pointer">
                    <span class="font-semibold">${u.cliente}</span>
                    <span class="text-[12px] text-text-muted mt-0.5 compact-hide">${u.cliente_cf}</span>
                </a>
            </td>
            <td class="py-4 px-6">
                <a href="punti_fornitura.html?search=${encodeURIComponent(u.codice_pod)}" class="flex flex-col hover:text-primary transition-colors cursor-pointer">
                    <span class="font-semibold">${u.codice_pod || '-'}</span>
                    <span class="text-[12px] text-text-muted mt-0.5 compact-hide">${u.indirizzo}</span>
                </a>
            </td>
            <td class="py-4 px-6 text-on-surface">${u.periodo}</td>
            <td class="py-4 px-6 text-secondary">
                <span class="inline-flex items-center px-3 py-1 text-[12px] font-bold rounded-lg" style="background-color: ${tipologiaBg}; color: ${tipologiaColor};">${u.tipologia}</span>
            </td>
            <td class="py-4 px-6">
                <a href="letture.html?search=${encodeURIComponent(u.codice_parlante)}" class="text-on-surface hover:text-primary transition-colors cursor-pointer">
                    ${u.letture}
                </a>
            </td>
            <td class="py-4 px-6">
                <span class="inline-flex items-center px-3 py-1 text-[12px] font-bold rounded-lg" style="background-color: ${statoBg}; color: ${statoColor};">
                    <span class="w-1.5 h-1.5 rounded-full ${statoDotColor} mr-1.5" style="background-color: currentcolor;"></span>
                    ${statoText}
                </span>
            </td>
            <td class="py-4 px-6 relative td-actions">
                <button class="p-2 text-text-muted hover:text-primary transition-colors hover:bg-surface-container-low rounded-lg toggle-dropdown" data-target="dropdown-utenze-${index}" ${u.stato !== 'attiva' ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                    <span class="material-symbols-outlined text-[20px]">more_vert</span>
                </button>
                <div class="dropdown-menu" id="dropdown-utenze-${index}" style="right: 1.5rem; top: 3rem;">
                    <button class="dropdown-item btn-edit-utenza" data-utenza='${encodeURIComponent(JSON.stringify(u)).replace(/'/g, "%27")}'>
                        <span class="material-symbols-outlined icon-primary">edit</span>
                        Modifica
                    </button>
                    <button class="dropdown-item danger btn-chiudi-utenza" data-utenza='${encodeURIComponent(JSON.stringify(u)).replace(/'/g, "%27")}'>
                        <span class="material-symbols-outlined icon-danger">document_scanner</span>
                        Chiudi Contratto
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Attacchiamo gli event listeners ai nuovi dropdown
    const newBtns = tbody.querySelectorAll('.toggle-dropdown');
    newBtns.forEach(btn => {
        // Rimuoviamo eventuali cloni listener se l'elemento fosse stato riciclato (non in questo caso, ma buona pratica)
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            // Chiudi gli altri
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                if (menu.id !== newBtn.dataset.target) {
                    menu.classList.remove('show');
                }
            });

            // Apri o chiudi il target
            const targetMenu = document.getElementById(newBtn.dataset.target);
            targetMenu.classList.toggle('show');
        });
    });

    // Attacchiamo event listener per aprire il modal ai bottoni Modifica
    tbody.querySelectorAll('.btn-edit-utenza').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dataStr = btn.getAttribute('data-utenza');
            const data = JSON.parse(decodeURIComponent(dataStr));
            openModal(data);
        });
    });

    // Attacchiamo event listener per aprire il modal ai bottoni Chiudi Contratto
    tbody.querySelectorAll('.btn-chiudi-utenza').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dataStr = btn.getAttribute('data-utenza');
            const data = JSON.parse(decodeURIComponent(dataStr));
            openChiusuraModal(data);
        });
    });
}

// ============================================================================
// LOGICA MODAL E TOAST (CRUD)
// ============================================================================

let debounceTimeoutVoltura = null;
let selectedVolturaCliente = null;

async function fetchVolturaClients(searchTerm) {
    try {
        const url = searchTerm.trim().length > 0
            ? `api/clienti/list.php?limit=15&search=${encodeURIComponent(searchTerm)}`
            : `api/clienti/list.php?limit=15`;

        const res = await fetchAPI(url);
        const container = document.getElementById('edit-cliente-suggestions');
        container.innerHTML = '';

        if (res && res.success) {
            container.classList.remove('hidden');
            if (!clientiMap) clientiMap = {};

            if (res.clienti.length === 0) {
                container.innerHTML = '<div class="no-suggestions">Nessun cliente trovato</div>';
            } else {
                res.clienti.forEach(c => {
                    const label = `${c.ragSoc} - P.IVA/CF: ${c.cf_piva}`;
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.textContent = label;
                    item.addEventListener('click', () => {
                        const editCliente = document.getElementById('edit-cliente');
                        editCliente.value = label;
                        selectedVolturaCliente = { id: c.id_cliente, label: label };
                        clientiMap[label] = c.id_cliente; // Mappiamo la label al suo codice
                        container.classList.add('hidden');

                        // Genera evento input per far sì che si sblocchi la convalida
                        const event = new Event('input', { bubbles: true });
                        editCliente.dispatchEvent(event);
                    });
                    container.appendChild(item);
                });
            }
        }
    } catch (e) {
        console.error("Errore caricamento dinamico clienti voltura", e);
    }
}

function openModal(data) {
    pendingSaveData = data;

    // Popola campi base
    document.getElementById('modal-title').textContent = `Modifica Utenza: ${data.codice_parlante}`;
    document.getElementById('edit-id-utenza').value = data.id_utenza;
    document.getElementById('edit-id-utenza').dataset.parlante = data.codice_parlante;

    const badge = document.getElementById('edit-stato-badge');
    const badgeText = document.getElementById('edit-stato-text');
    if (data.stato === 'attiva') {
        badge.className = 'status-badge success';
        badgeText.textContent = 'Attiva';
    } else {
        badge.className = 'status-badge neutral';
        badgeText.textContent = 'Inattiva';
    }

    // Data apertura
    let dateStr = data.data_apertura_raw;
    if (dateStr) {
        const dateObj = new Date(dateStr);
        const mesi = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
        document.getElementById('edit-data-apertura').textContent = dateObj.getDate() + ' ' + mesi[dateObj.getMonth()] + ' ' + dateObj.getFullYear();
    } else {
        document.getElementById('edit-data-apertura').textContent = '-';
    }

    // Cliente e Voltura
    const editCliente = document.getElementById('edit-cliente');
    editCliente.value = data.cliente;
    editCliente.dataset.id_cliente = data.id_cliente;
    editCliente.dataset.original_value = data.cliente;
    editCliente.dataset.original_id = data.id_cliente;
    selectedVolturaCliente = { id: data.id_cliente, label: data.cliente };
    editCliente.disabled = true;
    editCliente.readOnly = true;
    editCliente.classList.add('disabled:opacity-50', 'disabled:cursor-not-allowed');

    document.getElementById('edit-lettura-voltura').value = '';
    document.getElementById('voltura-section').style.display = 'none';
    document.getElementById('btn-voltura').style.display = 'inline-flex';

    document.getElementById('modal-save').style.display = 'flex';
    document.getElementById('btn-conferma-voltura').style.display = 'none';
    document.getElementById('btn-conferma-voltura').disabled = true;
    document.getElementById('btn-conferma-voltura').style.opacity = '0.5';
    document.getElementById('btn-conferma-voltura').style.cursor = 'not-allowed';

    document.getElementById('modal-save').disabled = true;
    document.getElementById('modal-save').style.opacity = '0.5';
    document.getElementById('modal-save').style.cursor = 'not-allowed';

    // Indirizzo fornitura (readonly)
    document.getElementById('edit-indirizzo-fornitura').value = data.indirizzo;

    // Fatturazione
    document.getElementById('edit-indirizzo-fatturazione').value = data.indirizzo_fatturazione || '';
    document.getElementById('edit-citta-fatturazione').value = data.citta_fatturazione || '';
    document.getElementById('use-supply-address').checked = false;
    document.getElementById('edit-indirizzo-fatturazione').disabled = false;
    document.getElementById('edit-citta-fatturazione').disabled = false;

    // Contratti
    const tipologia = data.tipologia;
    const contractDomestico = document.getElementById('contract-domestico');
    const contractBusiness = document.getElementById('contract-business');

    if (tipologia.includes('Domestico')) {
        contractDomestico.checked = true;
        const radios = document.getElementsByName('tipo_domestico');
        if (tipologia.includes('Non Residente')) {
            radios[1].checked = true; // Non Residente
        } else {
            radios[0].checked = true; // Residente
        }
        document.getElementById('edit-componenti').value = data.componenti_nucleo || 1;
    } else {
        contractBusiness.checked = true;
        const radios = document.getElementsByName('tipo_business');
        if (tipologia.includes('Industriale')) {
            radios[1].checked = true; // Industriale
        } else {
            radios[0].checked = true; // Commerciale
        }
    }

    // Trigger updates
    updateSuboptions();
    updateCardStyles();

    // Mostra modale
    document.getElementById('edit-modal').classList.add('active');
    document.body.classList.add('modal-open');

    // Inizializza stato dirty
    initialEditPayload = getEditPayload();
    checkEditDirty();
}

function closeModal() {
    document.getElementById('edit-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
    document.getElementById('edit-cliente-suggestions').classList.add('hidden');
    pendingSaveData = null;
}

function updateSuboptions() {
    const contractDomestico = document.getElementById('contract-domestico');
    const contractBusiness = document.getElementById('contract-business');
    const domesticoSuboptions = document.getElementById('domestico-suboptions');
    const businessSuboptions = document.getElementById('business-suboptions');
    const nucleoFamiliareContainer = document.getElementById('nucleo-familiare-container');

    if (contractDomestico.checked) {
        domesticoSuboptions.style.display = 'flex';
        businessSuboptions.style.display = 'none';

        // Controlla il residente/non residente
        let isResidente = false;
        document.getElementsByName('tipo_domestico').forEach(r => {
            if (r.checked && r.value === 'Residente') isResidente = true;
        });
        nucleoFamiliareContainer.style.display = isResidente ? 'block' : 'none';
    } else {
        domesticoSuboptions.style.display = 'none';
        businessSuboptions.style.display = 'flex';
        nucleoFamiliareContainer.style.display = 'none';
    }
}

function updateCardStyles() {
    document.querySelectorAll('.radio-card-input').forEach(radio => {
        const card = radio.nextElementSibling;
        if (radio.checked) {
            // Checked state è gestito via CSS per lo più, 
            // ma se servono classi aggiuntive JS possiamo metterle qui.
        }
    });
}

function setupModalEvents() {
    // Chiusura Modale
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    // Usa Indirizzo Fornitura
    const useSupplyCb = document.getElementById('use-supply-address');
    const billAdd = document.getElementById('edit-indirizzo-fatturazione');
    const billCity = document.getElementById('edit-citta-fatturazione');

    useSupplyCb.addEventListener('change', (e) => {
        if (e.target.checked && pendingSaveData) {
            billAdd.dataset.oldVal = billAdd.value;
            billCity.dataset.oldVal = billCity.value;

            billAdd.value = pendingSaveData.indirizzo_puro || '';
            billCity.value = pendingSaveData.citta_pura || '';

            billAdd.disabled = true;
            billCity.disabled = true;
        } else {
            billAdd.value = billAdd.dataset.oldVal || '';
            billCity.value = billCity.dataset.oldVal || '';
            billAdd.disabled = false;
            billCity.disabled = false;
        }
    });

    // Cambi di contratto
    document.getElementsByName('tipo_contratto').forEach(r => {
        r.addEventListener('change', () => {
            updateSuboptions();
            updateCardStyles();
        });
    });

    document.getElementsByName('tipo_domestico').forEach(r => {
        r.addEventListener('change', updateSuboptions);
    });


    const volturaInput = document.getElementById('edit-cliente');
    // Ricerca Dinamica Voltura
    volturaInput.addEventListener('focus', (e) => {
        const volturaSection = document.getElementById('voltura-section');
        if (volturaSection.style.display !== 'none') {
            fetchVolturaClients(e.target.value);
        }
    });
    volturaInput.addEventListener('click', (e) => {
        const volturaSection = document.getElementById('voltura-section');
        if (volturaSection.style.display !== 'none') {
            fetchVolturaClients(e.target.value);
        }
    });
    volturaInput.addEventListener('input', (e) => {
        const volturaSection = document.getElementById('voltura-section');
        if (volturaSection.style.display !== 'none') {
            clearTimeout(debounceTimeoutVoltura);
            debounceTimeoutVoltura = setTimeout(() => {
                fetchVolturaClients(e.target.value);
            }, 300);

            // Validazione per abilitare conferma voltura:
            // Usa la funzione centralizzata che controlla SIA il cliente CHE la lettura
            checkVolturaValidity();
        }
    });
    volturaInput.addEventListener('blur', () => {
        const volturaSection = document.getElementById('voltura-section');
        if (volturaSection.style.display !== 'none') {
            setTimeout(() => {
                const val = volturaInput.value;
                if (!selectedVolturaCliente || selectedVolturaCliente.label !== val) {
                    volturaInput.value = '';
                    selectedVolturaCliente = null;

                    checkVolturaValidity();
                }
            }, 200);
        }
    });

    // Listeners per salvataggio modifiche
    const editModal = document.getElementById('edit-modal');
    editModal.addEventListener('input', checkEditDirty);
    editModal.addEventListener('change', checkEditDirty);

    // Gestione UI Voltura
    const btnVoltura = document.getElementById('btn-voltura');
    const volturaSection = document.getElementById('voltura-section');
    const btnAnnullaVoltura = document.getElementById('btn-annulla-voltura');
    const btnConfermaVoltura = document.getElementById('btn-conferma-voltura');
    const modalSaveBtn = document.getElementById('modal-save');

    btnVoltura.addEventListener('click', () => {
        volturaSection.style.display = 'flex';
        btnVoltura.style.display = 'none';
        btnConfermaVoltura.style.display = 'flex';
        modalSaveBtn.style.display = 'none';

        // Abilita editing su edit-cliente
        volturaInput.disabled = false;
        volturaInput.readOnly = false;
        volturaInput.classList.remove('disabled:opacity-50', 'disabled:cursor-not-allowed');
        volturaInput.value = ''; // svuota per costringere a cambiare
        selectedVolturaCliente = null;
        volturaInput.focus();

        // Disabilita conferma inizialmente
        btnConfermaVoltura.disabled = true;
        btnConfermaVoltura.style.opacity = '0.5';
        btnConfermaVoltura.style.cursor = 'not-allowed';
    });

    btnAnnullaVoltura.addEventListener('click', () => {
        volturaSection.style.display = 'none';
        btnVoltura.style.display = 'inline-flex';
        btnConfermaVoltura.style.display = 'none';
        modalSaveBtn.style.display = 'flex';

        // Ripristina e blocca edit-cliente
        volturaInput.disabled = true;
        volturaInput.readOnly = true;
        volturaInput.classList.add('disabled:opacity-50', 'disabled:cursor-not-allowed');
        volturaInput.value = volturaInput.dataset.original_value;
        volturaInput.dataset.id_cliente = volturaInput.dataset.original_id;
        selectedVolturaCliente = { id: volturaInput.dataset.original_id, label: volturaInput.dataset.original_value };

        document.getElementById('edit-lettura-voltura').value = '';
        checkEditDirty(); // Ricalcola stato del pulsante Salva
    });

    document.getElementById('edit-lettura-voltura').addEventListener('input', () => {
        if (volturaSection.style.display !== 'none') {
            checkVolturaValidity();
        }
    });

    modalSaveBtn.addEventListener('click', () => initiateSaveWithUndo(false));
    btnConfermaVoltura.addEventListener('click', () => initiateSaveWithUndo(true));

    // Toast Annulla (Undo) - non più in uso per l'edit
    // document.getElementById('btn-undo').addEventListener('click', cancelSave);

    // Toast Annulla (Undo)
    document.getElementById('btn-undo').addEventListener('click', cancelSave);
}

function getEditPayload() {
    const id_utenza = document.getElementById('edit-id-utenza').value;

    let tipologia = '';
    let componenti_nucleo = null;
    if (document.getElementById('contract-domestico').checked) {
        document.getElementsByName('tipo_domestico').forEach(r => {
            if (r.checked) tipologia = "Domestico " + r.value;
        });
        if (tipologia === 'Domestico Residente') {
            componenti_nucleo = document.getElementById('edit-componenti').value;
        }
    } else {
        document.getElementsByName('tipo_business').forEach(r => {
            if (r.checked) tipologia = r.value;
        });
    }

    let id_cliente = document.getElementById('edit-cliente').dataset.id_cliente;

    return {
        id_utenza: id_utenza,
        id_cliente: id_cliente,
        indirizzo_fatturazione: document.getElementById('edit-indirizzo-fatturazione').value,
        citta_fatturazione: document.getElementById('edit-citta-fatturazione').value,
        tipologia: tipologia,
        componenti_nucleo: componenti_nucleo
    };
}

function checkEditDirty() {
    // Se siamo in modalità voltura, non valutiamo il dirty state del salvataggio normale
    const volturaSection = document.getElementById('voltura-section');
    if (volturaSection.style.display !== 'none') return;

    if (!initialEditPayload) return;
    const currentPayload = getEditPayload();
    const isDirty = JSON.stringify(initialEditPayload) !== JSON.stringify(currentPayload);
    const saveBtn = document.getElementById('modal-save');
    if (isDirty) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
        saveBtn.style.cursor = 'pointer';
    } else {
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.5';
        saveBtn.style.cursor = 'not-allowed';
    }
}

function checkVolturaValidity() {
    const volturaInput = document.getElementById('edit-cliente');
    const letturaInput = document.getElementById('edit-lettura-voltura');
    const btnConfermaVoltura = document.getElementById('btn-conferma-voltura');

    const originalVal = volturaInput.dataset.original_value;
    const newVal = volturaInput.value;
    const letturaVal = letturaInput.value;

    const isClientValid = selectedVolturaCliente && selectedVolturaCliente.label === newVal && selectedVolturaCliente.label !== originalVal;
    const isLetturaValid = letturaVal !== '' && parseInt(letturaVal) >= 0;

    if (isClientValid && isLetturaValid) {
        btnConfermaVoltura.disabled = false;
        btnConfermaVoltura.style.opacity = '1';
        btnConfermaVoltura.style.cursor = 'pointer';
    } else {
        btnConfermaVoltura.disabled = true;
        btnConfermaVoltura.style.opacity = '0.5';
        btnConfermaVoltura.style.cursor = 'not-allowed';
    }
}

let pendingSaveType = null; // 'edit' o 'voltura'
let pendingPayload = null;

function initiateSaveWithUndo(isVoltura) {
    // 1. Determina il tipo e raccogli i dati
    pendingSaveType = isVoltura ? 'voltura' : 'edit';

    if (isVoltura) {
        const id_utenza = document.getElementById('edit-id-utenza').value;
        const letturaValore = document.getElementById('edit-lettura-voltura').value;

        if (letturaValore === '' || parseInt(letturaValore) < 0) {
            alert("Attenzione: devi inserire un valore di lettura iniziale/finale valido per confermare la voltura.");
            return;
        }

        let id_nuovo_cliente = selectedVolturaCliente ? selectedVolturaCliente.id : null;

        pendingPayload = {
            id_vecchia_utenza: id_utenza,
            id_nuovo_cliente: id_nuovo_cliente,
            lettura_voltura: letturaValore
        };
    } else {
        pendingPayload = getEditPayload();
    }

    // 2. Chiudi Modal
    closeModal();

    // 3. Mostra Toast con testo personalizzato
    const id_utenza = document.getElementById('edit-id-utenza').value;
    const parlante = document.getElementById('edit-id-utenza').dataset.parlante || id_utenza;
    const toastText = document.getElementById('toast-text');

    if (isVoltura) {
        toastText.innerHTML = `Voltura per utenza <span style="font-weight: 600;">${parlante}</span> avviata...`;
    } else {
        toastText.innerHTML = `Utenza <span style="font-weight: 600;">${parlante}</span> modificata con successo`;
    }

    const toast = document.getElementById('undo-toast');
    toast.classList.add('show');

    // 4. SetTimeout per 4 secondi
    clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => {
        if (pendingSaveType === 'voltura') {
            executeVoltura(pendingPayload);
        } else {
            executeSave(pendingPayload);
        }
        toast.classList.remove('show');
    }, 4000);
}

function cancelSave() {
    clearTimeout(undoTimeout);
    document.getElementById('undo-toast').classList.remove('show');
    console.log("Operazione annullata dall'utente.");

    // Riapre il modal con i dati ancora inseriti
    document.getElementById('edit-modal').classList.add('active');
    document.body.classList.add('modal-open');
}

async function executeSave(payload) {
    try {
        const response = await fetch('api/utenze/update.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) {
            loadUtenze(true);
        } else {
            console.error("Errore salvataggio utenza:", result.message);
            alert("Errore salvataggio: " + result.message);
        }
    } catch (e) {
        console.error("Errore rete salvataggio:", e);
    }
}

async function executeVoltura(payload) {
    try {
        const response = await fetch('api/utenze/voltura.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (result.success) {
            alert("Voltura completata con successo! È stata generata la fattura di chiusura e registrate le letture.");
            loadUtenze(true);
        } else {
            alert("Errore durante la voltura: " + result.message);
        }
    } catch (e) {
        console.error("Errore rete voltura:", e);
        alert("Errore di connessione durante la voltura.");
    }
}



// ============================================================================
// LOGICA MODAL CREAZIONE NUOVA UTENZA
// ============================================================================

let createUndoTimeout = null;
let pendingCreatePayload = null;
let selectedCreateCliente = null;
let selectedCreatePod = null;
let debounceTimeoutCreateCliente = null;
let debounceTimeoutCreatePod = null;

async function fetchCreateClienti(searchTerm) {
    try {
        const url = searchTerm.trim().length > 0
            ? `api/clienti/list.php?limit=15&search=${encodeURIComponent(searchTerm)}`
            : `api/clienti/list.php?limit=15`;

        const res = await fetchAPI(url);
        const container = document.getElementById('create-cliente-suggestions');
        container.innerHTML = '';

        if (res && res.success) {
            if (res.clienti.length === 0) {
                container.innerHTML = '<div class="no-suggestions">Nessun cliente trovato</div>';
            } else {
                res.clienti.forEach(c => {
                    const label = `${c.ragSoc} - P.IVA/CF: ${c.cf_piva}`;
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.textContent = label;
                    item.addEventListener('click', () => {
                        document.getElementById('create-cliente').value = label;
                        selectedCreateCliente = { id: c.id_cliente, label: label };
                        container.classList.add('hidden');
                    });
                    container.appendChild(item);
                });
            }
            container.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Errore fetch create clienti:", e);
    }
}

async function fetchCreatePuntiFornitura(searchTerm) {
    try {
        const url = searchTerm.trim().length > 0
            ? `api/punti_fornitura/list.php?limit=15&stato=Libero&search=${encodeURIComponent(searchTerm)}`
            : `api/punti_fornitura/list.php?limit=15&stato=Libero`;

        const res = await fetchAPI(url);
        const container = document.getElementById('create-pod-suggestions');
        container.innerHTML = '';

        if (res && res.success) {
            if (res.data.length === 0) {
                container.innerHTML = '<div class="no-suggestions">Non ci sono POD liberi</div>';
            } else {
                res.data.forEach(p => {
                    const label = `${p.indirizzo} - ${p.città} (POD: ${p.codice_pod})`;
                    const item = document.createElement('div');
                    item.className = 'suggestion-item';
                    item.textContent = label;
                    item.addEventListener('click', () => {
                        document.getElementById('create-indirizzo-fornitura').value = label;
                        selectedCreatePod = { id: p.codice_pod, label: label, indirizzo: p.indirizzo, citta: p.città };
                        container.classList.add('hidden');

                        // Auto-fill supply address if checkbox is checked
                        const useSupplyCb = document.getElementById('create-use-supply-address');
                        if (useSupplyCb && useSupplyCb.checked) {
                            document.getElementById('create-indirizzo-fatturazione').value = p.indirizzo;
                            document.getElementById('create-citta-fatturazione').value = p.città;
                        }
                    });
                    container.appendChild(item);
                });
            }
            container.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Errore fetch create POD liberi:", e);
    }
}

function openCreateModal() {
    selectedCreateCliente = null;
    selectedCreatePod = null;
    // Reset fields
    document.getElementById('create-cliente').value = '';
    document.getElementById('create-indirizzo-fornitura').value = '';
    document.getElementById('create-indirizzo-fatturazione').value = '';
    document.getElementById('create-citta-fatturazione').value = '';
    document.getElementById('create-use-supply-address').checked = false;
    document.getElementById('create-indirizzo-fatturazione').disabled = false;
    document.getElementById('create-citta-fatturazione').disabled = false;

    document.getElementById('create-contract-domestico').checked = true;
    document.getElementsByName('create_tipo_domestico')[0].checked = true; // Residente
    document.getElementById('create-componenti').value = 1;

    updateCreateSuboptions();

    document.getElementById('create-modal').classList.add('active');
    document.body.classList.add('modal-open');
}

function closeCreateModal() {
    document.getElementById('create-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
    document.getElementById('create-cliente-suggestions').classList.add('hidden');
    document.getElementById('create-pod-suggestions').classList.add('hidden');
}

function updateCreateSuboptions() {
    const contractDomestico = document.getElementById('create-contract-domestico');
    const contractBusiness = document.getElementById('create-contract-business');
    const domesticoSuboptions = document.getElementById('create-domestico-suboptions');
    const businessSuboptions = document.getElementById('create-business-suboptions');
    const nucleoFamiliareContainer = document.getElementById('create-nucleo-familiare-container');

    if (contractDomestico.checked) {
        domesticoSuboptions.style.display = 'flex';
        businessSuboptions.style.display = 'none';

        let isResidente = false;
        document.getElementsByName('create_tipo_domestico').forEach(r => {
            if (r.checked && r.value === 'Residente') isResidente = true;
        });
        nucleoFamiliareContainer.style.display = isResidente ? 'block' : 'none';
    } else {
        domesticoSuboptions.style.display = 'none';
        businessSuboptions.style.display = 'flex';
        nucleoFamiliareContainer.style.display = 'none';
    }
}

function setupCreateModalEvents() {
    const btnNewUtenza = document.getElementById('btn-new-utenza');
    if (btnNewUtenza) {
        btnNewUtenza.addEventListener('click', openCreateModal);
    }

    document.getElementById('create-modal-close').addEventListener('click', closeCreateModal);
    document.getElementById('create-modal-cancel').addEventListener('click', closeCreateModal);

    // Ricerca Dinamica Cliente
    const inputCliente = document.getElementById('create-cliente');
    inputCliente.addEventListener('focus', (e) => {
        fetchCreateClienti(e.target.value);
    });
    inputCliente.addEventListener('click', (e) => {
        fetchCreateClienti(e.target.value);
    });
    inputCliente.addEventListener('input', (e) => {
        clearTimeout(debounceTimeoutCreateCliente);
        debounceTimeoutCreateCliente = setTimeout(() => {
            fetchCreateClienti(e.target.value);
        }, 300);
    });
    inputCliente.addEventListener('blur', () => {
        setTimeout(() => {
            const val = inputCliente.value;
            if (!selectedCreateCliente || selectedCreateCliente.label !== val) {
                inputCliente.value = '';
                selectedCreateCliente = null;
            }
        }, 200);
    });

    // Ricerca Dinamica POD Libero
    const inputPod = document.getElementById('create-indirizzo-fornitura');
    inputPod.addEventListener('focus', (e) => {
        fetchCreatePuntiFornitura(e.target.value);
    });
    inputPod.addEventListener('click', (e) => {
        fetchCreatePuntiFornitura(e.target.value);
    });
    inputPod.addEventListener('input', (e) => {
        clearTimeout(debounceTimeoutCreatePod);
        debounceTimeoutCreatePod = setTimeout(() => {
            fetchCreatePuntiFornitura(e.target.value);
        }, 300);
    });
    inputPod.addEventListener('blur', () => {
        setTimeout(() => {
            const val = inputPod.value;
            if (!selectedCreatePod || selectedCreatePod.label !== val) {
                inputPod.value = '';
                selectedCreatePod = null;
            }
        }, 200);
    });

    // Chiusura tendine al click esterno
    document.addEventListener('click', (e) => {
        const clienteInput = document.getElementById('create-cliente');
        const clienteSuggestions = document.getElementById('create-cliente-suggestions');
        if (clienteInput && !clienteInput.contains(e.target) && !clienteSuggestions.contains(e.target)) {
            clienteSuggestions.classList.add('hidden');
        }

        const editClienteInput = document.getElementById('edit-cliente');
        const editClienteSuggestions = document.getElementById('edit-cliente-suggestions');
        if (editClienteInput && !editClienteInput.contains(e.target) && !editClienteSuggestions.contains(e.target)) {
            editClienteSuggestions.classList.add('hidden');
        }

        const podInput = document.getElementById('create-indirizzo-fornitura');
        const podSuggestions = document.getElementById('create-pod-suggestions');
        if (podInput && !podInput.contains(e.target) && !podSuggestions.contains(e.target)) {
            podSuggestions.classList.add('hidden');
        }
    });

    // Cambi di contratto
    document.getElementsByName('create_tipo_contratto').forEach(r => {
        r.addEventListener('change', updateCreateSuboptions);
    });
    document.getElementsByName('create_tipo_domestico').forEach(r => {
        r.addEventListener('change', updateCreateSuboptions);
    });

    // Indirizzo di fatturazione uguale a fornitura
    const useSupplyCb = document.getElementById('create-use-supply-address');
    const billAdd = document.getElementById('create-indirizzo-fatturazione');
    const billCity = document.getElementById('create-citta-fatturazione');

    useSupplyCb.addEventListener('change', (e) => {
        if (e.target.checked) {
            billAdd.dataset.oldVal = billAdd.value;
            billCity.dataset.oldVal = billCity.value;

            if (selectedCreatePod) {
                billAdd.value = selectedCreatePod.indirizzo;
                billCity.value = selectedCreatePod.citta;
            } else {
                billAdd.value = '';
                billCity.value = '';
            }

            billAdd.disabled = true;
            billCity.disabled = true;
        } else {
            billAdd.value = billAdd.dataset.oldVal || '';
            billCity.value = billCity.dataset.oldVal || '';
            billAdd.disabled = false;
            billCity.disabled = false;
        }
    });

    // Salva Nuova Utenza (apre il modal per inserire la lettura)
    document.getElementById('create-modal-save').addEventListener('click', initiateCreateWithUndo);

    // Gestione bottoni create-lettura-modal
    document.getElementById('create-lettura-modal-close').addEventListener('click', closeCreateLetturaModal);
    document.getElementById('create-lettura-modal-cancel').addEventListener('click', closeCreateLetturaModal);
    document.getElementById('create-lettura-modal-save').addEventListener('click', confirmCreateLettura);

    // Annulla Toast (Undo)
    document.getElementById('create-btn-undo').addEventListener('click', cancelCreateSave);
}

function closeCreateLetturaModal() {
    // 1. Chiude la modale della lettura
    document.getElementById('create-lettura-modal').classList.remove('active');

    // 2. Rimuove il blocco/blur dallo sfondo della pagina
    document.body.classList.remove('modal-open');

    // 3. Per sicurezza, si assicura che anche la modale principale di creazione sia chiusa
    document.getElementById('create-modal').classList.remove('active');
}

function initiateCreateWithUndo() {
    const inputClienteVal = document.getElementById('create-cliente').value;
    const inputPodVal = document.getElementById('create-indirizzo-fornitura').value;

    if (!selectedCreateCliente || selectedCreateCliente.label !== inputClienteVal) {
        alert("Seleziona un cliente valido cliccandolo dall'elenco dei suggerimenti.");
        return;
    }
    if (!selectedCreatePod || selectedCreatePod.label !== inputPodVal) {
        alert("Seleziona un Punto di Fornitura valido cliccandolo dall'elenco dei suggerimenti.");
        return;
    }

    const id_cliente = selectedCreateCliente.id;
    const codice_pod = selectedCreatePod.id;

    let tipologia = '';
    let componenti_nucleo = null;

    if (document.getElementById('create-contract-domestico').checked) {
        document.getElementsByName('create_tipo_domestico').forEach(r => {
            if (r.checked) tipologia = "Domestico " + r.value;
        });
        if (tipologia === 'Domestico Residente') {
            componenti_nucleo = document.getElementById('create-componenti').value;
        }
    } else {
        document.getElementsByName('create_tipo_business').forEach(r => {
            if (r.checked) tipologia = r.value;
        });
    }

    pendingCreatePayload = {
        id_cliente: id_cliente,
        codice_pod: codice_pod,
        indirizzo_fatturazione: document.getElementById('create-indirizzo-fatturazione').value,
        citta_fatturazione: document.getElementById('create-citta-fatturazione').value,
        tipologia: tipologia,
        componenti_nucleo: componenti_nucleo
    };

    // Pulisce e apre il modal della lettura iniziale
    document.getElementById('create-lettura-valore').value = '';
    document.getElementById('create-modal').classList.remove('active');
    document.getElementById('create-lettura-modal').classList.add('active');
}

function confirmCreateLettura() {
    const letturaVal = document.getElementById('create-lettura-valore').value;

    if (letturaVal === '' || parseInt(letturaVal) < 0) {
        alert("Inserisci un valore valido (maggiore o uguale a 0) per la lettura iniziale.");
        return;
    }

    if (!pendingCreatePayload) return;

    pendingCreatePayload.lettura_iniziale = letturaVal;

    closeCreateLetturaModal();
    closeCreateModal();

    const toast = document.getElementById('create-undo-toast');
    toast.classList.add('show');

    clearTimeout(createUndoTimeout);
    createUndoTimeout = setTimeout(() => {
        executeCreate(pendingCreatePayload);
        toast.classList.remove('show');
    }, 4000);
}

function cancelCreateSave() {
    clearTimeout(createUndoTimeout);
    document.getElementById('create-undo-toast').classList.remove('show');
    console.log("Creazione annullata dall'utente.");

    // Riapre il modal con i dati ancora inseriti
    document.getElementById('create-modal').classList.add('active');
    document.body.classList.add('modal-open');
}

async function executeCreate(payload) {
    try {
        const response = await fetch('api/utenze/create.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.success) {
            loadUtenze(true);

            // Mostra toast di avvenuta creazione
            const successToast = document.getElementById('create-success-toast');
            if (successToast) {
                const parlante = result.codice_parlante;
                document.getElementById('toast-create-parlante').textContent = parlante;
                successToast.classList.add('show');
                setTimeout(() => {
                    successToast.classList.remove('show');
                }, 4000);
            }
        } else {
            console.error("Errore creazione utenza:", result.message);
            alert("Errore creazione: " + result.message);
        }
    } catch (e) {
        console.error("Errore rete creazione:", e);
    }
}

// ============================================================================
// LOGICA CHIUSURA CONTRATTO (Modal & Undo Toast)
// ============================================================================

async function openChiusuraModal(data) {
    pendingChiusuraData = data;
    document.getElementById('chiusura-modal-title').textContent = `Chiudi Contratto: ${data.codice_parlante}`;
    document.getElementById('chiusura-id-utenza').value = data.id_utenza;
    document.getElementById('chiusura-parlante').value = data.codice_parlante;
    document.getElementById('chiusura-lettura-valore').value = '';

    document.getElementById('chiusura-ultima-lettura').textContent = "Caricamento...";

    document.getElementById('chiusura-modal').classList.add('active');
    document.body.classList.add('modal-open');

    // Fetch dell'ultima lettura per mostrarla
    try {
        const response = await fetchAPI(`api/letture/list.php?search=${encodeURIComponent(data.codice_parlante)}&limit=1&sort=data:desc`);
        if (response && response.success && response.data && response.data.length > 0) {
            const lastReading = response.data[0].valore;
            document.getElementById('chiusura-ultima-lettura').textContent = lastReading + " m³";
        } else {
            document.getElementById('chiusura-ultima-lettura').textContent = "Nessuna";
        }
    } catch (e) {
        document.getElementById('chiusura-ultima-lettura').textContent = "Errore";
    }
}

function closeChiusuraModal() {
    document.getElementById('chiusura-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
}

function initiateChiusuraWithUndo() {
    const id_utenza = document.getElementById('chiusura-id-utenza').value;
    const codice_parlante = document.getElementById('chiusura-parlante').value;
    const letturaValore = document.getElementById('chiusura-lettura-valore').value;

    if (letturaValore === '') {
        alert("Inserisci un valore per la lettura finale.");
        return;
    }

    pendingChiusuraData = {
        id_utenza: id_utenza,
        codice_parlante: codice_parlante,
        valore_lettura: parseInt(letturaValore)
    };

    closeChiusuraModal();

    const toast = document.getElementById('chiusura-undo-toast');
    document.getElementById('toast-chiusura-parlante').textContent = codice_parlante;

    toast.classList.remove('show');
    void toast.offsetWidth; // trigger reflow
    toast.classList.add('show');

    chiusuraTimeout = setTimeout(() => {
        executeChiusura();
    }, 4000);
}

function cancelChiusura() {
    if (chiusuraTimeout) {
        clearTimeout(chiusuraTimeout);
        chiusuraTimeout = null;
    }
    document.getElementById('chiusura-undo-toast').classList.remove('show');
    pendingChiusuraData = null;
}

async function executeChiusura() {
    document.getElementById('chiusura-undo-toast').classList.remove('show');

    if (!pendingChiusuraData) return;

    try {
        const response = await fetchAPI('api/utenze/close.php', 'POST', pendingChiusuraData);

        if (response && response.success) {
            loadUtenze(true); // Ricarica tabella per vedere lo stato inattiva
        } else {
            alert("Errore durante la chiusura: " + (response ? response.message : "Errore sconosciuto"));
        }
    } catch (e) {
        console.error("Errore fetch close utenza:", e);
        alert("Si è verificato un errore di rete durante la chiusura.");
    } finally {
        pendingChiusuraData = null;
    }
}

function setupChiusuraModalEvents() {
    const closeBtn = document.getElementById('chiusura-modal-close');
    const cancelBtn = document.getElementById('chiusura-modal-cancel');
    const saveBtn = document.getElementById('chiusura-modal-save');
    const undoBtn = document.getElementById('chiusura-btn-undo');

    if (closeBtn) closeBtn.addEventListener('click', closeChiusuraModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeChiusuraModal);
    if (saveBtn) saveBtn.addEventListener('click', initiateChiusuraWithUndo);
    if (undoBtn) undoBtn.addEventListener('click', cancelChiusura);
}
