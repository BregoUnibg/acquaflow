// /js/api.js

/**
 * Funzione di utilità per effettuare chiamate alle API PHP
 * @param {string} endpoint - Il percorso dell'API (es: 'api/dashboard/stats.php')
 * @param {string} method - GET, POST, PUT, DELETE
 * @param {object} body - Oggetto payload per la richiesta
 * @returns {Promise<any>}
 */
export async function fetchAPI(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };

    if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(endpoint, options);

        // Verifica se la risposta è ok (status 200-299)
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Fetch API Error:', error);
        return { success: false, error: error.message };
    }
}
