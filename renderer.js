const { ipcRenderer } = require('electron');
let currentFilePath = null;
window.Quill = Quill; 

var quill = new Quill('#editor', {
    theme: 'snow',
    modules: { 
        toolbar: '#toolbar',
        imageResize: { displaySize: true },
        keyboard: {
            bindings: {
                'space-trigger': {
                    key: ' ',
                    handler: function(range, context) {
                        processOrtaSyntax(range);
                        return true;
                    }
                }
            }
        }
    },
    placeholder: '    Orta Note'
});

function processOrtaSyntax(range) {
const [line, offset] = quill.getLine(range.index);
const textBefore = line.domNode.textContent.slice(0, offset);

// Regex mejorada: admite prefijos como 'n' o 'tp'
const match = textBefore.match(/([a-z]+)-([^-]+)-$/); 

if (match) {
    const fullMatch = match[0]; 
    const prefix = match[1]; 
    const content = match[2];
    const startIndex = range.index - fullMatch.length;
    const formats = {
        'n': { bold: true }, 'i': { italic: true }, 's': { underline: true },
        'tp': { strike: true }, // <--- Aquí definimos 'tp'
        't': { header: 1 }, 'st': { header: 2 }, 'cod': { 'code-block': true }, 'todo': { list: 'check' }
    };



    if (formats.hasOwnProperty(prefix)) {
        // Borramos el código 'tp-texto-'
        quill.deleteText(startIndex, fullMatch.length);
        // Insertamos el texto limpio
        quill.insertText(startIndex, content);

        if (prefix === 't' || prefix === 'st' || prefix === 'cod' || prefix === 'todo') {
            const formatName = prefix === 'cod' ? 'code-block' : (prefix === 'todo' ? 'list' : 'header');
            const formatValue = formats[prefix][formatName] || formats[prefix].header;
            quill.formatLine(startIndex, content.length, formatName, formatValue);
        } else {
            // Aplicamos negrita, cursiva O TACHADO (strike)
            quill.formatText(startIndex, content.length, formats[prefix]);
        }

        // Movemos el cursor al final y reseteamos formatos para seguir escribiendo limpio
        quill.setSelection(startIndex + content.length);
        quill.format('bold', false); 
        quill.format('italic', false); 
        quill.format('underline', false);
        quill.format('strike', false); // <--- Reseteo de tachado
    }
}
}

//Nombre de la ventana = al del archivoo


// --- EJEMPLO DE INTEGRACIÓN ---
// Cuando cargues el archivo, dispara la función:
// actualizarTituloPro("Lorem Ipsum Grande.json");


//Fin nombre

/* --- EVENTOS DE EDICIÓN DEL MENÚ --- */
ipcRenderer.on('edit-undo', () => quill.history.undo());
ipcRenderer.on('edit-redo', () => quill.history.redo());
ipcRenderer.on('edit-cut', () => document.execCommand('cut'));
ipcRenderer.on('edit-copy', () => document.execCommand('copy'));
ipcRenderer.on('edit-paste', () => document.execCommand('paste'));
// --- Eliminar ---
ipcRenderer.on('edit-delete', () => {
    const range = quill.getSelection();
    if (range && range.length > 0) {
        // Borra el texto seleccionado
        quill.deleteText(range.index, range.length);
    } else if (range) {
        // Si no hay nada sombreado, borra el caracter siguiente (como la tecla Supr)
        quill.deleteText(range.index, 1);
    }
});

/* --- FUNCIONES DE ARCHIVOS --- */
ipcRenderer.on('file-new-confirmed', () => { quill.setContents([]); currentFilePath = null; updateStatusBar(); });
ipcRenderer.on('file-opened', (e, c, p) => { 
    try { quill.setContents(JSON.parse(c)); } catch { quill.setText(c); } 
    currentFilePath = p; 
    updateStatusBar();
});
ipcRenderer.on('file-save', () => ipcRenderer.send('save-to-disk', JSON.stringify(quill.getContents()), currentFilePath, getSuggestedName()));
ipcRenderer.on('file-saved-success', (e, p) => currentFilePath = p);

