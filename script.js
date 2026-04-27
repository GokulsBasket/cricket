// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Data Storage
let players = [];
let teams = [];
let soldPlayers = [];
let unsoldPlayers = [];
let currentAuctionPlayer = null;
let currentBid = 0;
let currentBidder = null;
let bidHistory = []; // For undo functionality
let editingPlayerId = null;
let editingTeamId = null;



// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBmZsTSawjY9Tv8z6DGnoFDLvaVOPLNjuQ",
  authDomain: "cricket-2ee96.firebaseapp.com",
  databaseURL: "https://cricket-2ee96-default-rtdb.firebaseio.com",
  projectId: "cricket-2ee96",
  storageBucket: "cricket-2ee96.appspot.com",
  messagingSenderId: "160713673084",
  appId: "1:160713673084:web:b0dc748f1db1d53efc3cf9",
  measurementId: "G-T0HPYH01T4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

const dbRef = ref(database, 'cricketApp');


// Initialize from Firebase Realtime Database
function initializeData() {
    get(child(ref(database), 'cricketApp')).then((snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            players = Array.isArray(data.players) ? data.players : [];
            soldPlayers = Array.isArray(data.soldPlayers) ? data.soldPlayers : [];
            unsoldPlayers = Array.isArray(data.unsoldPlayers) ? data.unsoldPlayers : [];
            teams = Array.isArray(data.teams) ? data.teams.map(team => ({
                ...team,
                players: Array.isArray(team.players) ? team.players : [],
                spentAmount: Number(team.spentAmount) || 0,
                logoUrl: team.logoUrl || 'https://via.placeholder.com/80x80/667eea/ffffff?text=Logo'
            })) : [];
        } else {
            players = [];
            teams = [];
            soldPlayers = [];
            unsoldPlayers = [];
        }
        renderAll();
    }).catch((error) => {
        console.error('Firebase initialization error:', error);
        players = [];
        teams = [];
        soldPlayers = [];
        unsoldPlayers = [];
        renderAll();
    });
}

// Page Navigation
function switchPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });

    // Remove active from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Hide header stats during auction
    const headerEl = document.querySelector('header');
    if (pageName === 'auction') {
        headerEl.style.display = 'none';
    } else {
        headerEl.style.display = 'block';
    }

    // Hide navbar for live auction
    const navBar = document.querySelector('.navbar');
    if (navBar) {
        navBar.style.display = (pageName === 'auction' ? 'none' : 'flex');
    }



    // Show selected page
    const targetPage = document.getElementById(pageName);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Add active to corresponding nav button
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        const text = btn.textContent.trim().toLowerCase();
        if ((pageName === 'home' && text === 'home') ||
            (pageName === 'players' && text === 'players') ||
            (pageName === 'teams' && text === 'teams') ||
            (pageName === 'auction' && text.includes('auction')) ||
            (pageName === 'summary' && text === 'summary')) {
            btn.classList.add('active');
        }
    });

    // Initialize summary tabs when switching to summary page
    if (pageName === 'summary') {
        switchSummaryTab('sold');
    }
}

// Switch Summary Tabs
function switchSummaryTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    const targetTab = document.getElementById(tabName + '-tab');
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Add active to clicked button
    const allTabBtns = document.querySelectorAll('.tab-btn');
    allTabBtns.forEach(btn => {
        const btnText = btn.textContent.trim().toLowerCase();
        if ((tabName === 'sold' && btnText.includes('sold')) ||
            (tabName === 'unsold' && btnText.includes('unsold')) ||
            (tabName === 'teams' && btnText.includes('team'))) {
            btn.classList.add('active');
        }
    });

    // Render content
    if (tabName === 'sold') renderSoldPlayers();
    else if (tabName === 'unsold') renderUnsoldPlayers();
    else if (tabName === 'teams') renderSummaryTeams();
}

// Get next bid amount based on current bid
function getNextBidAmount(currentAmount) {
    if (currentAmount < 50) {
        return currentAmount + 2.5;
    } else if (currentAmount < 100) {
        return currentAmount + 5;
    } else if (currentAmount < 200) {
        return currentAmount + 10;
    } else {
        return currentAmount + 25;
    }
}



// Add Player
function addPlayer() {
    const name = document.getElementById('playerName').value.trim();
    const role = document.getElementById('playerRole').value;
    const category = document.getElementById('playerCategory').value;
    const price = parseInt(document.getElementById('playerPrice').value);
    const battingStyle = document.getElementById('battingStyle').value;
    const battingOrder = document.getElementById('battingOrder').value;
    const bowlingStyle = document.getElementById('bowlingStyle').value;
    const overallRating = parseInt(document.getElementById('overallRating').value);
    const imageUrl = document.getElementById('playerImage').value.trim();

    if (!name || !price || !overallRating) {
        showInfoModal('Please fill all required fields.', 'Validation Error');
        return;
    }

    const player = {
        id: Date.now(),
        name,
        role,
        category,
        basePrice: price,
        battingStyle,
        battingOrder,
        bowlingStyle,
        overallRating,
        imageUrl: imageUrl || 'https://via.placeholder.com/150x200/667eea/white?text=No+Image',
        status: 'available'
    };

    players.push(player);
    saveData();
    clearPlayerForm();
    renderPlayerList();
    updateStats();
}

