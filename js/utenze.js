// /js/utenze.js
import { fetchAPI } from './api.js';

let currentPage = 0;
const limit = 20;
let debounceTimeout = null;
let undoTimeout = null; // Per il Toast
let pendingSaveData = null; // Dati in attesa di salvataggio
let clientiMap = {}; // Mappa p.iva/nome -> id_cliente

document.addEventListener('DOMContentLoaded', () => {
    loadUtenze(true);
    setupModalEvents();
    setupCreateModalEvents();

    // Event listeners
    const searchInput = document.getElementById('search-input');
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
            for(let i=0; i<radios.length; i++){
                if(radios[i].value === 'all') radios[i].checked = true;
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
});

async function loadUtenze(reset = false) {
    if (reset) {
        currentPage = 0;
    }

    const searchInput = document.getElementById('search-input');
    const searchTerm = searchInput ? encodeURIComponent(searchInput.value) : '';
    
    // Get stato da radio button
    let statoFilter = 'all';
    const radios = document.getElementsByName('stato');
    for(let i=0; i<radios.length; i++){
        if(radios[i].checked) {
            statoFilter = radios[i].value;
            break;
        }
    }
    
    const tipologia = encodeURIComponent(document.getElementById('filter-tipologia')?.value || 'all');
    const zona = encodeURIComponent(document.getElementById('filter-zona')?.value || 'all');
    const dataDa = encodeURIComponent(document.getElementById('filter-date-from')?.value || '');
    const dataA = encodeURIComponent(document.getElementById('filter-date-to')?.value || '');
    
    const offset = currentPage * limit;

    const queryParams = `?limit=${limit}&offset=${offset}&search=${searchTerm}&stato=${statoFilter}&tipologia=${tipologia}&zona=${zona}&data_da=${dataDa}&data_a=${dataA}`;
    
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
        
        // Badge Tipologia (come in dashboard)
        let tipologiaClass = 'primary'; // Domestico Residente
        if (u.tipologia === 'Domestico Non Residente') tipologiaClass = 'badge-blue';
        if (u.tipologia === 'Commerciale') tipologiaClass = 'badge-yellow';
        if (u.tipologia === 'Industriale') tipologiaClass = 'badge-orange';
        if (u.tipologia === 'Business' || u.tipologia === 'Condominio') tipologiaClass = 'success';

        // Badge Stato
        const statoClass = (u.stato === 'attiva') ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600';
        const statoText = (u.stato === 'attiva') ? 'Attiva' : 'Inattiva';

        tr.innerHTML = `
            <td class="font-bold text-primary" style="font-size: 14px;">${u.id_utenza}</td>
            <td>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 600; color: #000;">${u.cliente_cf}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">${u.cliente}</span>
                </div>
            </td>
            <td>
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 500; color: #000;">${u.id_utenza.replace('U-', 'POD-')}</span>
                    <span style="font-size: 12px; color: var(--text-muted);">${u.indirizzo}</span>
                </div>
            </td>
            <td style="color: var(--text-muted);">${u.periodo}</td>
            <td>
                <span class="badge ${tipologiaClass}">${u.tipologia}</span>
            </td>
            <td style="color: var(--text-muted); font-weight: 500;">${u.letture}</td>
            <td>
                <span style="display: inline-flex; align-items: center; padding: 0.25rem 0.75rem; font-size: 12px; font-weight: 700; border-radius: 0.5rem; ${u.stato === 'attiva' ? 'background: rgba(0, 245, 212, 0.1); color: var(--accent-success-text);' : 'background: #f1f3f5; color: #495057;'}">
                    ${statoText}
                </span>
            </td>
            <td class="text-right td-actions">
                <button class="btn-icon toggle-dropdown" data-target="dropdown-utenze-${index}">
                    <span class="material-symbols-outlined">more_vert</span>
                </button>
                <div class="dropdown-menu" id="dropdown-utenze-${index}">
                    <button class="dropdown-item btn-edit-utenza" data-utenza='${encodeURIComponent(JSON.stringify(u)).replace(/'/g, "%27")}'>
                        <span class="material-symbols-outlined icon-primary">edit</span>
                        Modifica
                    </button>
                    <button class="dropdown-item danger">
                        <span class="material-symbols-outlined">delete</span>
                        Elimina
                    </button>
                    <hr style="margin: 4px 0;">
                    <button class="dropdown-item">
                        <span class="material-symbols-outlined icon-muted">document_scanner</span>
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
}

// ============================================================================
// LOGICA MODAL E TOAST (CRUD)
// ============================================================================

let debounceTimeoutVoltura = null;

async function fetchVolturaClients(searchTerm) {
    if (searchTerm.trim().length < 2) return; // Non cercare per stringhe troppo corte
    try {
        const res = await fetchAPI(`api/clienti/list.php?limit=15&search=${encodeURIComponent(searchTerm)}`);
        if (res && res.success) {
            const datalist = document.getElementById('clienti-datalist');
            datalist.innerHTML = '';
            // Non resettiamo clientiMap ogni volta per non perdere i mapping delle vecchie ricerche non salvate
            if (!clientiMap) clientiMap = {};
            
            res.clienti.forEach(c => {
                const opt = document.createElement('option');
                const label = `${c.ragSoc} - P.IVA/CF: ${c.cf_piva}`;
                opt.value = label;
                datalist.appendChild(opt);
                clientiMap[label] = c.id_cliente; // Mappiamo la label al suo codice
            });
        }
    } catch (e) {
        console.error("Errore caricamento dinamico clienti voltura", e);
    }
}

function openModal(data) {
    pendingSaveData = data;
    
    // Popola campi base
    document.getElementById('modal-title').textContent = `Modifica Utenza: ${data.id_utenza}`;
    document.getElementById('edit-id-utenza').value = data.id_utenza;
    
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
    const editClienteVoltura = document.getElementById('edit-cliente-voltura');
    editCliente.value = data.cliente;
    editCliente.dataset.id_cliente = data.id_cliente;
    editCliente.style.display = 'block';
    editClienteVoltura.style.display = 'none';
    editClienteVoltura.value = ''; // Reset
    document.getElementById('btn-voltura').style.display = 'inline-flex';

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
}

function closeModal() {
    document.getElementById('edit-modal').classList.remove('active');
    document.body.classList.remove('modal-open');
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
        nucleoFamiliareContainer.style.display = isResidente ? 'flex' : 'none';
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

    // Esegui Voltura
    const volturaInput = document.getElementById('edit-cliente-voltura');
    document.getElementById('btn-voltura').addEventListener('click', function() {
        this.style.display = 'none';
        document.getElementById('edit-cliente').style.display = 'none';
        volturaInput.style.display = 'block';
        volturaInput.focus();
    });

    // Ricerca Dinamica Voltura
    volturaInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimeoutVoltura);
        debounceTimeoutVoltura = setTimeout(() => {
            fetchVolturaClients(e.target.value);
        }, 300);
    });

    // Salva Utenza (Inizia Undo Pattern)
    document.getElementById('modal-save').addEventListener('click', initiateSaveWithUndo);
    
    // Toast Annulla (Undo)
    document.getElementById('btn-undo').addEventListener('click', cancelSave);
}

function initiateSaveWithUndo() {
    // 1. Raccogli i dati dal form
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
    const volturaInput = document.getElementById('edit-cliente-voltura');
    if (volturaInput.style.display !== 'none' && volturaInput.value) {
        // Se ha usato la voltura, mappa la p.iva -> id_cliente
        if (clientiMap[volturaInput.value]) {
            id_cliente = clientiMap[volturaInput.value];
        }
    }

    const payload = {
        id_utenza: id_utenza,
        id_cliente: id_cliente,
        indirizzo_fatturazione: document.getElementById('edit-indirizzo-fatturazione').value,
        citta_fatturazione: document.getElementById('edit-citta-fatturazione').value,
        tipologia: tipologia,
        componenti_nucleo: componenti_nucleo
    };

    // 2. Chiudi Modal
    closeModal();

    // 3. Mostra Toast
    document.getElementById('toast-utenza-id').textContent = id_utenza;
    const toast = document.getElementById('undo-toast');
    toast.classList.add('show');

    // 4. SetTimeout per inviare la richiesta
    clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => {
        executeSave(payload);
        toast.classList.remove('show');
    }, 4000); // 4 secondi per annullare
}

function cancelSave() {
    clearTimeout(undoTimeout);
    document.getElementById('undo-toast').classList.remove('show');
    console.log("Salvataggio annullato dall'utente.");
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
            // Ricarica la tabella
            loadUtenze(true);
        } else {
            console.error("Errore salvataggio utenza:", result.message);
            alert("Errore salvataggio: " + result.message);
        }
    } catch (e) {
        console.error("Errore rete salvataggio:", e);
    }
}

// ============================================================================
// LOGICA MODAL CREAZIONE NUOVA UTENZA
// ============================================================================

let createUndoTimeout = null;
let puntiFornituraMap = {}; // Mappa indirizzo -> codice_pod
let debounceTimeoutCreateCliente = null;
let debounceTimeoutCreatePod = null;

async function fetchCreateClienti(searchTerm) {
    if (searchTerm.trim().length < 2) return;
    try {
        const res = await fetchAPI(`api/clienti/list.php?limit=15&search=${encodeURIComponent(searchTerm)}`);
        if (res && res.success) {
            const datalist = document.getElementById('create-clienti-datalist');
            datalist.innerHTML = '';
            if (!clientiMap) clientiMap = {};
            
            res.clienti.forEach(c => {
                const opt = document.createElement('option');
                const label = `${c.ragSoc} - P.IVA/CF: ${c.cf_piva}`;
                opt.value = label;
                datalist.appendChild(opt);
                clientiMap[label] = c.id_cliente;
            });
        }
    } catch (e) {
        console.error("Errore fetch create clienti:", e);
    }
}

async function fetchCreatePuntiFornitura(searchTerm) {
    if (searchTerm.trim().length < 2) return;
    try {
        const res = await fetchAPI(`api/punti_fornitura/list.php?limit=15&stato=Libero&search=${encodeURIComponent(searchTerm)}`);
        if (res && res.success) {
            const datalist = document.getElementById('create-pod-datalist');
            datalist.innerHTML = '';
            
            res.punti_fornitura.forEach(p => {
                const opt = document.createElement('option');
                const label = `${p.indirizzo} - ${p.città} (POD: ${p.codice_pod})`;
                opt.value = label;
                datalist.appendChild(opt);
                puntiFornituraMap[label] = p.codice_pod;
            });
        }
    } catch (e) {
        console.error("Errore fetch create POD liberi:", e);
    }
}

function openCreateModal() {
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
        nucleoFamiliareContainer.style.display = isResidente ? 'flex' : 'none';
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
    document.getElementById('create-cliente').addEventListener('input', (e) => {
        clearTimeout(debounceTimeoutCreateCliente);
        debounceTimeoutCreateCliente = setTimeout(() => {
            fetchCreateClienti(e.target.value);
        }, 300);
    });

    // Ricerca Dinamica POD Libero
    const inputPod = document.getElementById('create-indirizzo-fornitura');
    inputPod.addEventListener('input', (e) => {
        clearTimeout(debounceTimeoutCreatePod);
        debounceTimeoutCreatePod = setTimeout(() => {
            fetchCreatePuntiFornitura(e.target.value);
        }, 300);
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
            
            const podVal = inputPod.value;
            // Estrapoliamo l'indirizzo dalla stringa "Via Roma 123 - Milano (POD: ...)"
            if (podVal && podVal.includes(' - ') && podVal.includes(' (POD:')) {
                const parts = podVal.split(' (POD:')[0].split(' - ');
                billAdd.value = parts[0].trim();
                billCity.value = parts.length > 1 ? parts[1].trim() : '';
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

    // Salva Nuova Utenza (Undo)
    document.getElementById('create-modal-save').addEventListener('click', initiateCreateWithUndo);
    
    // Annulla Toast (Undo)
    document.getElementById('create-btn-undo').addEventListener('click', cancelCreateSave);
}

function initiateCreateWithUndo() {
    const inputCliente = document.getElementById('create-cliente').value;
    const inputPod = document.getElementById('create-indirizzo-fornitura').value;
    
    if (!clientiMap[inputCliente]) {
        alert("Seleziona un cliente valido dalla tendina.");
        return;
    }
    if (!puntiFornituraMap[inputPod]) {
        alert("Seleziona un Punto di Fornitura valido dalla tendina.");
        return;
    }
    
    const id_cliente = clientiMap[inputCliente];
    const codice_pod = puntiFornituraMap[inputPod];
    
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

    const payload = {
        id_cliente: id_cliente,
        codice_pod: codice_pod,
        indirizzo_fatturazione: document.getElementById('create-indirizzo-fatturazione').value,
        citta_fatturazione: document.getElementById('create-citta-fatturazione').value,
        tipologia: tipologia,
        componenti_nucleo: componenti_nucleo
    };

    closeCreateModal();

    const toast = document.getElementById('create-undo-toast');
    toast.classList.add('show');

    clearTimeout(createUndoTimeout);
    createUndoTimeout = setTimeout(() => {
        executeCreate(payload);
        toast.classList.remove('show');
    }, 4000);
}

function cancelCreateSave() {
    clearTimeout(createUndoTimeout);
    document.getElementById('create-undo-toast').classList.remove('show');
    console.log("Creazione annullata dall'utente.");
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
        } else {
            console.error("Errore creazione utenza:", result.message);
            alert("Errore creazione: " + result.message);
        }
    } catch (e) {
        console.error("Errore rete creazione:", e);
    }
}
