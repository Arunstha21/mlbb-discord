// Player Search Page
(function() {
	'use strict';

	let players = [];
	let searchQuery = '';
	let searchTimeout = null;

	// Load players from API
	async function loadPlayers() {
		try {
			const params = new URLSearchParams();
			if (searchQuery) {
				// Try to detect if it's an email or Discord username
				if (searchQuery.includes('@')) {
					params.append('email', searchQuery);
				} else {
					params.append('discordUsername', searchQuery);
				}
			}

			const url = '/api/players/search' + (params.toString() ? '?' + params.toString() : '');
			const response = await Dot.API.get(url);
			players = response.data || [];
			renderPlayers();
		} catch (error) {
			console.error('Failed to load players:', error);
			document.getElementById('players-body').innerHTML = `
				<tr>
					<td colspan="6" class="empty-state">
						Failed to load players
					</td>
				</tr>
			`;
		}
	}

	// Render players table
	function renderPlayers() {
		const tbody = document.getElementById('players-body');

		if (players.length === 0) {
			const message = searchQuery
				? 'No players found matching your search'
				: 'No players in the system yet';

			tbody.innerHTML = `
				<tr>
					<td colspan="6" class="empty-state">
						<div class="empty-state-text">${message}</div>
						${searchQuery ? '<div class="empty-state-help">Try a different search term</div>' : ''}
					</td>
				</tr>
			`;
			return;
		}

		tbody.innerHTML = players.map(p => {
			const tournamentId = p.tournament ? p.tournament.id : '';
			const tournamentName = p.tournament ? p.tournament.name : 'No Tournament';
			const displayName = p.name || '—';
			const displayDiscord = p.discordUsername || '—';

			return `
				<tr data-player-id="${p.id}" ${tournamentId ? `onclick="navigateToTournament('${tournamentId}')"` : ''}>
					<td><strong>${escapeHtml(displayName)}</strong></td>
					<td>${escapeHtml(p.email)}</td>
					<td>${escapeHtml(p.team)}</td>
					<td>
						${p.verified
							? `<span class="verified-badge">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
										<polyline points="20 6 9 17 4 12"></polyline>
									</svg>
									${escapeHtml(displayDiscord)}
								</span>`
							: `<span class="unverified-badge">${escapeHtml(displayDiscord)}</span>`
						}
					</td>
					<td>
						${tournamentId
							? `<a href="/tournaments/${tournamentId}" class="tournament-link" onclick="event.stopPropagation()">${escapeHtml(tournamentName)}</a>`
							: `<span class="tournament-link">${escapeHtml(tournamentName)}</span>`
						}
					</td>
					<td onclick="event.stopPropagation()">
						<div class="action-buttons">
							<button class="btn btn-sm btn-secondary btn-icon" onclick="openEditModal(${p.id})">Edit</button>
							<button class="btn btn-sm btn-danger btn-icon" onclick="deletePlayer(${p.id}, '${escapeJs(displayName)}', '${escapeJs(tournamentName)}')">Delete</button>
						</div>
					</td>
				</tr>
			`;
		}).join('');
	}

	// Navigate to tournament
	function navigateToTournament(tournamentId) {
		window.location.href = `/tournaments/${tournamentId}`;
	}

	// Search input with debounce
	const searchInput = document.getElementById('search-input');
	searchInput.addEventListener('input', (e) => {
		searchQuery = e.target.value.trim();
		clearTimeout(searchTimeout);
		searchTimeout = setTimeout(() => {
			loadPlayers();
		}, 300);
	});

	// Clear search
	function clearSearch() {
		searchQuery = '';
		searchInput.value = '';
		loadPlayers();
	}

	// Open edit modal
	function openEditModal(playerId) {
		const player = players.find(p => p.id === playerId);
		if (!player) return;

		if (!player.tournament) {
			Dot.Toast.error('Cannot edit player without a tournament');
			return;
		}

		document.getElementById('edit-player-id').value = player.id;
		document.getElementById('edit-tournament-id').value = player.tournament.id;
		document.getElementById('edit-tournament-name').value = player.tournament.name;
		document.getElementById('edit-name').value = player.name || '';
		document.getElementById('edit-email').value = player.email;
		document.getElementById('edit-team').value = player.team;
		document.getElementById('edit-discord-username').value = player.discordUsername || '';
		document.getElementById('edit-verified').checked = player.verified;

		document.getElementById('edit-modal').style.display = 'flex';
	}

	// Close edit modal
	function closeEditModal() {
		document.getElementById('edit-modal').style.display = 'none';
	}

	// Save player
	async function savePlayer() {
		const playerId = parseInt(document.getElementById('edit-player-id').value, 10);
		const tournamentId = document.getElementById('edit-tournament-id').value;
		const name = document.getElementById('edit-name').value.trim();
		const team = document.getElementById('edit-team').value.trim();
		const discordUsername = document.getElementById('edit-discord-username').value.trim();
		const verified = document.getElementById('edit-verified').checked;

		if (!name || !team) {
			Dot.Toast.error('Name and Team are required');
			return;
		}

		if (!tournamentId) {
			Dot.Toast.error('Cannot update player without a tournament');
			return;
		}

		try {
			await Dot.API.put(`/api/tournaments/${tournamentId}/participants/${playerId}`, {
				name,
				team,
				discordUsername: discordUsername || null,
				verified
			});

			Dot.Toast.success('Player updated successfully');
			closeEditModal();
			loadPlayers();
		} catch (error) {
			// Error already shown by API wrapper
		}
	}

	// Delete player
	function deletePlayer(playerId, playerName, tournamentName) {
		const player = players.find(p => p.id === playerId);
		if (!player) return;

		if (!player.tournament) {
			Dot.Toast.error('Cannot delete player without a tournament');
			return;
		}

		Dot.Modal.confirm(
			'Delete Player',
			`Are you sure you want to delete ${playerName} from ${tournamentName}? This action cannot be undone.`,
			async () => {
				try {
					await Dot.API.delete(`/api/tournaments/${player.tournament.id}/participants/${playerId}`);
					Dot.Toast.success('Player deleted successfully');
					loadPlayers();
				} catch (error) {
					// Error already shown by API wrapper
				}
			}
		);
	}

	// Utility functions
	function escapeHtml(text) {
		if (!text) return '';
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}

	function escapeJs(text) {
		if (!text) return '';
		return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
	}

	// Load on page load
	document.addEventListener('DOMContentLoaded', () => {
		loadPlayers();
	});

	// Export functions for onclick handlers
	window.navigateToTournament = navigateToTournament;
	window.clearSearch = clearSearch;
	window.openEditModal = openEditModal;
	window.closeEditModal = closeEditModal;
	window.savePlayer = savePlayer;
	window.deletePlayer = deletePlayer;
})();