/* --- ZOOM, AUTOGUARDADO Y STATUS BAR --- */
let currentFontSize = 16;
window.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        e.deltaY < 0 ? currentFontSize++ : (currentFontSize > 8 ? currentFontSize-- : null);
        document.querySelector('.ql-editor').style.fontSize = `${currentFontSize}px`;
    }
}, { passive: false });

let autoSaveTimeout;
quill.on('text-change', () => {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        if (currentFilePath) {
            ipcRenderer.send('save-to-disk', JSON.stringify(quill.getContents()), currentFilePath, getSuggestedName());
        }
    }, 2000);
    updateStatusBar();
});

function updateStatusBar() {
    const selection = quill.getSelection();
    const text = quill.getText().trim();
    if (selection) {
        const textUntilCursor = quill.getText(0, selection.index);
        document.getElementById('line-number').innerText = `Línea: ${textUntilCursor.split('\n').length}`;
    }
    document.getElementById('char-count').innerText = `Caracteres: ${text.length}`;
    document.getElementById('word-count').innerText = `Palabras: ${text.length > 0 ? text.split(/\s+/).length : 0}`;
}

quill.on('selection-change', (range) => { if (range) updateStatusBar(); });

function getSuggestedName() {
    const text = quill.getText(0, 50).trim();
    return text.split('\n')[0].replace(/[/\\?%*:|"<>]/g, '').substring(0, 25) || 'nueva_nota';
}

//Copiar elemento sombreado
quill.on('selection-change', (range) => {
    if (range && range.length > 0) {
        // Obtenemos el texto sombreado
        const selectedText = quill.getText(range.index, range.length);
        
        // Escribimos en el portapapeles de forma asíncrona
        navigator.clipboard.writeText(selectedText).then(() => {
            console.log('Texto copiado automáticamente');
        }).catch(err => {
            console.error('Error al copiar sombreado:', err);
        });
    }
});


//Pegar con mouse
// --- Control Unificado de Botón Central (v1.1.2) ---
let lastPasteTime = 0;
const PASTE_THRESHOLD = 300; // Subimos a 300ms para mayor seguridad

// 1. Prevenir el molesto icono de scroll de Windows
document.getElementById('editor').addEventListener('mousedown', (e) => {
    if (e.button === 1) e.preventDefault();
}, false);

// 2. ÚNICO Evento de Pegado Controlado
document.getElementById('editor').addEventListener('auxclick', async (e) => {
    if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();

        const currentTime = Date.now();
        
        // FILTRO ANTI-REBOTE: Si el clic es muy rápido, se ignora
        if (currentTime - lastPasteTime < PASTE_THRESHOLD) {
            return;
        }
        lastPasteTime = currentTime;

        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                // Forzamos el foco en Quill antes de insertar
                quill.focus();
                const range = quill.getSelection(true);
                
                if (range) {
                    quill.insertText(range.index, text, 'user');
                    quill.setSelection(range.index + text.length);
                } else {
                    // Si no hay selección, pegamos al final
                    quill.insertText(quill.getLength(), text, 'user');
                }
            }
        } catch (err) {
            console.error('Error en pegado táctico:', err);
        }
    }
});

//fin pegar con mouse

//Sintax Orta para Lista de tarea lt-
quill.on('text-change', (delta, oldDelta, source) => {
if (source === 'user') {
    const selection = quill.getSelection();
    if (selection) {
        // Obtenemos la línea actual y su contenido
        const [line] = quill.getLine(selection.index);
        const text = line.domNode.textContent;

        // Si el texto de la línea comienza con "lt- "
        if (text.startsWith('lt- ')) {
            // Calculamos la posición donde comienza el prefijo
            // (selection.index - 4 porque "lt- " son 4 caracteres)
            const prefixIndex = selection.index - 4;
            
            // 1. Eliminamos el prefijo "lt- "
            quill.deleteText(prefixIndex, 4);
            
            // 2. Convertimos la línea en una lista de tareas (check)
            quill.formatLine(prefixIndex, 1, 'list', 'unchecked');
        }
    }
}
});
//Sintax Orta para Lista de tarea fin

//Soltar imagen sobre orta note
const editorContainer = document.getElementById('editor');

