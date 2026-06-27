// /js/clienti.js
import { fetchAPI } from './api.js';

let currentPage = 0;
const limit = 21;
let debounceTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    loadClienti(true);

    // Event listeners
    const searchInput = document.getElementById('search-input');
    const filterStato = document.getElementById('filter-stato');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const applyBtn = document.getElementById('apply-filters');
    const clearBtn = document.getElementById('clear-filters');

    // Debounce sulla ricerca
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
            loadClienti(true);
        }, 300); // 300ms di attesa dopo l'ultimo carattere
    });

    // Se l'utente clicca su "Applica Filtri"
    applyBtn.addEventListener('click', () => {
        loadClienti(true);
    });

    // Se l'utente clicca su "Mostra Altri"
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            loadClienti(false);
        });
    }

    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        filterStato.value = 'all';
        loadClienti(true);
    });
});


function classifySearchInput(input) {
    if (!input || input.trim() === '') return { type: 'vuoto', label: '', icon: '' };
    
    const str = input.trim();
    const strUpper = str.toUpperCase();
    
    // Rimosso controllo su spazi o 7+ lettere per renderle multi-token generiche.

    
    // Controlla se è puramente numerico (potrebbe essere P.IVA)
    if (/^\d+$/.test(str) && str.length <= 11) {
        return { type: 'partita_iva', label: 'Ricerca per Partita IVA', icon: 'numbers' };
    }
    
    // Controlla se ha la forma e lunghezza di un CF (16 caratteri alfanumerici)
    if (str.length === 16 && /^[A-Z0-9]+$/i.test(str)) {
        // Un controllo extra potrebbe essere max 6 lettere consecutive, ma già sopra lo facciamo
        return { type: 'codice_fiscale', label: 'Ricerca per Codice Fiscale', icon: 'pin' };
    }
    
    return { type: 'generico', label: 'Ricerca Libera', icon: 'search' };
}

async function loadClienti(reset = false) {
    if (reset) {
        currentPage = 0;
    }

    const rawSearch = document.getElementById('search-input').value;
    const searchTerm = encodeURIComponent(rawSearch);
    const statoFilter = encodeURIComponent(document.getElementById('filter-stato').value);
    const offset = currentPage * limit;
    
    // Smart Search Classification (Logic Only)
    const classification = classifySearchInput(rawSearch);
    
    const queryParams = `?limit=${limit}&offset=${offset}&search=${searchTerm}&stato=${statoFilter}&search_type=${classification.type}`;

    // Se stiamo resettando la griglia (nuova ricerca), mostriamo "Caricamento..."
    const grid = document.getElementById('client-grid');
    const loadMoreBtn = document.getElementById('load-more-btn');

    if (reset) {
        grid.innerHTML = '<p style="color: var(--text-muted); grid-column: 1/-1; text-align: center;">Caricamento in corso...</p>';
        if (loadMoreBtn) loadMoreBtn.style.display = 'none';
    }

    const data = await fetchAPI(`api/clienti/list.php${queryParams}`);

    if (reset) {
        grid.innerHTML = '';
    }

    if (data && data.success) {
        const clienti = data.clienti;

        if (clienti.length === 0 && reset) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">
                    Nessun cliente trovato.
                </div>
            `;
        } else {
            renderClienti(clienti, !reset);
        }

        // Mostra/Nascondi il pulsante Load More in base ad has_more
        if (loadMoreBtn) {
            loadMoreBtn.style.display = data.has_more ? 'inline-block' : 'none';
        }

        if (data.has_more) {
            currentPage++;
        }
    } else {
        console.error('Errore API Clienti:', data?.error);
        if (reset) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: var(--accent-danger); padding: 2rem;">
                    Impossibile connettersi al database. (Errore API)
                </div>
            `;
        }
    }
}

function renderClienti(clienti, append = false) {
    const grid = document.getElementById('client-grid');

    if (!append) {
        grid.innerHTML = '';
    }

    clienti.forEach(c => {
        // Estrai l'iniziale per l'avatar
        const initial = c.ragSoc ? c.ragSoc.charAt(0).toUpperCase() : '?';

        // Status badge
        const badgeClass = (c.stato === 'Moroso') ? 'danger' : 'success';

        const article = document.createElement('article');
        article.className = 'client-card';
        article.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <div class="avatar-circle font-display">${initial}</div>
                <div class="truncate">
                    <h3 class="font-display font-bold text-main truncate" style="font-size: 16px;">${c.ragSoc}</h3>
                    <p class="font-medium text-muted truncate" style="font-size: 14px;">${c.cf_piva}</p>
                </div>
            </div>
            
            <div class="client-info-row">
                <span class="material-symbols-outlined" style="font-size: 18px;">location_on</span>
                <span class="truncate">${c.indirizzo || 'Indirizzo non specificato'} - ${c.citta || ''}</span>
            </div>
            
            <div class="client-footer">
                <span class="status-badge success">
                    <span class="dot"></span>
                    ${c.utenze_attive} Utenz${c.utenze_attive === 1 ? 'a' : 'e'} attiv${c.utenze_attive === 1 ? 'a' : 'e'}
                </span>
                
                <span class="status-badge ${badgeClass}">
                    <span class="dot"></span>
                    ${c.stato}
                </span>
            </div>
        `;
        grid.appendChild(article);
    });
}
