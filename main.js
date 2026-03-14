const { app, BrowserWindow, Menu, MenuItem, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;
let splash;

function createWindow() {
    // 1. Crear la ventana de carga (Splash)
    splash = new BrowserWindow({
        width: 400,
        height: 300,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        center: true,
        icon: path.join(__dirname, 'build/icon.ico')
    });

    splash.loadFile('splash.html');

    // 2. Configurar la ventana principal (oculta al inicio)
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        show: false, 
        backgroundColor: '#ffffff',
        icon: path.join(__dirname, 'build/icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            spellcheck: true
        }
    });

    // 3. Configuración del Menú de arriba
    const template = [
        {
            label: 'Archivo',
            submenu: [
                { 
                    label: 'Nueva Nota', 
                    accelerator: 'CmdOrCtrl+N', 
                    click: () => {
                        const choice = dialog.showMessageBoxSync(mainWindow, {
                            type: 'question',
                            buttons: ['Sí', 'No'],
                            title: 'Confirmar',
                            message: '¿Deseas crear una nueva nota?'
                        });
                        if (choice === 0) mainWindow.webContents.send('file-new-confirmed');
                    }
                },
                { label: 'Abrir...', accelerator: 'CmdOrCtrl+O', click: () => openFile() },
                { label: 'Guardar', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('file-save') },
                { label: 'Guardar como...', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow.webContents.send('file-save-as') },
                { type: 'separator' },
                { label: 'Salir', role: 'quit' }
                
            ]
        },
        {
            label: 'Editar',
            submenu: [
                /* --- FUNCIONES DE EDICIÓN DIRECTAS --- */
                { label: 'Deshacer', accelerator: 'CmdOrCtrl+Z', click: () => mainWindow.webContents.send('edit-undo') },
                { label: 'Rehacer', accelerator: 'CmdOrCtrl+Y', click: () => mainWindow.webContents.send('edit-redo') },
                { type: 'separator' },
                { label: 'Cortar', accelerator: 'CmdOrCtrl+X', click: () => mainWindow.webContents.send('edit-cut') },
                { label: 'Copiar', accelerator: 'CmdOrCtrl+C', click: () => mainWindow.webContents.send('edit-copy') },
                { label: 'Pegar', accelerator: 'CmdOrCtrl+V', click: () => mainWindow.webContents.send('edit-paste') },
                { label: 'Eliminar', click: () => mainWindow.webContents.send('edit-delete') },
                { type: 'separator' },
                /* --- HERRAMIENTAS DE SISTEMA --- */
                {
                    label: 'Corrector Ortográfico',
                    type: 'checkbox',
                    checked: true,
                    click: (menuItem) => {
                        mainWindow.webContents.send('toggle-spellcheck', menuItem.checked);
                    }
                },
                {
                    label: 'Limpiar Editor',
                    accelerator: 'CmdOrCtrl+Shift+L',
                    click: () => {
                        mainWindow.webContents.send('file-new-confirmed'); 
                    }
                }
            ]
        },
        {
            label: 'Ayuda',
            submenu: [
                {
                    label: 'Guía de Usuario y Atajos',
                    accelerator: 'F1',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'Guía de Orta Note Lite',
                            message: 'Comandos y Sintaxis Rápida',
                            detail: 
                                '--- ATAJOS DE TECLADO ---\n' +
                                '• Ctrl + B (Negrita)\n' +
                                '• Ctrl + I (Cursiva)\n' +
                                '• Ctrl + U (Subrayado)\n' +
                                '• Ctrl + Shift + C (Bloque de Código)\n' +
                                '• Middle Click (Rueda Mouse) (Pegar texto)\n\n' +
                                '--- SINTAXIS ORTA (Codigo + Espacio) ---\n' +
                                '• n-texto-(Presionar Espacio) (Negrita)\n' +
                                '• i-texto-(Presionar Espacio) (Cursiva)\n' +
                                '• s-texto-(Presionar Espacio) (Subrayado)\n' +
                                '• t-texto-(Presionar Espacio) (Título Principal)\n' +
                                '• st-texto-(Presionar Espacio) (Subtítulo)\n' +
                                '• cod-texto-(Presionar Espacio) (Bloque de Código)\n\n' +
                                '--- TIPS DE SYSADMIN ---\n' +
                                '• El corrector se puede alternar desde el menú Editar.\n' +
                                '• El sombreado de texto copia automáticamente al portapapeles.\n' +
                                '• Al guardar tu nota, se sugiere el nombre basado en la primera línea.'
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Acerca de...',
                    click: () => {
                        const choice = dialog.showMessageBoxSync(mainWindow, {
                            type: 'info',
                            title: 'Acerca de Orta Note',
                            icon: path.join(__dirname, 'build/icon.ico'),
                            message: 'Orta Note Lite v1.0.5',
                            detail: 'Autor: Ing. José Aníbal Orta Núñez 🇻🇪\n' +
                                    'Proyecto: Orta Infinito\n' +
                                    'Tecnología: Electron + Quill.js\n\n' +
                                    '© 2026 - Todos los derechos reservados.',
                            buttons: ['Cerrar', 'Ver LinkedIn'],
                            defaultId: 0
                        });
                        if (choice === 1) shell.openExternal('https://www.linkedin.com/in/jose-orta-in/');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        setTimeout(() => {
            if (splash) splash.close();
            mainWindow.show();
        }, 5000); 
    });


    // Opciones click derecho sobre una palabra
    mainWindow.webContents.on('context-menu', (event, params) => {
        const contextMenu = new Menu();
    
        // 1. Sugerencias del corrector (si existen)
        for (const suggestion of params.dictionarySuggestions) {
            contextMenu.append(new MenuItem({
                label: suggestion,
                click: () => mainWindow.webContents.replaceMisspelling(suggestion)
            }));
        }
    
        if (params.dictionarySuggestions.length > 0) {
            contextMenu.append(new MenuItem({ type: 'separator' }));
        }
    
        // 2. Opciones de Edicion (Cortar añadido)
        contextMenu.append(new MenuItem({ 
            label: 'Cortar', 
            role: 'cut',
            enabled: params.editFlags.canCut // Solo se activa si hay texto seleccionado
        }));
        
        contextMenu.append(new MenuItem({ 
            label: 'Copiar', 
            role: 'copy',
            enabled: params.editFlags.canCopy 
        }));
    
        contextMenu.append(new MenuItem({ 
            label: 'Pegar', 
            role: 'paste',
            enabled: params.editFlags.canPaste 
        }));
    
        contextMenu.popup();
    });
}

function openFile() {
    const files = dialog.showOpenDialogSync(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Notas orta', extensions: ['json', 'txt', 'md'] }]
    });
    if (files) {
        const content = fs.readFileSync(files[0], 'utf8');
        mainWindow.webContents.send('file-opened', content, files[0]);
    }
}

ipcMain.on('save-to-disk', (event, content, filePath, suggestedName) => {
    if (filePath) {
        fs.writeFileSync(filePath, content);
        event.reply('file-saved-success', filePath);
    } else {
        const newPath = dialog.showSaveDialogSync(mainWindow, {
            defaultPath: path.join(app.getPath('documents'), suggestedName),
            filters: [{ name: 'Nota orta', extensions: ['json', 'txt'] }]
        });
        if (newPath) {
            fs.writeFileSync(newPath, content);
            event.reply('file-saved-success', newPath);
        }
    }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });