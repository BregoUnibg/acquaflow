// js/columns.js

document.addEventListener('DOMContentLoaded', () => {
    const colToggleBtn = document.getElementById('col-toggle-btn');
    const colPopover = document.getElementById('col-popover');

    if (!colToggleBtn || !colPopover) return;

    // Use a short timeout to ensure other scripts might have rendered the initial table skeleton if needed
    // In our vanilla HTML, the thead is static in the HTML file, so we can read it immediately.
    const table = document.querySelector('table');
    if (!table) return;

    const thead = table.querySelector('thead');
    if (!thead) return;

    const headers = Array.from(thead.querySelectorAll('th'));
    if (headers.length === 0) return;

    // Initialize the dynamic style element
    const styleEl = document.createElement('style');
    styleEl.id = 'dynamic-col-styles';
    document.head.appendChild(styleEl);

    const hiddenColumns = new Set();

    function updateColumnStyles() {
        let css = '';
        hiddenColumns.forEach(index => {
            // CSS :nth-child is 1-based index
            // This hides both TH in the header and TD in the body for the specific column index
            css += `
                table th:nth-child(${index + 1}),
                table td:nth-child(${index + 1}) {
                    display: none !important;
                }
            `;
        });
        styleEl.textContent = css;
    }

    // Populate popover with checkboxes
    headers.forEach((th, index) => {
        const thClone = th.cloneNode(true);
        const icon = thClone.querySelector('.sort-icon');
        if (icon) icon.remove();

        const text = thClone.textContent.trim();

        // Escludi la colonna chiave primaria (index 0) e le Azioni (vuota o con testo 'AZIONI')
        if (index === 0 || text.toLowerCase() === 'azioni' || text === '') {
            return; // Skip this column, so it cannot be toggled
        }

        const labelText = text;

        const label = document.createElement('label');
        label.className = 'checkbox-label';
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '0.5rem';
        label.style.cursor = 'pointer';
        label.style.padding = '0.25rem 0';
        label.style.userSelect = 'none';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'w-5 h-5 text-primary border-border-soft rounded-md focus:ring-0 focus:ring-offset-0 cursor-pointer transition-colors';
        // Controlla se la colonna è "INDIRIZZO FATTURAZIONE"
        if (labelText.toUpperCase() === 'INDIRIZZO FATTURAZIONE') {
            checkbox.checked = false; // Disattiva la spunta
            hiddenColumns.add(index); // Aggiunge l'indice all'elenco delle colonne nascoste
        } else {
            checkbox.checked = true;  // Lascia attive tutte le altre
        }

        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                hiddenColumns.delete(index);
            } else {
                hiddenColumns.add(index);
            }
            updateColumnStyles();
        });

        label.appendChild(checkbox);
        const span = document.createElement('span');
        span.textContent = labelText;
        span.style.fontSize = '0.875rem';
        span.style.color = 'var(--text-main)';
        label.appendChild(span);

        colPopover.appendChild(label);
    });

    // Applica gli stili CSS per nascondere le colonne disattivate di default
    updateColumnStyles();

    // Toggle popover visibility
    colToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        colPopover.classList.toggle('active');
    });

    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
        if (!colToggleBtn.contains(e.target) && !colPopover.contains(e.target)) {
            colPopover.classList.remove('active');
        }
    });

    // Prevent popover from closing when clicking inside it
    colPopover.addEventListener('click', (e) => {
        e.stopPropagation();
    });
});