// Add Team
function addTeam() {
    const name = document.getElementById('teamName').value.trim();
    const owner = document.getElementById('teamOwner').value.trim();
    const budget = parseInt(document.getElementById('teamBudget').value);
    const logo = document.getElementById('teamLogo').value.trim();

    if (!name || !owner || !budget) {
        showInfoModal('Please fill all required fields.', 'Validation Error');
        return;
    }

    const team = {
        id: Date.now(),
        name,
        owner,
        budget,
        spentAmount: 0,
        logoUrl: logo || 'https://via.placeholder.com/80x80/667eea/ffffff?text=Logo',
        players: []
    };

    teams.push(team);
    saveData();
    clearTeamForm();
    renderTeamList();
    updateStats();
}

function openAddPlayerModal() {
    editingPlayerId = null;
    document.getElementById('playerModalTitle').innerText = 'Add Player';
    document.getElementById('playerModalSubmitButton').innerText = 'Add Player';
    clearPlayerForm();
    document.getElementById('addPlayerModal').classList.add('active');
}

function closeAddPlayerModal() {
    document.getElementById('addPlayerModal').classList.remove('active');
    editingPlayerId = null;
    clearPlayerForm();
}

function submitPlayerForm() {
    if (editingPlayerId) {
        updatePlayer(editingPlayerId);
    } else {
        addPlayer();
    }
    closeAddPlayerModal();
}

function openAddTeamModal() {
    editingTeamId = null;
    document.getElementById('teamModalTitle').innerText = 'Add Team';
    document.getElementById('teamModalSubmitButton').innerText = 'Add Team';
    clearTeamForm();
    document.getElementById('addTeamModal').classList.add('active');
}

function closeAddTeamModal() {
    document.getElementById('addTeamModal').classList.remove('active');
    editingTeamId = null;
    clearTeamForm();
}

function submitTeamForm() {
    if (editingTeamId) {
        updateTeam(editingTeamId);
    } else {
        addTeam();
    }
    closeAddTeamModal();
}

// Edit Player
function editPlayer(id) {
    const player = players.find(p => p.id === id);
    if (!player) return;

    // Populate form with player data
    document.getElementById('playerName').value = player.name;
    document.getElementById('playerRole').value = player.role;
    document.getElementById('playerCategory').value = player.category;
    document.getElementById('playerPrice').value = player.basePrice;
    document.getElementById('battingStyle').value = player.battingStyle;
    document.getElementById('battingOrder').value = player.battingOrder;
    document.getElementById('bowlingStyle').value = player.bowlingStyle;
    document.getElementById('overallRating').value = player.overallRating;
    document.getElementById('playerImage').value = player.imageUrl;

    // Change button to update mode
    editingPlayerId = id;
    document.getElementById('playerModalTitle').innerText = 'Update Player';
    document.getElementById('playerModalSubmitButton').innerText = 'Update Player';
    document.getElementById('addPlayerModal').classList.add('active');
}

// Update Player
function updatePlayer(id) {
    const name = document.getElementById('playerName').value.trim();
    const role = document.getElementById('playerRole').value;
    const category = document.getElementById('playerCategory').value;
    const price = parseInt(document.getElementById('playerPrice').value);
    const battingStyle = document.getElementById('battingStyle').value;
    const battingOrder = document.getElementById('battingOrder').value;
    const bowlingStyle = document.getElementById('bowlingStyle').value;
    const overallRating = parseInt(document.getElementById('overallRating').value);
    const imageUrl = document.getElementById('playerImage').value.trim();

    if (!name || !price || !overallRating) {
        showInfoModal('Please fill all required fields.', 'Validation Error');
        return;
    }

    const playerIndex = players.findIndex(p => p.id === id);
    if (playerIndex === -1) return;

    players[playerIndex] = {
        ...players[playerIndex],
        name,
        role,
        category,
        basePrice: price,
        battingStyle,
        battingOrder,
        bowlingStyle,
        overallRating,
        imageUrl: imageUrl || 'https://via.placeholder.com/150x200/667eea/white?text=No+Image'
    };

    saveData();
    clearPlayerForm();
    renderPlayerList();
    updateStats();

    // Reset button
    editingPlayerId = null;
    document.getElementById('playerModalTitle').innerText = 'Add Player';
    document.getElementById('playerModalSubmitButton').innerText = 'Add Player';
}

// Edit Team
function editTeam(id) {
    const team = teams.find(t => t.id === id);
    if (!team) return;

    // Populate form with team data
    document.getElementById('teamName').value = team.name;
    document.getElementById('teamOwner').value = team.owner;
    document.getElementById('teamBudget').value = team.budget;
    document.getElementById('teamLogo').value = team.logoUrl;

    // Change button to update mode
    editingTeamId = id;
    document.getElementById('teamModalTitle').innerText = 'Update Team';
    document.getElementById('teamModalSubmitButton').innerText = 'Update Team';
    document.getElementById('addTeamModal').classList.add('active');
}

// Update Team
function updateTeam(id) {
    const name = document.getElementById('teamName').value.trim();
    const owner = document.getElementById('teamOwner').value.trim();
    const budget = parseInt(document.getElementById('teamBudget').value);
    const logo = document.getElementById('teamLogo').value.trim();

    if (!name || !owner || !budget) {
        showInfoModal('Please fill all required fields.', 'Validation Error');
        return;
    }

    const teamIndex = teams.findIndex(t => t.id === id);
    if (teamIndex === -1) return;

    teams[teamIndex] = {
        ...teams[teamIndex],
        name,
        owner,
        budget,
        logoUrl: logo || 'https://via.placeholder.com/80x80/667eea/ffffff?text=Logo'
    };

    saveData();
    clearTeamForm();
    renderTeamList();
    renderSummaryTeams();
    updateStats();

    // Reset button
    editingTeamId = null;
    document.getElementById('teamModalTitle').innerText = 'Add Team';
    document.getElementById('teamModalSubmitButton').innerText = 'Add Team';
}