// Prevenir el comportamiento por defecto del navegador (evita que se abra la imagen en otra pestaña)
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
editorContainer.addEventListener(eventName, (e) => {
    e.preventDefault();
    e.stopPropagation();
}, false);
});

// Manejar el evento de soltar (drop)
editorContainer.addEventListener('drop', (e) => {
const dt = e.dataTransfer;
const files = dt.files;

if (files && files.length > 0) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Verificar que sea una imagen
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                const base64Image = event.target.result;
                const range = quill.getSelection();
                
                // Insertar la imagen en la posicion del cursor o al final
                const index = range ? range.index : quill.getLength();
                quill.insertEmbed(index, 'image', base64Image);
            };
            
            reader.readAsDataURL(file);
        }
    }
}
});

//Fin-Soltar imagen sobre orta note


// Autoguardado del codigo, por si se va la luz Configuracion: Intervalo de 30 segundos (30000 ms)
const AUTO_SAVE_INTERVAL = 30000;
let lastContent = '';

setInterval(async () => {
try {
    // Obtenemos el contenido actual en formato Delta (mas ligero y preciso)
    const currentContent = JSON.stringify(quill.getContents());

    // Solo guardamos si el contenido ha cambiado para no estresar el disco
    if (currentContent !== lastContent) {
        // Enviamos al proceso principal para escribir el archivo fisico
        // Nota: Debes tener el canal 'auto-save-recovery' configurado en main.js
        ipcRenderer.send('auto-save-recovery', currentContent);
        
        lastContent = currentContent;
        console.log('Respaldo de seguridad actualizado automáticamente.');
    }
} catch (err) {
    console.error('Error en el proceso de auto-guardado:', err);
}
}, AUTO_SAVE_INTERVAL);
// Configuracion: Intervalo de 30 segundos (30000 ms)


//Exportar texto plano
ipcRenderer.on('request-export-txt', () => {
console.log("Recibida petición de exportación..."); // Debug para tu consola (F12)

// Obtenemos el texto de Quill
const text = quill.getText();

// Lo enviamos de vuelta al proceso principal para que abra el diálogo de guardado
ipcRenderer.send('export-to-txt', text);
}); //Exportar texto plano

// Exportar PDF




//ventana ontop
ipcRenderer.on('ontop-updated', (event, isAlwaysOnTop) => {
const status = document.getElementById('ontop-status');
status.style.display = isAlwaysOnTop ? 'inline' : 'none';
});  //ventana ontop


// Autoguardado del documento que se está editando

    function showSaveMessage() {
    const saveStatus = document.getElementById('save-status');
    saveStatus.style.opacity = '1'; // Lo hace visible
    
    setTimeout(() => {
        saveStatus.style.opacity = '0'; // Lo oculta tras 2 segundos
    }, 2000);
}

// Integramos en tu listener de 'text-change' ya existente
quill.on('text-change', () => {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        if (currentFilePath) {
            ipcRenderer.send('save-to-disk', JSON.stringify(quill.getContents()), currentFilePath, getSuggestedName());
            showSaveMessage(); // <--- Llamamos a la función aquí
        }
    }, 2000);
    updateStatusBar();
});

// También lo añadimos para el respaldo de seguridad (el de los 30s)
ipcRenderer.on('file-saved-success', (e, p) => {
    currentFilePath = p;
    showSaveMessage(); // Confirmación visual de guardado exitoso
});
 // FIN Autoguardado del documento que se está editando


//  Correcto ortografico
ipcRenderer.on('toggle-spellcheck', (event, isEnabled) => {
    const editorElement = document.querySelector('.ql-editor');
    if (editorElement) {
        // El atributo 'spellcheck' es nativo del navegador/Electron
        editorElement.setAttribute('spellcheck', isEnabled);
        console.log(`Corrector ortográfico: ${isEnabled ? 'Activado' : 'Desactivado'}`);
    }
});

