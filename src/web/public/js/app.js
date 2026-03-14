// Dot Tournament Dashboard - Main App JavaScript

// API wrapper
const API = {
	async request(url, options = {}) {
		try {
			const response = await fetch(url, {
				headers: {
					'Content-Type': 'application/json',
					...options.headers,
				},
				...options,
			});

			if (!response.ok) {
				const error = await response.json().catch(() => ({ error: 'Request failed' }));
				throw new Error(error.error || error.message || 'Request failed');
			}

			return await response.json();
		} catch (error) {
			console.error('API request failed:', error);
			Toast.show(error.message, 'error');
			throw error;
		}
	},

	get(url) {
		return this.request(url);
	},

	post(url, data) {
		return this.request(url, {
			method: 'POST',
			body: JSON.stringify(data),
		});
	},

	put(url, data) {
		return this.request(url, {
			method: 'PUT',
			body: JSON.stringify(data),
		});
	},

	delete(url) {
		return this.request(url, {
			method: 'DELETE',
		});
	},
};

// Toast notifications
const Toast = {
	show(message, type = 'info', duration = 5000) {
		const container = document.querySelector('.toast-container') || this.createContainer();
		const toast = document.createElement('div');
		toast.className = `toast toast-${type}`;
		
		const icons = {
			success: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>',
			error: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
			warning: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
			info: '<svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
		};

		toast.innerHTML = `
			<div class="toast-icon">${icons[type] || icons.info}</div>
			<div class="toast-message">${message}</div>
			<button class="toast-close">&times;</button>
		`;

		const closeBtn = toast.querySelector('.toast-close');
		closeBtn.addEventListener('click', () => {
			toast.style.opacity = '0';
			toast.style.transform = 'translateX(24px)';
			setTimeout(() => toast.remove(), 300);
		});

		container.appendChild(toast);

		if (duration > 0) {
			setTimeout(() => {
				toast.style.opacity = '0';
				toast.style.transform = 'translateX(24px)';
				setTimeout(() => toast.remove(), 300);
			}, duration);
		}
	},

	createContainer() {
		const container = document.createElement('div');
		container.className = 'toast-container';
		document.body.appendChild(container);
		return container;
	},

	success(message, duration) {
		this.show(message, 'success', duration);
	},

	error(message, duration) {
		this.show(message, 'error', duration);
	},

	warning(message, duration) {
		this.show(message, 'warning', duration);
	},

	info(message, duration) {
		this.show(message, 'info', duration);
	},
};

// Modal helper
const Modal = {
	open(content) {
		const overlay = document.createElement('div');
		overlay.className = 'modal-overlay';
		overlay.innerHTML = content;

		overlay.addEventListener('click', (e) => {
			if (e.target === overlay) {
				this.close(overlay);
			}
		});

		document.body.appendChild(overlay);
		return overlay;
	},

	close(overlay) {
		if (overlay) {
			overlay.remove();
		} else {
			const overlay = document.querySelector('.modal-overlay');
			if (overlay) overlay.remove();
		}
	},
};

// Utility functions
const Utils = {
	debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	},

	formatScheduledTime(dateString) {
		if (!dateString) return '<span style="color:var(--text-secondary)">Not set</span>';
		
		const dateObj = new Date(dateString);
		if (isNaN(dateObj.getTime())) return '<span style="color:var(--text-secondary)">Not set</span>';
		
		if (dateObj.getFullYear() > 2090) {
			return '<span style="color:var(--text-secondary)">Not set</span>';
		}
		
		return dateObj.toLocaleString(undefined, { 
			weekday: 'short', month: 'short', day: 'numeric', 
			hour: '2-digit', minute: '2-digit' 
		});
	},

	formatRelativeTime(date) {
		const seconds = Math.floor((new Date() - new Date(date)) / 1000);
		if (seconds < 60) return 'just now';
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
		if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
		return `${Math.floor(seconds / 86400)}d ago`;
	},
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
	// Add any global initialization here
	console.log('Dot Dashboard initialized');
});

// Export for use in other scripts
window.Dot = { API, Toast, Modal, Utils };
