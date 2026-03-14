// DOM elements
const configScreen = document.getElementById('config-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const configForm = document.getElementById('config-form');
// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkExistingConfig();
});
function setupEventListeners() {
    configForm.addEventListener('submit', handleConfigSubmit);
    document.getElementById('load-config')?.addEventListener('click', loadConfigFromFile);
    document.getElementById('stop-btn')?.addEventListener('click', handleStopBot);
    document.getElementById('web-interface-btn')?.addEventListener('click', openWebInterface);
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', handleCopyUrl);
    });
}
function checkExistingConfig() {
    // Check if config exists
    window.electronAPI.getStatus().then(status => {
        if (status.running) {
            showDashboard();
        }
    }).catch(() => {
        showConfigScreen();
    });
}
function showConfigScreen() {
    configScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
}
function showDashboard() {
    configScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
}
function handleConfigSubmit(e) {
    e.preventDefault();
    const config = {
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
        web: { port: 3000 }
    };
    window.electronAPI.startBot(config);
    showDashboard();
}
function loadConfigFromFile() {
    // TODO: Implement file picker
    console.log('Load config from file');
}
function handleStopBot() {
    window.electronAPI.stopBot();
}
function openWebInterface() {
    window.open('http://localhost:3000', '_blank');
}
function handleCopyUrl(e) {
    const target = e.currentTarget.dataset.target;
    if (target) {
        const urlElement = document.getElementById(target);
        if (urlElement) {
            navigator.clipboard.writeText(urlElement.textContent || '');
        }
    }
}
export {};
//# sourceMappingURL=renderer.js.map