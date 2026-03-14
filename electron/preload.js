"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    startBot: (config) => electron_1.ipcRenderer.send('start-bot', config),
    stopBot: () => electron_1.ipcRenderer.send('stop-bot'),
    getStatus: () => electron_1.ipcRenderer.invoke('get-status'),
    onBotLog: (callback) => {
        electron_1.ipcRenderer.on('bot-log', (_event, log) => callback(log));
    },
    onBotStatus: (callback) => {
        electron_1.ipcRenderer.on('bot-status', (_event, status) => callback(status));
    },
    onBotError: (callback) => {
        electron_1.ipcRenderer.on('bot-error', (_event, error) => callback(error));
    }
});
//# sourceMappingURL=preload.js.map