// Get Random Player
function getRandomPlayer() {
    if (players.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * players.length);
    return players[randomIndex];
}

// Get Next Player in sequence
function getNextPlayer() {
    if (players.length === 0) {
        showAuctionComplete();
        return;
    }

    currentAuctionPlayer = players[0];
    if (!currentAuctionPlayer) return;

    currentBid = currentAuctionPlayer.basePrice;
    currentBidder = null;
    bidHistory = [];

    renderAuction();
}

// Team Bid (Click team name to automatically bid)
function teamBid(teamId) {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const nextBid = getNextBidAmount(currentBid);

    if (team.spentAmount + nextBid > team.budget) {
        showInfoModal(`${team.name} - Budget exceeded! Cannot bid more.`, 'Bid Error');
        return;
    }

    // Save current state for undo
    bidHistory.push({
        player: currentAuctionPlayer,
        previousBid: currentBid,
        previousBidder: currentBidder,
        timestamp: Date.now()
    });

    // If clicking the same team that's already bidding, increase bid
    if (currentBidder && currentBidder.id === teamId) {
        currentBid = nextBid;
    } else {
        // New team bidding
        currentBid = Math.max(currentBid, nextBid);
        currentBidder = { id: teamId, name: team.name };
    }



    renderAuction();
}

// Quick Bid (for auto-bid buttons)
function quickBidTeam(teamId) {
    teamBid(teamId);
}

// Remove Player
function removePlayer(id) {
    players = players.filter(p => p.id !== id);
    saveData();
    renderPlayerList();
    updateStats();
}

// Remove Team
function removeTeam(id) {
    teams = teams.filter(t => t.id !== id);
    saveData();
    renderTeamList();
    updateStats();
}

// Stop Auction Timer (no-op if timer was removed)
function stopAuctionTimer() {
    // Timer functionality removed
}

// Undo Last Bid
function undoBid() {
    console.log('undoBid called, bidHistory length:', bidHistory.length);
    if (bidHistory.length === 0) {
        showInfoModal('No bids to undo.', 'Undo Bid');
        return;
    }

    const lastBid = bidHistory.pop();
    currentBid = lastBid.previousBid;
    currentBidder = lastBid.previousBidder;

    console.log('Undid bid, currentBid:', currentBid, 'currentBidder:', currentBidder);



    renderAuction();
}

function passPlayer() {
    if (!currentAuctionPlayer) return;

    const player = currentAuctionPlayer;

    // Move the current player to the end of the auction queue so they can return later
    players = players.filter(p => p.id !== player.id);
    players.push(player);

    currentAuctionPlayer = null;
    currentBid = 0;
    currentBidder = null;
    bidHistory = [];

    saveData();
    updateStats();

    setTimeout(() => {
        if (players.length === 0) {
            showAuctionComplete();
        } else {
            getNextPlayer();
        }
    }, 250);
}

function sellPlayer() {
    console.log('sellPlayer called, currentBidder:', currentBidder, 'currentAuctionPlayer:', currentAuctionPlayer);
    
    let team, soldPrice;
    
    if (currentBidder) {
        team = teams.find(t => t.id === currentBidder.id);
        soldPrice = currentBid;
    } else {
        // No bidder - sell at base price to team with most remaining budget that can afford it
        const affordableTeams = teams.filter(t => (t.budget - t.spentAmount) >= currentAuctionPlayer.basePrice);
        if (affordableTeams.length === 0) {
            showInfoModal('No team can afford this player at base price.', 'Auction Notice');
            return;
        }
        // Sort by remaining budget descending
        affordableTeams.sort((a, b) => (b.budget - b.spentAmount) - (a.budget - a.spentAmount));
        team = affordableTeams[0];
        soldPrice = currentAuctionPlayer.basePrice;
        currentBid = soldPrice; // Update current bid
        currentBidder = { id: team.id, name: team.name }; // Set bidder for consistency
        console.log('Auto-selling to team with most budget:', team.name, 'at base price:', soldPrice);
    }

    const player = currentAuctionPlayer;

    console.log('Selling player:', player.name, 'to team:', team.name, 'for:', soldPrice);

    // Update team
    team.spentAmount += soldPrice;
    team.players.push({
        playerId: player.id,
        name: player.name,
        role: player.role,
        price: soldPrice,
        imageUrl: player.imageUrl
    });

    // Record sold player
    soldPlayers.push({
        playerId: player.id,
        teamId: team.id,
        playerName: player.name,
        role: player.role,
        category: player.category,
        basePrice: player.basePrice,
        battingStyle: player.battingStyle,
        battingOrder: player.battingOrder,
        bowlingStyle: player.bowlingStyle,
        overallRating: player.overallRating,
        imageUrl: player.imageUrl,
        soldPrice: soldPrice,
        soldTo: team.name,
        soldAt: new Date().toLocaleString()
    });

    console.log('Sold players after push:', soldPlayers);

    // Remove from available players - CRITICAL: must happen before getNextPlayer
    players = players.filter(p => p.id !== player.id);

    // Show modal with correct sold price
    showSaleModal(player.name, team.name, soldPrice);

    // Reset auction
    currentAuctionPlayer = null;
    currentBid = 0;
    currentBidder = null;
    bidHistory = []; // Clear bid history
    stopAuctionTimer();

    saveData();
    updateStats();

    // Get next player
    setTimeout(() => {
        if (players.length === 0) {
            showAuctionComplete();
        } else {
            getNextPlayer();
        }
    }, 1000);
}