// --- Guardar como ---
ipcRenderer.on('request-save-as', () => {
    // 1. Recogemos el contenido actual
    const content = JSON.stringify(quill.getContents());
    // 2. Pedimos un nombre sugerido (la primera línea de la nota)
    const suggestedName = getSuggestedName();
    // 3. Enviamos al proceso principal para que abra el diálogo de 'Guardar como'
    // Forzamos que el path sea null para que el proceso principal sepa que es 'nuevo'
    ipcRenderer.send('save-to-disk', content, null, suggestedName);
});

// --- corrector ---

// Función para aplicar el corrector al elemento correcto de Quill
const applySpellcheck = (enabled) => {
    // Buscamos el div con clase .ql-editor que es donde vive el texto
    const editorElement = document.querySelector('.ql-editor');
    if (editorElement) {
        editorElement.setAttribute('spellcheck', enabled);
    }
};

// 1. Escuchar los cambios desde el menú (tu lógica de main.js)
ipcRenderer.on('toggle-spellcheck', (event, isEnabled) => {
    applySpellcheck(isEnabled);
});

// 2. FORZAR ACTIVACIÓN AL INICIO
// Usamos un pequeño delay para asegurar que Quill ya creó el div .ql-editor
setTimeout(() => {
    applySpellcheck(true); 
    console.log("Corrector iniciado por defecto.");
}, 1000);


//Motor de busqueda d epalabras

// --- Motor de Búsqueda con Resaltado Visual v1.1.2 ---
let searchIndices = [];
let currentSearchIndex = -1;
let lastHighlightedRange = null; // Para limpiar el resaltado anterior

const sInput = document.getElementById('search-input');
const sCount = document.getElementById('search-count');

sInput.addEventListener('input', function() {
    // Limpiar resaltado previo al escribir algo nuevo
    limpiarResaltado();

    // Si el usuario borra la búsqueda, limpiamos el color del texto
    if (this.value === "") {
        limpiarResaltado();
    }
       
    const query = this.value.toLowerCase();
    const text = quill.getText().toLowerCase();
    searchIndices = [];
    currentSearchIndex = -1;

    if (query.length > 0) {
        let index = text.indexOf(query);
        while (index !== -1) {
            searchIndices.push(index);
            index = text.indexOf(query, index + 1);
        }
    }

    updateSearchUI();
});

sInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (searchIndices.length > 0) {
            navegar(1);
        }
    }
});

function navegar(dir) {
    limpiarResaltado(); // Quitar el color amarillo de la palabra anterior

    currentSearchIndex = (currentSearchIndex + dir + searchIndices.length) % searchIndices.length;
    
    const pos = searchIndices[currentSearchIndex];
    const len = sInput.value.length;

    // 1. Aplicamos un formato de fondo amarillo a la coincidencia
    quill.formatText(pos, len, { 'background': 'black', 'color': 'cyan' }, 'api');
    
    // 2. Guardamos el rango para poder limpiarlo luego
    lastHighlightedRange = { index: pos, length: len };

    // 3. Movemos el scroll
    quill.setSelection(pos, 0, 'api'); 
    quill.scrollIntoView();

    // 4. Mantenemos el foco en la barra
    sInput.focus({ preventScroll: true });
    
    updateSearchUI();
}

function limpiarResaltado() {
    if (lastHighlightedRange) {
        // Quitamos el fondo y restauramos el color (null vuelve al original)
        quill.formatText(lastHighlightedRange.index, lastHighlightedRange.length, { 'background': false, 'color': false }, 'api');
        lastHighlightedRange = null;
    }
}

function updateSearchUI() {
    sCount.innerText = searchIndices.length > 0 ? `${currentSearchIndex + 1}/${searchIndices.length}` : "0/0";
}

function limpiarResaltado() {
    if (lastHighlightedRange) {
        // Quitamos el fondo y el color de la última coincidencia
        quill.formatText(lastHighlightedRange.index, lastHighlightedRange.length, { 
            'background': false, 
            'color': false 
        }, 'api');
        lastHighlightedRange = null;
    }
}

// Botones
document.getElementById('btn-next').onclick = (e) => { e.preventDefault(); navegar(1); };
document.getElementById('btn-prev').onclick = (e) => { e.preventDefault(); navegar(-1); };
//Fin motor de busqueda





//Fin script
