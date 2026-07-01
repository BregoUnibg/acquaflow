// /js/clienti.js
import { fetchAPI } from './api.js';

let currentPage = 0;
const limit = 24;
let debounceTimeout = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check if there is a search term in the URL query string
    const urlParams = new URLSearchParams(window.location.search);
    const searchParam = urlParams.get('search');
    const searchInput = document.getElementById('search-input');
    if (searchParam && searchInput) {
        searchInput.value = searchParam;
    }

    loadClienti(true);

    // Event listeners
    const filterStato = document.getElementById('filter-stato');
    const filterTipologia = document.getElementById('filter-tipologia');
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
        if (filterTipologia) filterTipologia.value = 'all';
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
    
    const filterTipologiaEl = document.getElementById('filter-tipologia');
    const tipologiaFilter = filterTipologiaEl ? encodeURIComponent(filterTipologiaEl.value) : 'all';
    
    const offset = currentPage * limit;
    
    // Smart Search Classification (Logic Only)
    const classification = classifySearchInput(rawSearch);
    
    const queryParams = `?limit=${limit}&offset=${offset}&search=${searchTerm}&stato=${statoFilter}&tipologia=${tipologiaFilter}&search_type=${classification.type}`;

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
        let badgeBg = 'bg-[#00f5d4]/10';
        let badgeText = 'text-[#00b89f]';
        let badgeDot = 'bg-[#00b89f]';
        if (c.stato === 'Moroso') {
            badgeBg = 'bg-[#ff4757]/10';
            badgeText = 'text-[#ff4757]';
            badgeDot = 'bg-[#ff4757]';
        }

        const utenzeClass = c.utenze_attive === 0
            ? 'bg-[#84817a]/10 text-[#84817a]'
            : 'bg-[#00f5d4]/10 text-[#00b89f]';

        const article = document.createElement('article');
        article.className = 'bg-surface p-6 shadow-soft hover:shadow-soft-hover hover:-translate-y-[2px] transition-all duration-200 ease-in-out cursor-pointer border hover:border-primary/20 rounded-lg border-border-soft';
        article.innerHTML = `
            <div class="flex items-center gap-4 mb-4">
                <div class="w-[40px] h-[40px] rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-lg shrink-0 font-display">
                    ${initial}
                </div>
                <div class="min-w-0 flex-1">
                    <h3 class="text-text-main font-bold text-[16px] truncate font-display">${c.ragSoc}</h3>
                    <p class="text-text-muted text-[14px] truncate mt-0.5">${c.cf_piva}</p>
                </div>
            </div>
            
            <div class="space-y-2 mt-4 pt-4 border-t border-border-soft">
                <div class="flex items-center gap-2 text-text-muted text-[14px]">
                    <span class="material-symbols-outlined text-[18px]">location_on</span>
                    <span class="truncate">${c.indirizzo || 'Indirizzo non specificato'}${c.citta ? ', ' + c.citta : ''}</span>
                </div>
            </div>
            
            <div class="mt-4 flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 ${utenzeClass} text-[13px] font-bold rounded-lg">
                    ${c.utenze_attive} Utenz${c.utenze_attive === 1 ? 'a' : 'e'} attiv${c.utenze_attive === 1 ? 'a' : 'e'}
                </span>
                
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 ${badgeBg} ${badgeText} text-[13px] font-bold rounded-lg">
                    <span class="w-1.5 h-1.5 rounded-lg ${badgeDot}"></span>
                    ${c.stato}
                </span>
            </div>
        `;
        article.addEventListener('click', () => {
            window.location.href = `utenze.html?search=${encodeURIComponent(c.ragSoc + ' - ' + c.cf_piva)}`;
        });
        grid.appendChild(article);
    });
}