function releasePlayer(teamId, playerId = null, playerName = '') {
    const team = teams.find(t => t.id === teamId);
    if (!team) return;

    const playerIndex = team.players.findIndex(p => {
        if (playerId !== null) return p.playerId === playerId;
        return p.name === playerName;
    });
    if (playerIndex === -1) {
        showInfoModal('Player not found on this team.', 'Release Error');
        return;
    }

    const released = team.players[playerIndex];
    team.players.splice(playerIndex, 1);
    team.spentAmount = Math.max(0, team.spentAmount - released.price);

    let soldIndex = -1;
    let soldRecord = null;
    if (playerId !== null) {
        soldIndex = soldPlayers.findIndex(s => s.playerId === playerId && s.teamId === teamId);
    }
    if (soldIndex === -1) {
        soldIndex = soldPlayers.findIndex(s => s.playerName === playerName && s.soldTo === team.name && s.soldPrice === released.price);
    }
    if (soldIndex !== -1) {
        soldRecord = soldPlayers[soldIndex];
        soldPlayers.splice(soldIndex, 1);
    }

    const restoredPlayer = soldRecord ? {
        id: soldRecord.playerId || Date.now(),
        name: soldRecord.playerName,
        role: soldRecord.role,
        category: soldRecord.category,
        basePrice: soldRecord.basePrice,
        battingStyle: soldRecord.battingStyle || 'N/A',
        battingOrder: soldRecord.battingOrder || 'N/A',
        bowlingStyle: soldRecord.bowlingStyle || 'N/A',
        overallRating: soldRecord.overallRating || 5,
        imageUrl: soldRecord.imageUrl || released.imageUrl,
        status: 'available'
    } : {
        id: playerId || Date.now(),
        name: released.name,
        role: released.role,
        category: 'A',
        basePrice: released.price,
        battingStyle: 'N/A',
        battingOrder: 'N/A',
        bowlingStyle: 'N/A',
        overallRating: 5,
        imageUrl: released.imageUrl,
        status: 'available'
    };

    unsoldPlayers.push({
        playerName: restoredPlayer.name,
        role: restoredPlayer.role,
        category: restoredPlayer.category,
        basePrice: restoredPlayer.basePrice,
        imageUrl: restoredPlayer.imageUrl
    });

    players.push(restoredPlayer);

    saveData();
    updateStats();
    renderTeamList();
    renderSummaryTeams();
    renderAuction();
    showInfoModal(`${restoredPlayer.name} has been released from ${team.name} and is now unsold.`, 'Player Released');
}

function showSaleModal(playerName, teamName, amount) {
    const modal = document.getElementById('saleModal');
    const text = document.getElementById('saleModalText');
    text.innerHTML = `<strong>${playerName}</strong> has been sold to <strong>${teamName}</strong> for <strong>₹${amount}</strong>`;
    modal.classList.add('active');
}

function closeSaleModal() {
    const modal = document.getElementById('saleModal');
    if (modal) modal.classList.remove('active');
}

function showInfoModal(message, title = 'Notice') {
    document.getElementById('infoModalTitle').innerText = title;
    document.getElementById('infoModalText').innerText = message;
    document.getElementById('infoModal').classList.add('active');
}

function closeInfoModal() {
    document.getElementById('infoModal').classList.remove('active');
}

let currentConfirmCallback = null;

function showConfirmModal(message, callback, title = 'Confirm') {
    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalText').innerText = message;
    currentConfirmCallback = callback;
    const yesButton = document.getElementById('confirmModalYes');
    yesButton.onclick = () => {
        if (typeof currentConfirmCallback === 'function') {
            currentConfirmCallback();
        }
        closeConfirmModal();
    };
    document.getElementById('confirmModal').classList.add('active');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
    currentConfirmCallback = null;
}



