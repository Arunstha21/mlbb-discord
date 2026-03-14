// DOM elements
const configScreen = document.getElementById('config-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const configForm = document.getElementById('config-form');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const logContainer = document.getElementById('log-container');
const localUrlElement = document.getElementById('local-url');
const networkUrlElement = document.getElementById('network-url');
const autoScrollCheckbox = document.getElementById('auto-scroll');
let autoScroll = true;
// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupIPCHandlers();
    loadNetworkInfo();
});
function setupEventListeners() {
    configForm.addEventListener('submit', handleConfigSubmit);
    document.getElementById('load-config')?.addEventListener('click', loadConfigFromFile);
    document.getElementById('stop-btn')?.addEventListener('click', handleStopBot);
    document.getElementById('settings-btn')?.addEventListener('click', () => showConfigScreen());
    document.getElementById('web-interface-btn')?.addEventListener('click', openWebInterface);
    document.getElementById('export-logs-btn')?.addEventListener('click', exportLogs);
    autoScrollCheckbox?.addEventListener('change', (e) => {
        autoScroll = e.target.checked;
    });
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', handleCopyUrl);
    });
}
function setupIPCHandlers() {
    window.electronAPI.onBotLog((log) => {
        appendLog(log);
    });
    window.electronAPI.onBotStatus((status) => {
        updateStatus(status);
    });
    window.electronAPI.onBotError((error) => {
        appendLog(`ERROR: ${error}`, true);
    });
    window.electronAPI.onConfigLoaded((config) => {
        populateConfigForm(config);
        showDashboard();
    });
    window.electronAPI.onPortDetected?.((port) => {
        localUrlElement.textContent = `http://localhost:${port}`;
        const networkUrlText = networkUrlElement.textContent || '';
        const networkIP = networkUrlText.split('://')[1]?.split(':')[0] || 'localhost';
        networkUrlElement.textContent = `http://${networkIP}:${port}`;
    });
}
async function loadNetworkInfo() {
    try {
        const ips = await window.electronAPI.getNetworkIP();
        localUrlElement.textContent = `http://${ips.local}:3000`;
        networkUrlElement.textContent = `http://${ips.network}:3000`;
    }
    catch (error) {
        console.error('Failed to get network IP:', error);
    }
}
function showConfigScreen() {
    configScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
}
function showDashboard() {
    configScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
}
function populateConfigForm(config) {
    document.getElementById('discord-token').value = config.discord.token;
    document.getElementById('challonge-username').value = config.challonge.username;
    document.getElementById('challonge-token').value = config.challonge.token;
    document.getElementById('bot-prefix').value = config.bot.defaultPrefix;
    document.getElementById('bot-to-role').value = config.bot.defaultToRole;
}
function handleConfigSubmit(e) {
    e.preventDefault();
    const config = {
        version: '1.0.0',
        discord: { token: document.getElementById('discord-token').value },
        challonge: {
            username: document.getElementById('challonge-username').value,
            token: document.getElementById('challonge-token').value
        },
        bot: {
            defaultPrefix: document.getElementById('bot-prefix').value,
            defaultToRole: document.getElementById('bot-to-role').value
        },
        database: { type: 'sqlite', path: './data/dot.db' },
        web: { port: 3000, autoIncrement: true },
        logging: { level: 'info' }
    };
    // Basic validation
    if (!config.discord.token || !config.challonge.username || !config.challonge.token) {
        alert('Please fill in all required fields');
        return;
    }
    window.electronAPI.startBot(config);
    showDashboard();
}
function loadConfigFromFile() {
    // Config is auto-loaded by Electron, this button is for manual reload
    window.location.reload();
}
function handleStopBot() {
    if (confirm('Are you sure you want to stop the bot?')) {
        window.electronAPI.stopBot();
        statusDot.classList.remove('running');
        statusText.textContent = 'Stopped';
    }
}
function updateStatus(status) {
    if (status.running) {
        statusDot.classList.add('running');
        statusText.textContent = 'Running';
    }
    else {
        statusDot.classList.remove('running');
        statusText.textContent = 'Stopped';
    }
}
function appendLog(log, isError = false) {
    const lines = log.trim().split('\n');
    lines.forEach(line => {
        if (line.trim()) {
            const div = document.createElement('div');
            div.className = `log-line ${isError ? 'log-error' : 'log-info'}`;
            div.textContent = line;
            logContainer.appendChild(div);
            // Keep only last 1000 lines
            while (logContainer.children.length > 1000) {
                logContainer.removeChild(logContainer.firstChild);
            }
            if (autoScroll) {
                logContainer.scrollTop = logContainer.scrollHeight;
            }
        }
    });
}
function openWebInterface() {
    window.electronAPI.openWebInterface();
}
function exportLogs() {
    const logs = logContainer.innerText;
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mlbb-bot-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}
function handleCopyUrl(e) {
    const target = e.currentTarget.dataset.target;
    if (target) {
        const urlElement = document.getElementById(target);
        if (urlElement) {
            navigator.clipboard.writeText(urlElement.textContent || '');
            const btn = e.currentTarget;
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        }
    }
}
export {};
//# sourceMappingURL=renderer.js.map