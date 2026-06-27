import re

with open("/home/brego/Documents/Uni/progweb/js/clienti.js", "r", encoding="utf-8") as f:
    content = f.read()

# Add classifySearchInput function
classifier_func = """
function classifySearchInput(input) {
    if (!input || input.trim() === '') return { type: 'vuoto', label: '', icon: '' };
    
    const str = input.trim();
    const strUpper = str.toUpperCase();
    
    // Controlla se contiene spazi (sicuramente non è CF o P.IVA)
    if (str.includes(' ')) {
        return { type: 'ragione_sociale', label: 'Ricerca per Ragione Sociale', icon: 'badge' };
    }
    
    // Controlla se contiene più di 6 lettere consecutive (non può essere un CF)
    if (/[A-Z]{7,}/i.test(str)) {
        return { type: 'ragione_sociale', label: 'Ricerca per Ragione Sociale', icon: 'badge' };
    }
    
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
"""

content = content.replace("async function loadClienti(reset = false) {", classifier_func + "\nasync function loadClienti(reset = false) {")

# Update loadClienti
load_clienti_search = """    const searchTerm = encodeURIComponent(document.getElementById('search-input').value);
    const statoFilter = encodeURIComponent(document.getElementById('filter-stato').value);
    const offset = currentPage * limit;

    const queryParams = `?limit=${limit}&offset=${offset}&search=${searchTerm}&stato=${statoFilter}`;"""

load_clienti_replace = """    const rawSearch = document.getElementById('search-input').value;
    const searchTerm = encodeURIComponent(rawSearch);
    const statoFilter = encodeURIComponent(document.getElementById('filter-stato').value);
    const offset = currentPage * limit;
    
    // Smart Search Classification
    const classification = classifySearchInput(rawSearch);
    const searchHint = document.getElementById('search-hint');
    if (classification.type !== 'vuoto') {
        searchHint.innerHTML = `<span class="material-symbols-outlined" style="font-size: 14px;">${classification.icon}</span> ${classification.label}`;
        searchHint.classList.add('visible');
    } else {
        searchHint.classList.remove('visible');
    }

    const queryParams = `?limit=${limit}&offset=${offset}&search=${searchTerm}&stato=${statoFilter}&search_type=${classification.type}`;"""

content = content.replace(load_clienti_search, load_clienti_replace)

with open("/home/brego/Documents/Uni/progweb/js/clienti.js", "w", encoding="utf-8") as f:
    f.write(content)