// Show Auction Complete
function showAuctionComplete() {
    // Move any remaining players to unsold
    unsoldPlayers = [
        ...unsoldPlayers,
        ...players.map(p => ({
            playerName: p.name,
            role: p.role,
            category: p.category,
            basePrice: p.basePrice,
            imageUrl: p.imageUrl
        }))
    ];
    players = [];
    saveData();
    
    const container = document.getElementById('auctionContainer');
    container.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px;">
            <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
            <h2 style="color: #333; margin-bottom: 10px;">Auction Complete!</h2>
            <p style="color: #666; margin-bottom: 20px;">View summary to see all results</p>
            <button class="btn-primary" onclick="switchPage('summary')" style="width: 200px; margin: 0 auto;">View Summary</button>
        </div>
    `;
}

// Clear Forms
function clearPlayerForm() {
    document.getElementById('playerName').value = '';
    document.getElementById('playerRole').value = 'Batsman';
    document.getElementById('playerCategory').value = 'A';
    document.getElementById('playerPrice').value = '';
    document.getElementById('battingStyle').value = 'Right-handed';
    document.getElementById('battingOrder').value = 'Opener';
    document.getElementById('bowlingStyle').value = 'Right-arm Fast';
    document.getElementById('overallRating').value = '';
    document.getElementById('playerImage').value = '';
    document.getElementById('playerName').focus();
}

function clearTeamForm() {
    document.getElementById('teamName').value = '';
    document.getElementById('teamOwner').value = '';
    document.getElementById('teamBudget').value = '';
    document.getElementById('teamLogo').value = '';
    document.getElementById('teamName').focus();
}

// Save Data to Firebase
function saveData() {
    set(ref(database, 'cricketApp'), {
        players,
        teams,
        soldPlayers,
        unsoldPlayers
    }).catch((error) => {
        console.error('Error saving to Firebase:', error);
    });
}

// Render All
function attachStaticEventHandlers() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            const txt = btn.textContent.trim().toLowerCase();
            if (txt.includes('home')) switchPage('home');
            else if (txt.includes('player')) switchPage('players');
            else if (txt.includes('team')) switchPage('teams');
            else if (txt.includes('auction')) switchPage('auction');
            else if (txt.includes('summary')) switchPage('summary');
        };    
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            const txt = btn.textContent.trim().toLowerCase();
            if (txt.includes('sold')) switchSummaryTab('sold');
            else if (txt.includes('unsold')) switchSummaryTab('unsold');
            else if (txt.includes('team')) switchSummaryTab('teams');
        };
    });
}

function renderAll() {
    renderPlayerList();
    renderTeamList();
    renderAuction();
    updateStats();
    attachStaticEventHandlers();
}

// Render Player List
function renderPlayerList() {
    const container = document.getElementById('playerList');

    const allPlayers = [
        ...players.map(player => ({
            id: player.id,
            name: player.name,
            role: player.role,
            category: player.category,
            basePrice: player.basePrice,
            battingStyle: player.battingStyle,
            battingOrder: player.battingOrder,
            bowlingStyle: player.bowlingStyle,
            overallRating: player.overallRating,
            imageUrl: player.imageUrl,
            status: 'Available'
        })),
        ...unsoldPlayers.map(player => ({
            id: player.playerId || null,
            name: player.playerName,
            role: player.role,
            category: player.category,
            basePrice: player.basePrice,
            battingStyle: player.battingStyle || 'N/A',
            battingOrder: player.battingOrder || 'N/A',
            bowlingStyle: player.bowlingStyle || 'N/A',
            overallRating: player.overallRating || 0,
            imageUrl: player.imageUrl,
            status: 'Unsold'
        })),
        ...soldPlayers.map(player => ({
            id: player.playerId || null,
            name: player.playerName,
            role: player.role,
            category: player.category,
            basePrice: player.basePrice,
            battingStyle: player.battingStyle || 'N/A',
            battingOrder: player.battingOrder || 'N/A',
            bowlingStyle: player.bowlingStyle || 'N/A',
            overallRating: player.overallRating || 0,
            imageUrl: player.imageUrl,
            status: 'Sold'
        }))
    ];

    if (allPlayers.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No players added yet</p></div>';
        return;
    }

    const categoryOrder = { A: 1, B: 2, C: 3 };
    allPlayers.sort((a, b) => {
        if (categoryOrder[a.category] !== categoryOrder[b.category]) {
            return categoryOrder[a.category] - categoryOrder[b.category];
        }
        if (a.role !== b.role) {
            return a.role.localeCompare(b.role);
        }
        return a.name.localeCompare(b.name);
    });

    const grouped = allPlayers.reduce((acc, player) => {
        acc[player.category] = acc[player.category] || [];
        acc[player.category].push(player);
        return acc;
    }, {});

    const categoryLabels = {
        A: 'Category A (Premium)',
        B: 'Category B (Mid)',
        C: 'Category C (Budget)'
    };

    let html = '';

    Object.keys(categoryLabels).forEach(category => {
        const playersInCategory = grouped[category] || [];
        if (playersInCategory.length === 0) return;

        html += `
            <div class="player-category-section">
                <div class="category-header">
                    <h3>${categoryLabels[category]}</h3>
                    <span>${playersInCategory.length} players</span>
                </div>
                <div class="player-category-grid">
                    ${playersInCategory.map(player => `
                        <div class="player-card">
                            <div class="player-image">
                                <img src="${player.imageUrl}" alt="${player.name}" onerror="this.src='https://via.placeholder.com/150x200/667eea/white?text=No+Image'">
                            </div>
                            <div class="player-info">
                                <div class="player-name">${player.name}</div>
                                <div class="player-details">
                                    <span class="badge badge-role">${player.role}</span>
                                    <span class="badge badge-category">Category ${player.category}</span>
                                    <span class="badge badge-status ${player.status.toLowerCase()}">${player.status}</span>
                                </div>
                                <div class="player-stats">
                                    <div class="stat-item"><strong>Batting:</strong> ${player.battingStyle} (${player.battingOrder})</div>
                                    <div class="stat-item"><strong>Bowling:</strong> ${player.bowlingStyle}</div>
                                    <div class="stat-item"><strong>Base Price:</strong> ₹${player.basePrice}</div>
                                </div>
                            </div>
                            ${player.status === 'Available' ? `
                                <div class="player-actions">
                                    <button class="btn-edit" onclick="editPlayer(${player.id})">Edit</button>
                                    <button class="btn-danger" onclick="removePlayer(${player.id})">Remove</button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Render Team List
function renderTeamList() {
    const container = document.getElementById('teamsList');

    if (teams.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No teams added yet</p></div>';
        return;
    }

    let html = `<div class="team-grid">`;
    teams.forEach(team => {
        const remaining = team.budget - team.spentAmount;
        const categoryColor = remaining > team.budget * 0.5 ? 'category-a' : remaining > team.budget * 0.2 ? 'category-b' : 'category-c';
        
        html += `
            <div class="team-card ${categoryColor}">
                <div class="team-header" style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img class="team-logo" src="${team.logoUrl}" alt="${team.name} logo" onerror="this.src='https://via.placeholder.com/80x80/667eea/ffffff?text=Logo'" />
                        <div>
                            <div class="team-name">${team.name}</div>
                            <div style="font-size: 13px; color: #555;">Owner: ${team.owner}</div>
                        </div>
                    </div>
                    <div class="team-actions">
                        <button class="btn-edit" onclick="editTeam(${team.id})">Edit</button>
                        <button class="btn-danger" onclick="removeTeam(${team.id})">Remove</button>
                    </div>
                </div>
                <div class="team-stat">
                    <span class="team-stat-label">Players:</span>
                    <span class="team-stat-value">${(team.players || []).length}</span>
                </div>
                <div class="team-stat">
                    <span class="team-stat-label">Budget:</span>
                    <span class="team-stat-value">₹${team.budget.toLocaleString()}</span>
                </div>
                <div class="team-budget">
                    <div class="budget-used">Spent: ₹${team.spentAmount.toLocaleString()}</div>
                    <div style="color: ${remaining < 0 ? '#ff4757' : '#666'}; font-weight: 600;">Remaining: ₹${remaining.toLocaleString()}</div>
                </div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}

// Render Summary Teams
function renderSummaryTeams() {
    const container = document.getElementById('summaryTeamsList');

    if (teams.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No teams added yet</p></div>';
        return;
    }

    let html = `<div class="summary-grid">`;
    teams.forEach(team => {
        const remaining = team.budget - team.spentAmount;
        const playerCount = (team.players || []).length;
        const playerCards = (team.players || []).map(player => `
            <div class="team-player-card">
                <img class="player-thumb" src="${player.imageUrl || 'https://via.placeholder.com/90x90/8b5cf6/ffffff?text=Player'}" alt="${player.name}" onerror="this.src='https://via.placeholder.com/90x90/8b5cf6/ffffff?text=Player'" />
                <div class="player-card-info">
                    <div class="player-card-name">${player.name}</div>
                    <div class="player-card-meta">${player.role} • ₹${player.price.toLocaleString()}</div>
                </div>
                <button class="btn-release" onclick="releasePlayer(${team.id}, ${player.playerId || player.id}, '${player.name.replace(/'/g, "\\'")}')">Release</button>
            </div>
        `).join('');

        html += `
            <div class="summary-card summary-team-card">
                <img class="summary-card-logo" src="${team.logoUrl}" alt="${team.name} logo" onerror="this.src='https://via.placeholder.com/80x80/8b5cf6/ffffff?text=🏏'" />
                <div class="summary-card-content">
                    <div class="summary-card-title">${team.name} <span class="summary-card-badge">${playerCount} players</span></div>
                    <div class="summary-card-text">Owner: ${team.owner} • Budget: ₹${team.budget.toLocaleString()}</div>
                    <div class="summary-card-bar">
                        <span>Spent ₹${team.spentAmount.toLocaleString()}</span>
                        <span>Left ₹${remaining.toLocaleString()}</span>
                    </div>
                    <div class="summary-card-text">${playerCount > 0 ? `Players on roster:` : `No players bought yet — add stars now.`}</div>
                    ${playerCount > 0 ? `<div class="team-player-grid">${playerCards}</div>` : ''}
                </div>
            </div>
        `;
    });
    html += `</div>`;
    container.innerHTML = html;
}

// Render Auction
function renderAuction() {
    const container = document.getElementById('auctionContainer');

    if (!currentAuctionPlayer) {
        if (players.length === 0 && (soldPlayers.length === 0 && unsoldPlayers.length === 0)) {
            container.innerHTML = '<div class="empty-state"><p>Add players and teams to start the auction</p></div>';
        } else if (players.length === 0) {
            showAuctionComplete();
        } else {
            container.innerHTML = `
                <div class="empty-state" style="padding: 40px 20px;">
                    <p style="font-size: 24px; margin-bottom: 20px;">Ready to start the auction? 🏏</p>
                    <p style="margin-bottom: 16px; color: #f0e7ff;">Pass keeps the player back in the pool, so your squad stays clever.</p>
                    <button class="btn-primary" onclick="getNextPlayer()" style="width: 220px;">Start Live Auction</button>
                </div>
            `;
        }
        return;
    }

    if (teams.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Add teams before starting auction</p></div>';
        return;
    }

    const bidderTeam = teams.find(t => t.id === currentBidder?.id);
    

    const auctionStatHtml = `
        <div class="auction-stat-card">
            <div class="stat-label">Current Bid</div>
            <div class="stat-value">₹${currentBid.toLocaleString()}</div>
        </div>
        <div class="auction-stat-card">
            <div class="stat-label">Player Category</div>
            <div class="stat-value">Cat ${currentAuctionPlayer.category}</div>
        </div>
         <div class="auction-stat-card">
            <div class="stat-label">Highest Bidder</div>
            <div class="stat-value">
                <img class="bidder-logo-small" src="${bidderTeam?.logoUrl || 'https://via.placeholder.com/50x50/000000/ffffff?text=🏏'}" alt="${currentBidder?.name || 'No bidder'} logo" onerror="this.src='https://via.placeholder.com/50x50/000000/ffffff?text=🏏'" />
            </div>
        </div>

    `;

    const activityItems = [];
    if (currentBidder) {
        activityItems.push(`
            <div class="activity-row">
                <div>Highest Bid</div>
                <strong>₹${currentBid.toLocaleString()}</strong>
            </div>
        `);
    }
    activityItems.push(`
        <div class="activity-row">
            <div>Players remaining</div>
            <strong>${players.length}</strong>
        </div>
    `);
    activityItems.push(`
        <div class="activity-row">
            <div>Base Price</div>
            <strong>₹${currentAuctionPlayer.basePrice.toLocaleString()}</strong>
        </div>
    `);

    const playersLeft = players.length;
    container.innerHTML = `
        <div class="auction-grid">
            <div class="auction-main-panel">
                <div class="auction-panel auction-card-top">
                    <div class="auction-section-head">
                        <div>
                            <div class="auction-heading">Player on Auction</div>
                            <div class="auction-subtitle">${currentAuctionPlayer.name} • ${currentAuctionPlayer.role}</div>
                        </div>
                        <div class="auction-badge">${playersLeft} left</div>
                    </div>

                    <div class="auction-player-row">
                        <div class="auction-player-image">
                            <img src="${currentAuctionPlayer.imageUrl}" alt="${currentAuctionPlayer.name}" onerror="this.src='https://via.placeholder.com/260x320/8b5cf6/ffffff?text=Player'" />
                        </div>
                        <div class="auction-player-details">
                            <div class="auction-detail-block">
                                <span class="detail-label">Name</span>
                                <span class="detail-value">${currentAuctionPlayer.name}</span>
                            </div>
                            <div class="auction-detail-block">
                                <span class="detail-label">Rating</span>
                                <span class="detail-value">⭐ ${currentAuctionPlayer.overallRating}/10</span>
                            </div>
                            <div class="auction-detail-grid">
                                <div class="auction-detail-box"><strong>Role</strong><span>${currentAuctionPlayer.role}</span></div>
                                <div class="auction-detail-box"><strong>Category</strong><span>Cat ${currentAuctionPlayer.category}</span></div>
                                <div class="auction-detail-box"><strong>Batting</strong><span>${currentAuctionPlayer.battingStyle}</span></div>
                                <div class="auction-detail-box"><strong>Bowling</strong><span>${currentAuctionPlayer.bowlingStyle}</span></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="auction-panel auction-stats-panel">
                    <div class="auction-stats-grid">
                        ${auctionStatHtml}
                    </div>
                </div>
            </div>

            <div class="auction-side-panel">
                <div class="auction-panel auction-actions-panel">
                    <div class="auction-section-head">
                        <div>
                            <div class="auction-heading">Actions</div>
                            <div class="auction-subtitle">Bid quickly or pass to keep the auction hot.</div>
                        </div>
                    </div>
                    <div class="auction-actions-list">
                        ${teams.map(team => `
                            <button class="team-bid-preview ${currentBidder?.id === team.id ? 'active' : ''}" onclick="teamBid(${team.id})">
                                <div>${team.name}</div>
                                <div>₹${(team.budget - team.spentAmount).toLocaleString()} left</div>
                            </button>
                        `).join('')}
                    </div>
                    <div class="auction-button-row">
                        <button class="btn-undo" onclick="undoBid()" ${bidHistory.length === 0 ? 'disabled' : ''}>↶ Undo</button>
                        <button class="btn-secondary" onclick="passPlayer()">PASS</button>
                        <button class="btn-primary" onclick="sellPlayer()">Sold!</button>
                    </div>
                </div>

                <div class="auction-panel auction-activity-panel">
                    <div class="auction-section-head">
                        <div>
                            <div class="auction-heading">Live Activity</div>
                            <div class="auction-subtitle">Recent bid summary and auction updates.</div>
                        </div>
                    </div>
                    <div class="activity-list">
                        ${activityItems.join('')}
                        ${bidderInfo}
                        <div class="activity-row">
                            <div>Current Bid Team</div>
                            <strong>${bidderTeam?.name ?? 'No team'}</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Render Sold Players
function renderSoldPlayers() {
    const container = document.getElementById('soldList');

    console.log('Rendering sold players:', soldPlayers);

    if (soldPlayers.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No players sold yet</p></div>';
        return;
    }

    container.innerHTML = soldPlayers.map((sold, index) => `
        <div class="sold-player" style="display:flex;align-items:center; gap:12px;">
            <img src="${sold.imageUrl || 'https://via.placeholder.com/70x90/667eea/ffffff?text=No+Img'}" alt="${sold.playerName}" style="width:70px;height:90px;object-fit:cover;border-radius:8px;border:2px solid #667eea;" onerror="console.log('Image failed to load for:', sold.playerName, sold.imageUrl)" />
            <div style="flex:1;">
                <div style="margin-bottom: 8px; color: #999; font-size: 12px;">#${index + 1}</div>
                <div class="sold-info" style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                    <span class="sold-player-name">${sold.playerName}</span>
                    <span class="sold-price">₹${sold.soldPrice.toLocaleString()}</span>
                </div>
                <div class="sold-team" style="font-size:13px; color:#444;">
                    <strong>${sold.soldTo}</strong> • ${sold.role} • Category ${sold.category}
                </div>
            </div>
        </div>
    `).join('');
}

// Render Unsold Players
function renderUnsoldPlayers() {
    const container = document.getElementById('unsoldList');

    if (unsoldPlayers.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>All players sold!</p></div>';
        return;
    }

    container.innerHTML = unsoldPlayers.map(unsold => `
        <div class="list-item" style="align-items:flex-start; gap:12px;">
            <img src="${unsold.imageUrl || 'https://via.placeholder.com/70x90/667eea/ffffff?text=No+Img'}" alt="${unsold.playerName}" style="width:70px; height:90px; object-fit:cover; border-radius:8px; border:2px solid #667eea;" />
            <div class="item-info">
                <div class="item-name">${unsold.playerName}</div>
                <div class="item-details">
                    <span class="badge badge-role">${unsold.role}</span>
                    <span class="badge badge-category">Category ${unsold.category}</span>
                    <span style="color: #667eea; font-weight: 600;">₹${unsold.basePrice}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Update Stats
function updateStats() {
    const totalPlayers = players.length + soldPlayers.length + unsoldPlayers.length;
    const totalSpent = soldPlayers.reduce((sum, p) => sum + p.soldPrice, 0);

    document.getElementById('totalPlayers').textContent = totalPlayers;
    document.getElementById('playersSold').textContent = soldPlayers.length;
    document.getElementById('totalSpent').textContent = '₹' + totalSpent.toLocaleString();
    document.getElementById('remainingPlayers').textContent = players.length;
}

function printSummary() {
    window.print();
}

function downloadPlayersCSV() {
    const rows = [
        ['Type', 'Player Name', 'Role', 'Category', 'Image URL', 'Base Price', 'Sold Price', 'Sold To', 'Sold At']
    ];

    players.forEach(p => {
        rows.push(['Available', p.name, p.role, p.category, p.imageUrl, p.basePrice || '', '', '', '']);
    });

    unsoldPlayers.forEach(p => {
        rows.push(['Unsold', p.playerName, p.role, p.category, p.imageUrl || '', p.basePrice || '', '', '', '']);
    });

    soldPlayers.forEach(p => {
        rows.push(['Sold', p.playerName, p.role, p.category, p.imageUrl || '', p.basePrice || '', p.soldPrice, p.soldTo, p.soldAt]);
    });

    const csvContent = rows.map(r => r.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'cricket-auction-summary.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Reset Everything
function resetAuction() {
    showConfirmModal('Are you sure? This will clear all data.', () => {
        players = [];
        teams = [];
        soldPlayers = [];
        unsoldPlayers = [];
        currentAuctionPlayer = null;
        currentBid = 0;
        currentBidder = null;
        saveData();
        renderAll();
        switchPage('home');
    }, 'Reset Auction');
}

// Badge Styles
const style = document.createElement('style');
style.textContent = `
    .badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        margin-right: 5px;
    }

    .badge-category {
        background: #e8eaf6;
        color: #667eea;
    }

    .badge-role {
        background: #fff3e0;
        color: #f57c00;
    }

    @media (max-width: 768px) {
        .nav-links {
            flex-direction: column;
            width: 100%;
        }

        .nav-btn {
            width: 100%;
            font-size: 12px;
            padding: 8px 12px;
        }

        .auction-details {
            grid-template-columns: 1fr 1fr !important;
        }

        .team-grid {
            grid-template-columns: 1fr !important;
        }

        .bid-buttons {
            grid-template-columns: 1fr !important;
        }
    }
`;
document.head.appendChild(style);

// Expose functions globally for inline onclick handlers
window.initializeData = initializeData;
window.switchPage = switchPage;
window.switchSummaryTab = switchSummaryTab;
window.getNextPlayer = getNextPlayer;
window.teamBid = teamBid;
window.quickBidTeam = quickBidTeam;
window.undoBid = undoBid;
window.passPlayer = passPlayer;
window.sellPlayer = sellPlayer;
window.releasePlayer = releasePlayer;
window.showSaleModal = showSaleModal;
window.closeSaleModal = closeSaleModal;
window.showInfoModal = showInfoModal;
window.closeInfoModal = closeInfoModal;
window.showConfirmModal = showConfirmModal;
window.closeConfirmModal = closeConfirmModal;
window.addPlayer = addPlayer;
window.clearPlayerForm = clearPlayerForm;
window.addTeam = addTeam;
window.clearTeamForm = clearTeamForm;
window.openAddPlayerModal = openAddPlayerModal;
window.closeAddPlayerModal = closeAddPlayerModal;
window.submitPlayerForm = submitPlayerForm;
window.openAddTeamModal = openAddTeamModal;
window.closeAddTeamModal = closeAddTeamModal;
window.submitTeamForm = submitTeamForm;
window.editPlayer = editPlayer;
window.updatePlayer = updatePlayer;
window.editTeam = editTeam;
window.updateTeam = updateTeam;
window.removePlayer = removePlayer;
window.removeTeam = removeTeam;
window.printSummary = printSummary;
window.downloadPlayersCSV = downloadPlayersCSV;
window.resetAuction = resetAuction;

// Initialize on load
window.addEventListener('DOMContentLoaded', function() {
    initializeData();
    
    // Add modal close event listeners
    const closeModalBtn = document.getElementById('closeSaleModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeSaleModal);
    }
});
