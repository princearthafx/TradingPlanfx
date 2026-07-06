// Firebase compat CDNs are loaded in index.html, using global 'firebase' object

// Firebase Globals
const ADMIN_EMAIL = 'admin@princeartha.com'; // Ubah email ini dengan email admin Anda sendiri!
let firebaseApp = null;
let auth = null;
let db = null;
let currentFirebaseUser = null;
let unsubscribeUserTrades = null;
let isFirebaseConnected = false;
let userProfileRole = 'user'; // 'user' or 'admin'

// Admin panel globals
let adminSelectedUserId = null;
let adminUnsubscribeSelectedUserTrades = null;
let adminEquityChartInstance = null;

// State Management
let appState = {
    initialCapital: 150000000.00,
    currentCapital: 150000000.00,
    trades: [] // Starts clean
};

// Global variables for Chart.js instance
let equityChartInstance = null;

// Conversion rate from USD to IDR for trading calculations
const USD_TO_IDR = 16000;

const DAY_NAMES_ID = {
    Sunday: 'Minggu',
    Monday: 'Senin',
    Tuesday: 'Selasa',
    Wednesday: 'Rabu',
    Thursday: 'Kamis',
    Friday: 'Jumat',
    Saturday: 'Sabtu'
};

const MONTH_NAMES_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

// Modal outcome selector state
let inputOutcome = 'PROFIT'; // PROFIT or LOSS default

// Initialize Application on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded: App initialization starting...");
    // Initialize Firebase if config exists
    initFirebase();
    
    console.log("Initializing systems...");
    initClock();
    setupNavigation();
    setupWizardListeners();
    setupJournalListeners();
    setupSettingsListeners();
    console.log("Binding Auth Forms and Modals...");
    setupAuthFormListeners(); // Set up login, register, logout, and config modal listeners
    console.log("Auth Forms and Modals bound successfully!");
    
    // Initial renders
    updateSidebarBalance();
    renderAll();
    updateMarketSessions(); // Initialize sessions clocks
    
    // Set default entry date to today in planner
    document.getElementById('plan-date').value = new Date().toISOString().substring(0, 10);
    
    // Bind Growth Planner listeners
    setupGrowthPlanner();
});

// Real-time Date and Clock Display
function initClock() {
    const clockEl = document.getElementById('current-date-time');
    function updateClock() {
        const now = new Date();
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayName = days[now.getDay()];
        const dateStr = now.getDate().toString().padStart(2, '0');
        const monthName = MONTH_NAMES_ID[now.getMonth()];
        const year = now.getFullYear();
        const timeStr = now.toTimeString().split(' ')[0];
        
        clockEl.innerHTML = `<i class="fa-regular fa-calendar-days"></i> ${dayName}, ${dateStr} ${monthName} ${year} | <i class="fa-regular fa-clock"></i> ${timeStr}`;
        
        // Live update sessions clocks alongside main header clock
        updateMarketSessions();
    }
    updateClock();
    setInterval(updateClock, 1000);
}

// Market Sessions Monitor Clocks (Dynamic based on City Timezones)
function updateMarketSessions() {
    const sessions = [
        { id: 'sydney', tz: 'Australia/Sydney', start: 8, end: 17 },
        { id: 'tokyo', tz: 'Asia/Tokyo', start: 9, end: 18 },
        { id: 'london', tz: 'Europe/London', start: 8, end: 17 },
        { id: 'newyork', tz: 'America/New_York', start: 8, end: 17 }
    ];

    sessions.forEach(sess => {
        try {
            // Get local hour & minute in target timezone
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: sess.tz,
                hour: 'numeric',
                minute: 'numeric',
                hour12: false
            });
            const parts = formatter.formatToParts(new Date());
            const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
            const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
            
            // Get local day of week in target timezone to check for weekends
            const dayFormatter = new Intl.DateTimeFormat('en-US', {
                timeZone: sess.tz,
                weekday: 'long'
            });
            const localDay = dayFormatter.format(new Date());
            const isWeekend = localDay === 'Saturday' || localDay === 'Sunday';

            const isOpen = !isWeekend && hour >= sess.start && hour < sess.end;
            const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            
            // DOM element updates
            const cardEl = document.getElementById(`session-${sess.id}`);
            const timeEl = document.getElementById(`time-${sess.id}`);
            if (!cardEl || !timeEl) return;
            
            const statusEl = cardEl.querySelector('.session-status');
            
            timeEl.innerText = timeStr;
            
            if (isOpen) {
                cardEl.classList.add('active-session');
                statusEl.innerText = 'BUKA';
                statusEl.className = 'session-status badge-open';
            } else {
                cardEl.classList.remove('active-session');
                statusEl.innerText = 'TUTUP';
                statusEl.className = 'session-status badge-closed';
            }
        } catch (e) {
            console.error('Error updating session for ' + sess.id, e);
        }
    });
}

// Navigation Tabs Setup
function setupNavigation() {
    const menuItems = document.querySelectorAll('.menu-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    const pageMeta = {
        dashboard: {
            title: 'Ringkasan Dashboard',
            subtitle: 'Pantau perkembangan modal dan statistik trading Anda.'
        },
        wizard: {
            title: 'Input Laporan Harian',
            subtitle: 'Catat hasil transaksi harian Anda. Pilihan Profit/Loss akan memperbarui saldo modal Anda secara langsung.'
        },
        journal: {
            title: 'Laporan PnL & Jurnal Trading',
            subtitle: 'Evaluasi total profit, kerugian, tingkat disiplin, dan emosi Anda.'
        },
        'sessions-news': {
            title: 'Sesi Pasar & Berita Forex',
            subtitle: 'Pantau jam aktif sesi pasar finansial dan jadwal berita ekonomi rilis.'
        },
        settings: {
            title: 'Pengaturan & Backup',
            subtitle: 'Konfigurasi parameter akun, ekspor data, dan pemeliharaan database.'
        }
    };

    function switchTab(tabId) {
        // Toggle active navigation buttons
        menuItems.forEach(item => {
            if (item.getAttribute('data-tab') === tabId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        // Toggle active panels
        tabContents.forEach(content => {
            if (content.id === `tab-${tabId}`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });

        // Update headers
        if (pageMeta[tabId]) {
            pageTitle.innerText = pageMeta[tabId].title;
            pageSubtitle.innerText = pageMeta[tabId].subtitle;
        }

        // Specific actions when entering tabs
        if (tabId === 'dashboard') {
            setTimeout(renderEquityChart, 100); // re-draw charts for sizing
        } else if (tabId === 'wizard') {
            // Keep default values if not editing
            if (!document.getElementById('plan-edit-id').value) {
                resetWizard();
            }
        }

        // Reset edit mode if switching elsewhere
        if (tabId !== 'wizard' && document.getElementById('plan-edit-id').value) {
            cancelEditMode();
        }
    }
    
    // Expose globally
    window.switchTab = switchTab;

    // Bind sidebar clicks
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(item.getAttribute('data-tab'));
        });
    });

    // Support links within dashboard pointing to other tabs
    document.querySelectorAll('[data-go-tab]').forEach(el => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(el.getAttribute('data-go-tab'));
        });
    });
}

// Wizard / Planner Functionality (Daily Input Setup)
function setupWizardListeners() {
    // Sync input capital with dashboard capital default
    document.getElementById('plan-capital').value = Math.round(appState.currentCapital);
    
    // Bind outcome Profit / Loss selector buttons in daily input tab
    const profitBtn = document.querySelector('.btn-input-outcome.profit');
    const lossBtn = document.querySelector('.btn-input-outcome.loss');

    profitBtn.addEventListener('click', () => {
        inputOutcome = 'PROFIT';
        profitBtn.style.backgroundColor = 'rgba(16, 185, 129, 0.12)';
        profitBtn.style.borderColor = 'var(--success-green)';
        profitBtn.style.color = 'var(--success-green)';
        
        lossBtn.style.backgroundColor = 'rgba(5, 9, 16, 0.5)';
        lossBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        lossBtn.style.color = 'var(--text-muted)';
    });

    lossBtn.addEventListener('click', () => {
        inputOutcome = 'LOSS';
        lossBtn.style.backgroundColor = 'rgba(244, 63, 94, 0.12)';
        lossBtn.style.borderColor = 'var(--error-red)';
        lossBtn.style.color = 'var(--error-red)';
        
        profitBtn.style.backgroundColor = 'rgba(5, 9, 16, 0.5)';
        profitBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        profitBtn.style.color = 'var(--text-muted)';
    });

    // Save Plan / Submit Daily Log
    document.getElementById('btn-save-plan').addEventListener('click', saveTradingPlan);
    document.getElementById('btn-cancel-edit').addEventListener('click', cancelEditMode);
}

// Reset Daily Input Form
function resetWizard() {
    document.getElementById('trading-plan-form').reset();
    document.getElementById('plan-date').value = new Date().toISOString().substring(0, 10);
    document.getElementById('plan-capital').value = Math.round(appState.currentCapital);
    document.getElementById('plan-edit-id').value = '';

    // Reset outcome toggles to default PROFIT
    inputOutcome = 'PROFIT';
    const profitBtn = document.querySelector('.btn-input-outcome.profit');
    const lossBtn = document.querySelector('.btn-input-outcome.loss');

    profitBtn.style.backgroundColor = 'rgba(16, 185, 129, 0.12)';
    profitBtn.style.borderColor = 'var(--success-green)';
    profitBtn.style.color = 'var(--success-green)';
    
    lossBtn.style.backgroundColor = 'rgba(5, 9, 16, 0.5)';
    lossBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
    lossBtn.style.color = 'var(--text-muted)';

    // Reset Title/Subtitle
    document.getElementById('planner-form-title').innerHTML = '<i class="fa-solid fa-pen-to-square text-gold"></i> Input Laporan Harian';
    document.getElementById('planner-form-subtitle').innerText = 'Catat hasil transaksi harian Anda. Pilihan Profit/Loss akan memperbarui saldo modal Anda secara langsung.';
    document.getElementById('btn-save-plan').innerHTML = '<i class="fa-solid fa-circle-check"></i> Simpan Laporan';
    document.getElementById('btn-cancel-edit').style.display = 'none';
}

async function saveTradingPlan() {
    const capital = parseFloat(document.getElementById('plan-capital').value.replace(/[^0-9.-]/g, '')) || 0;
    const pnlInput = parseFloat(document.getElementById('plan-pnl-calc').value.replace(/[^0-9.-]/g, '')) || 0;
    const dateStr = document.getElementById('plan-date').value;
    const emotion = document.getElementById('plan-emotion').value;
    const notes = document.getElementById('plan-notes').value.trim();
    const editId = document.getElementById('plan-edit-id').value;

    if (pnlInput <= 0 || !dateStr) {
        alert('Mohon isi nominal PnL dengan benar (angka positif)!');
        return;
    }

    if (!currentFirebaseUser) {
        alert('Sesi masuk telah kedaluwarsa, silakan masuk kembali!');
        return;
    }

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dateObj = new Date(dateStr);
    const dayName = days[dateObj.getDay()];
    
    // Compute signed PnL
    const actualPnl = inputOutcome === 'PROFIT' ? pnlInput : -pnlInput;

    try {
        const userTradesRef = db.collection('users').doc(currentFirebaseUser.uid).collection('trades');
        
        if (editId) {
            // Edit Mode
            const index = appState.trades.findIndex(t => t.id === editId);
            if (index !== -1) {
                const trade = appState.trades[index];
                const docRef = userTradesRef.doc(trade.firebaseId);
                
                await docRef.set({
                    date: dateStr,
                    day: dayName,
                    capitalAllocated: capital,
                    actualPnl: actualPnl,
                    actualPnlPercent: (actualPnl / capital) * 100,
                    emotion: emotion,
                    notes: notes
                }, { merge: true });
                
                alert('Laporan harian berhasil diperbarui!');
                cancelEditMode();
            }
        } else {
            // Create new daily log entry
            const log = {
                id: 'log_' + Date.now(),
                pair: 'XAUUSD',
                date: dateStr,
                day: dayName,
                capitalAllocated: capital,
                actualPnl: actualPnl,
                actualPnlPercent: (actualPnl / capital) * 100,
                emotion: emotion,
                notes: notes,
                status: 'CLOSED'
            };

            await userTradesRef.add(log);
            alert('Laporan harian berhasil disimpan!');
            resetWizard();
        }
        
        // Switch to Journal tab
        const journalMenu = document.querySelector('.menu-item[data-tab="journal"]');
        if (journalMenu) journalMenu.click();
        
    } catch (e) {
        console.error("Error saving trading plan:", e);
        alert("Gagal menyimpan data ke cloud database: " + e.message);
    }
}

// Edit Mode Initiator (Pulls data to form)
function editJournalRecord(id) {
    const trade = appState.trades.find(t => t.id === id);
    if (!trade) return;

    // Fill form fields
    document.getElementById('plan-edit-id').value = trade.id;
    document.getElementById('plan-date').value = trade.date;
    document.getElementById('plan-capital').value = Math.round(trade.capitalAllocated);
    document.getElementById('plan-pnl-calc').value = Math.abs(trade.actualPnl);
    document.getElementById('plan-emotion').value = trade.emotion;
    document.getElementById('plan-notes').value = trade.notes;

    // Toggle outcomes
    const profitBtn = document.querySelector('.btn-input-outcome.profit');
    const lossBtn = document.querySelector('.btn-input-outcome.loss');

    if (trade.actualPnl >= 0) {
        inputOutcome = 'PROFIT';
        profitBtn.style.backgroundColor = 'rgba(16, 185, 129, 0.12)';
        profitBtn.style.borderColor = 'var(--success-green)';
        profitBtn.style.color = 'var(--success-green)';
        
        lossBtn.style.backgroundColor = 'rgba(5, 9, 16, 0.5)';
        lossBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        lossBtn.style.color = 'var(--text-muted)';
    } else {
        inputOutcome = 'LOSS';
        lossBtn.style.backgroundColor = 'rgba(244, 63, 94, 0.12)';
        lossBtn.style.borderColor = 'var(--error-red)';
        lossBtn.style.color = 'var(--error-red)';
        
        profitBtn.style.backgroundColor = 'rgba(5, 9, 16, 0.5)';
        profitBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        profitBtn.style.color = 'var(--text-muted)';
    }

    // Update Form headers & buttons
    document.getElementById('planner-form-title').innerHTML = '<i class="fa-solid fa-pen-to-square text-gold"></i> Edit Laporan Harian';
    document.getElementById('planner-form-subtitle').innerText = 'Perbaiki kesalahan input laporan harian Anda di bawah ini.';
    document.getElementById('btn-save-plan').innerHTML = '<i class="fa-solid fa-circle-check"></i> Simpan Perubahan';
    document.getElementById('btn-cancel-edit').style.display = 'inline-block';

    // Switch views
    const inputHarianMenu = document.querySelector('.menu-item[data-tab="wizard"]');
    if (inputHarianMenu) inputHarianMenu.click();
}

// Cancel editing and restore form state
function cancelEditMode() {
    resetWizard();
}

// Journal Tab & Filtration
function setupJournalListeners() {
    const filters = ['filter-pair', 'filter-outcome', 'filter-day'];
    filters.forEach(id => {
        document.getElementById(id).addEventListener('change', renderJournal);
    });

    document.getElementById('btn-reset-filters').addEventListener('click', () => {
        document.getElementById('filter-pair').value = 'ALL';
        document.getElementById('filter-outcome').value = 'ALL';
        document.getElementById('filter-day').value = 'ALL';
        renderJournal();
    });
}

function renderJournal() {
    const tbody = document.getElementById('journal-tbody');
    tbody.innerHTML = '';

    const filterOutcome = document.getElementById('filter-outcome').value;
    const filterDay = document.getElementById('filter-day').value;

    let filteredTrades = appState.trades.filter(t => t.status === 'CLOSED');

    if (filterOutcome !== 'ALL') {
        if (filterOutcome === 'PROFIT') {
            filteredTrades = filteredTrades.filter(t => t.actualPnl > 5);
        } else if (filterOutcome === 'LOSS') {
            filteredTrades = filteredTrades.filter(t => t.actualPnl < -5);
        } else if (filterOutcome === 'BREAKEVEN') {
            filteredTrades = filteredTrades.filter(t => Math.abs(t.actualPnl) <= 5);
        }
    }

    if (filterDay !== 'ALL') {
        filteredTrades = filteredTrades.filter(t => t.day === filterDay);
    }

    if (filteredTrades.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    Tidak ditemukan data laporan PnL yang sesuai dengan filter Anda.
                </td>
            </tr>
        `;
        return;
    }

    filteredTrades.forEach(trade => {
        const row = document.createElement('tr');
        
        const dateFormatted = new Date(trade.date).toLocaleDateString('id-ID');
        const indDay = DAY_NAMES_ID[trade.day] || trade.day;
        const pnlClass = trade.actualPnl > 5 ? 'pos-pnl' : (trade.actualPnl < -5 ? 'neg-pnl' : '');
        const pnlSign = trade.actualPnl > 5 ? '+' : '';
        
        let outcomeBadge = '<span class="outcome-badge breakeven">Breakeven</span>';
        if (trade.actualPnl > 5) {
            outcomeBadge = '<span class="outcome-badge win">WIN</span>';
        } else if (trade.actualPnl < -5) {
            outcomeBadge = '<span class="outcome-badge loss">LOSS</span>';
        }

        const emotionsMap = {
            Disciplined: 'Disiplin',
            Greedy: 'Serakah (FOMO)',
            Fearful: 'Takut',
            Patient: 'Sabar',
            Revenge: 'Balas Dendam'
        };
        const indEmotion = emotionsMap[trade.emotion] || trade.emotion || 'Netral';

        row.innerHTML = `
            <td>
                <div class="t-date-col">
                    <span>${dateFormatted}</span>
                    <span class="t-day">${indDay}</span>
                </div>
            </td>
            <td><strong>${trade.pair}</strong></td>
            <td class="t-pnl-cell ${pnlClass}">
                <strong>${pnlSign}Rp ${Math.round(Math.abs(trade.actualPnl)).toLocaleString('id-ID')}</strong><br>
                <span class="helper-text ${pnlClass}">${pnlSign}${trade.actualPnlPercent.toFixed(2)}%</span>
            </td>
            <td>${outcomeBadge}</td>
            <td>
                <span class="emotion-tag">${indEmotion}</span>
                <div class="td-notes" title="${trade.notes || ''}">
                    ${trade.notes || '-'}
                </div>
            </td>
            <td>
                <button class="btn-icon-gold" onclick="editJournalRecord('${trade.id}')" title="Edit laporan harian" style="background: none; border: none; color: var(--gold-primary); cursor: pointer; font-size: 14px; margin-right: 12px;">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="btn-icon-danger" onclick="deleteJournalRecord('${trade.id}')" title="Hapus laporan harian" style="background: none; border: none; color: var(--error-red); cursor: pointer; font-size: 14px;">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function deleteJournalRecord(id) {
    if (!currentFirebaseUser) {
        alert("Sesi masuk tidak aktif!");
        return;
    }
    if (confirm('Hapus laporan transaksi harian ini? Saldo modal Anda akan dikurangi/ditambah kembali secara otomatis.')) {
        const index = appState.trades.findIndex(t => t.id === id);
        if (index !== -1) {
            try {
                const trade = appState.trades[index];
                const docRef = db.collection('users').doc(currentFirebaseUser.uid).collection('trades').doc(trade.firebaseId);
                await docRef.delete();
                alert("Laporan harian berhasil dihapus.");
            } catch (e) {
                console.error("Error deleting trade doc:", e);
                alert("Gagal menghapus data dari cloud database: " + e.message);
            }
        }
    }
}

// Config / Settings View
function setupSettingsListeners() {
    // Initial Setup Capital form submission - Bind directly to button click to prevent validation blocks
    document.getElementById('btn-save-capital-settings').addEventListener('click', async (e) => {
        e.preventDefault();
        const initialVal = document.getElementById('settings-initial-capital').value;
        const currentVal = document.getElementById('settings-current-capital').value;
        
        const initial = parseFloat(initialVal.replace(/[^0-9.-]/g, ''));
        const current = parseFloat(currentVal.replace(/[^0-9.-]/g, ''));

        if (isNaN(initial) || initial <= 0 || isNaN(current) || current <= 0) {
            alert('Masukkan nilai modal yang valid!');
            return;
        }

        if (!currentFirebaseUser) {
            alert("Silakan masuk terlebih dahulu!");
            return;
        }

        try {
            await db.collection('users').doc(currentFirebaseUser.uid).set({
                initialCapital: initial,
                currentCapital: current
            }, { merge: true });
            
            appState.initialCapital = initial;
            recalculateBalance();
            renderAll();
            alert('Konfigurasi modal berhasil disimpan.');
        } catch (err) {
            console.error("Error updating user capital:", err);
            alert("Gagal menyimpan modal ke database cloud: " + err.message);
        }
    });

    // Backup controls
    document.getElementById('btn-export-data').addEventListener('click', exportDataToJson);
    
    const triggerBtn = document.getElementById('btn-trigger-import');
    const fileInput = document.getElementById('import-file-input');
    
    triggerBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', importDataFromJson);

    document.getElementById('btn-load-mock-data').addEventListener('click', () => {
        if (confirm('Muat data demonstrasi (mock)? Ini akan mengganti seluruh data Anda saat ini.')) {
            loadMockDataEngine();
        }
    });

    document.getElementById('btn-clear-all-data').addEventListener('click', () => {
        if (confirm('PERINGATAN! Ini akan menghapus seluruh data capital dan jurnal Anda selamanya. Lanjutkan?')) {
            localStorage.removeItem('prince_artha_trading_state');
            appState = {
                initialCapital: 150000000.00,
                currentCapital: 150000000.00,
                trades: []
            };
            renderAll();
            alert('Semua data berhasil dibersihkan.');
        }
    });
}

// Render Dashboard View Statistics
function renderDashboardStats() {
    const closedTrades = appState.trades.filter(t => t.status === 'CLOSED');
    
    // Net PnL sum
    const totalPnl = closedTrades.reduce((acc, t) => acc + t.actualPnl, 0);
    const pnlPercent = (totalPnl / appState.initialCapital) * 100;
    
    const netPnlEl = document.getElementById('dashboard-net-pnl');
    const netPnlPctEl = document.getElementById('dashboard-net-pnl-percent');
    
    netPnlEl.innerText = `${totalPnl >= 0 ? '' : '-'}Rp ${Math.abs(Math.round(totalPnl)).toLocaleString('id-ID')}`;
    netPnlEl.className = `metric-value ${totalPnl >= 0 ? 'pos-pnl' : 'neg-pnl'}`;
    netPnlPctEl.innerText = `${totalPnl >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% dari Modal Awal (Rp ${Math.round(appState.initialCapital).toLocaleString('id-ID')})`;
    netPnlPctEl.className = `metric-subtext ${totalPnl >= 0 ? 'pos-pnl' : 'neg-pnl'}`;

    // Win Rate Calculation
    const totalWins = closedTrades.filter(t => t.actualPnl > 5).length;
    const totalClosed = closedTrades.length;
    const winRate = totalClosed > 0 ? Math.round((totalWins / totalClosed) * 100) : 0;
    
    document.getElementById('dashboard-win-rate').innerText = `${winRate}%`;
    document.getElementById('dashboard-win-rate-progress').style.width = `${winRate}%`;

    // Total Trades count
    const xauCount = appState.trades.filter(t => t.pair === 'XAUUSD').length;
    document.getElementById('dashboard-total-trades').innerText = appState.trades.length;
    document.getElementById('dashboard-ratio-split').innerText = `Total Laporan Harian: ${xauCount}`;

    // Profit Factor calculation
    let grossProfit = 0;
    let grossLoss = 0;
    closedTrades.forEach(t => {
        if (t.actualPnl > 0) grossProfit += t.actualPnl;
        else grossLoss += Math.abs(t.actualPnl);
    });
    
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 99.99 : 0.00);
    document.getElementById('dashboard-profit-factor').innerText = profitFactor.toFixed(2);
    
    let factorDesc = 'Belum ada loss';
    if (grossLoss > 0) {
        if (profitFactor >= 2.0) factorDesc = 'Sangat Sehat (Excellent)';
        else if (profitFactor >= 1.0) factorDesc = 'Menguntungkan (Profitable)';
        else factorDesc = 'Kurang Sehat (Unprofitable)';
    }
    document.getElementById('dashboard-factor-desc').innerText = factorDesc;

    // Day of Week Distribution Metrics
    renderDayOfWeekMetrics(closedTrades);

    // Recent 3 Trades rendering
    renderRecentTrades();
}

// Calculate and render Day-of-week performance grid
function renderDayOfWeekMetrics(closedTrades) {
    const container = document.getElementById('day-perf-container');
    container.innerHTML = '';

    const daysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const indDaysList = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

    // Group P&L by Day
    const dayPnl = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0 };
    closedTrades.forEach(t => {
        if (dayPnl[t.day] !== undefined) {
            dayPnl[t.day] += t.actualPnl;
        }
    });

    // Check if there's any trade data at all
    const maxVal = Math.max(...Object.values(dayPnl).map(Math.abs), 1000000);
    let hasData = closedTrades.length > 0;

    if (!hasData) {
        container.innerHTML = '<p class="text-center text-muted py-4">Belum ada data trading untuk dianalisis.</p>';
        return;
    }

    daysList.forEach((day, index) => {
        const val = dayPnl[day];
        const pctWidth = Math.min((Math.abs(val) / maxVal) * 100, 100);
        const indName = indDaysList[index];
        const sign = val > 5 ? '+' : '';
        const outcomeClass = val > 5 ? 'profit' : (val < -5 ? 'loss' : '');
        const textClass = val > 5 ? 'pos-pnl' : (val < -5 ? 'neg-pnl' : 'text-muted');

        const row = document.createElement('div');
        row.className = 'day-perf-row';
        row.innerHTML = `
            <span class="day-name">${indName}</span>
            <div class="day-bar-wrapper">
                <div class="day-bar ${outcomeClass}" style="width: ${pctWidth === 0 ? '1' : pctWidth}%"></div>
            </div>
            <span class="day-value ${textClass}">${sign}Rp ${Math.round(val/1000)}k</span>
        `;
        container.appendChild(row);
    });
}

// Render last 3 trades on Dashboard panel
function renderRecentTrades() {
    const container = document.getElementById('recent-trades-container');
    container.innerHTML = '';

    const recent = appState.trades.slice(0, 3);

    if (recent.length === 0) {
        container.innerHTML = '<p class="text-center text-muted py-3">Belum ada laporan harian terdokumentasi.</p>';
        return;
    }

    recent.forEach(trade => {
        const item = document.createElement('div');
        item.className = 'recent-trade-item';
        
        const dateFormatted = new Date(trade.date).toLocaleDateString('id-ID');
        
        let pnlText = '';
        const sign = trade.actualPnl > 5 ? '+' : '';
        const pnlClass = trade.actualPnl > 5 ? 'pos-pnl' : (trade.actualPnl < -5 ? 'neg-pnl' : '');
        pnlText = `
            <span class="rt-pnl-val ${pnlClass}">${sign}Rp ${Math.round(Math.abs(trade.actualPnl)).toLocaleString('id-ID')}</span><br>
            <span class="rt-pnl-percent ${pnlClass}">${sign}${trade.actualPnlPercent.toFixed(2)}%</span>
        `;

        item.innerHTML = `
            <div class="rt-left">
                <div class="rt-icon xau">
                    <i class="fa-solid fa-coins"></i>
                </div>
                <div class="rt-info">
                    <span class="rt-pair">${trade.pair}</span>
                    <div class="rt-date">${dateFormatted}</div>
                </div>
            </div>
            <div class="rt-pnl">
                ${pnlText}
            </div>
        `;
        container.appendChild(item);
    });
}

// Generate the Equity Chart visual curve (in IDR)
function renderEquityChart() {
    const canvas = document.getElementById('equityChart');
    if (!canvas) return;

    // Compile equity values in chronological order
    const closedTrades = appState.trades
        .filter(t => t.status === 'CLOSED')
        .reverse();

    let dataPoints = [appState.initialCapital];
    let labels = ['Awal'];

    let currentSum = appState.initialCapital;
    closedTrades.forEach((t, index) => {
        currentSum += t.actualPnl;
        dataPoints.push(currentSum);
        
        const dateObj = new Date(t.date);
        labels.push(`${DAY_NAMES_ID[t.day] || t.day} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`);
    });

    if (equityChartInstance) {
        equityChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    equityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Capital Balance (IDR)',
                data: dataPoints,
                borderColor: '#d4af37',
                borderWidth: 2,
                backgroundColor: 'rgba(212, 175, 55, 0.05)',
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#d4af37',
                pointBorderColor: '#050910',
                pointHoverRadius: 6,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Capital: Rp ${Math.round(context.raw).toLocaleString('id-ID')}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.04)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: {
                            family: 'Montserrat'
                        },
                        callback: function(value) {
                            return 'Rp ' + value.toLocaleString('id-ID');
                        }
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.02)'
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: {
                            family: 'Montserrat'
                        }
                    }
                }
            }
        }
    });
}

// State display sync helper
function updateSidebarBalance() {
    const valueEl = document.getElementById('current-capital-display');
    const growthEl = document.getElementById('pnl-total-percentage');

    const totalClosedPnl = appState.trades
        .filter(t => t.status === 'CLOSED')
        .reduce((acc, t) => acc + t.actualPnl, 0);

    const growthPct = (totalClosedPnl / appState.initialCapital) * 100;

    valueEl.innerText = `Rp ${Math.round(appState.currentCapital).toLocaleString('id-ID')}`;
    
    growthEl.innerText = `${totalClosedPnl >= 0 ? '+' : ''}${growthPct.toFixed(2)}%`;
    growthEl.className = `growth-value ${totalClosedPnl >= 0 ? 'pos' : 'neg'}`;
}

// Master Render trigger
function renderAll() {
    updateSidebarBalance();
    renderDashboardStats();
    renderJournal();
    
    // Render growth planner simulation table
    renderGrowthSimulation();
    
    // Config page setup values
    document.getElementById('settings-initial-capital').value = Math.round(appState.initialCapital);
    document.getElementById('settings-current-capital').value = Math.round(appState.currentCapital);
}

// JSON Data Exporter
function exportDataToJson() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appState, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `PrinceArtha_DailyJournal_Backup_${new Date().toISOString().slice(0,10)}.json`);
    dlAnchorElem.click();
}

// JSON Data Importer
function importDataFromJson(e) {
    const fileReader = new FileReader();
    fileReader.onload = function(event) {
        try {
            const parsed = JSON.parse(event.target.result);
            if (parsed.initialCapital && parsed.currentCapital && Array.isArray(parsed.trades)) {
                appState = parsed;
                saveData();
                renderAll();
                alert('Database Jurnal berhasil diimpor!');
            } else {
                alert('Format JSON tidak cocok dengan template database Prince Artha.');
            }
        } catch (err) {
            alert('Gagal parsing file JSON: ' + err.message);
        }
    };
    if (e.target.files[0]) {
        fileReader.readAsText(e.target.files[0]);
    }
}

// Mock Seed Data Generator in IDR for Dashboard Demonstrations (1 Month Compound Growth Demo)
async function loadMockDataEngine() {
    if (!currentFirebaseUser) {
        alert("Silakan masuk terlebih dahulu!");
        return;
    }
    
    // 1. Clear existing trades
    const tradesRef = db.collection('users').doc(currentFirebaseUser.uid).collection('trades');
    try {
        const snapshot = await tradesRef.get();
        const deletePromises = [];
        snapshot.forEach((doc) => {
            deletePromises.push(doc.ref.delete());
        });
        await Promise.all(deletePromises);
        
        // 2. Set user initial capital in users document
        const userRef = db.collection('users').doc(currentFirebaseUser.uid);
        await userRef.set({
            initialCapital: 150000000.00,
            currentCapital: 379202860.00,
            role: userProfileRole
        }, { merge: true });

    } catch (e) {
        console.error("Error preparing mock data:", e);
        alert("Gagal memuat database demonstrasi: " + e.message);
        return;
    }

    const mockTradesList = [
            {
                id: 'mock_20',
                pair: 'XAUUSD',
                date: '2026-07-03',
                day: 'Friday',
                capitalAllocated: 344729860,
                actualPnl: 34473000, // +10%
                actualPnlPercent: 10.0,
                emotion: 'Patient',
                notes: 'Laporan harian: Hari ke-20 selesai! Target pertumbuhan 1 bulan sukses dicapai, saldo akhir grow menakjubkan.',
                status: 'CLOSED'
            },
            {
                id: 'mock_19',
                pair: 'XAUUSD',
                date: '2026-07-02',
                day: 'Thursday',
                capitalAllocated: 351765160,
                actualPnl: -7035300, // -2%
                actualPnlPercent: -2.0,
                emotion: 'Disciplined',
                notes: 'Laporan harian: Loss minor menjelang penutupan sesi London. Resiko terkontrol.',
                status: 'CLOSED'
            },
            {
                id: 'mock_18',
                pair: 'XAUUSD',
                date: '2026-07-01',
                day: 'Wednesday',
                capitalAllocated: 322720360,
                actualPnl: 29044800, // +9%
                actualPnlPercent: 9.0,
                emotion: 'Patient',
                notes: 'Laporan harian: Rilis data USD memberikan dorongan profit buy setup Gold yang sangat kuat.',
                status: 'CLOSED'
            },
            {
                id: 'mock_17',
                pair: 'XAUUSD',
                date: '2026-06-30',
                day: 'Tuesday',
                capitalAllocated: 301607860,
                actualPnl: 21112500, // +7%
                actualPnlPercent: 7.0,
                emotion: 'Disciplined',
                notes: 'Laporan harian: Pemulihan saldo berkat transaksi beli di supply swing.',
                status: 'CLOSED'
            },
            {
                id: 'mock_16',
                pair: 'XAUUSD',
                date: '2026-06-29',
                day: 'Monday',
                capitalAllocated: 304654360,
                actualPnl: -3046500, // -1%
                actualPnlPercent: -1.0,
                emotion: 'Patient',
                notes: 'Laporan harian: Loss kecil akibat volatilitas pembukaan market pagi.',
                status: 'CLOSED'
            },
            {
                id: 'mock_15',
                pair: 'XAUUSD',
                date: '2026-06-26',
                day: 'Friday',
                capitalAllocated: 282087360,
                actualPnl: 22567000, // +8%
                actualPnlPercent: 8.0,
                emotion: 'Disciplined',
                notes: 'Laporan harian: Mengakhiri minggu ketiga dengan total saldo menembus Rp 300 juta.',
                status: 'CLOSED'
            },
            {
                id: 'mock_14',
                pair: 'XAUUSD',
                date: '2026-06-25',
                day: 'Thursday',
                capitalAllocated: 256443060,
                actualPnl: 25644300, // +10%
                actualPnlPercent: 10.0,
                emotion: 'Patient',
                notes: 'Laporan harian: Eksekusi buy sempurna di demand swing H4, pertumbuhan 10% dalam sehari!',
                status: 'CLOSED'
            },
            {
                id: 'mock_13',
                pair: 'XAUUSD',
                date: '2026-06-24',
                day: 'Wednesday',
                capitalAllocated: 261676560,
                actualPnl: -5233500, // -2%
                actualPnlPercent: -2.0,
                emotion: 'Disciplined',
                notes: 'Laporan harian: Menghadapi koreksi pasar global, loss dibatasi ketat.',
                status: 'CLOSED'
            },
            {
                id: 'mock_12',
                pair: 'XAUUSD',
                date: '2026-06-23',
                day: 'Tuesday',
                capitalAllocated: 249215760,
                actualPnl: 12460800, // +5%
                actualPnlPercent: 5.0,
                emotion: 'Patient',
                notes: 'Laporan harian: Target pertumbuhan 5% tercapai di sesi London.',
                status: 'CLOSED'
            },
            {
                id: 'mock_11',
                pair: 'XAUUSD',
                date: '2026-06-22',
                day: 'Monday',
                capitalAllocated: 235109260,
                actualPnl: 14106500, // +6%
                actualPnlPercent: 6.0,
                emotion: 'Disciplined',
                notes: 'Laporan harian: Membuka minggu ketiga dengan profit konsisten.',
                status: 'CLOSED'
            },
            {
                id: 'mock_10',
                pair: 'XAUUSD',
                date: '2026-06-19',
                day: 'Friday',
                capitalAllocated: 217693760,
                actualPnl: 17415500, // +8%
                actualPnlPercent: 8.0,
                emotion: 'Patient',
                notes: 'Laporan harian: Penutupan minggu kedua yang sangat baik dengan profit 8%.',
                status: 'CLOSED'
            },
            {
                id: 'mock_9',
                pair: 'XAUUSD',
                date: '2026-06-18',
                day: 'Thursday',
                capitalAllocated: 224426560,
                actualPnl: -6732800, // -3%
                actualPnlPercent: -3.0,
                emotion: 'Disciplined',
                notes: 'Laporan harian: Koreksi harga emas menyentuh stop loss, membatasi resiko harian.',
                status: 'CLOSED'
            },
            {
                id: 'mock_8',
                pair: 'XAUUSD',
                date: '2026-06-17',
                day: 'Wednesday',
                capitalAllocated: 205895960,
                actualPnl: 18530600, // +9%
                actualPnlPercent: 9.0,
                emotion: 'Patient',
                notes: 'Laporan harian: Profit maksimal dari pergerakan impulsif sesi New York.',
                status: 'CLOSED'
            },
            {
                id: 'mock_7',
                pair: 'XAUUSD',
                date: '2026-06-16',
                day: 'Tuesday',
                capitalAllocated: 192426160,
                actualPnl: 13469800, // +7%
                actualPnlPercent: 7.0,
                emotion: 'Disciplined',
                notes: 'Laporan harian: Buy setup Gold sukses berjalan pasca liquidity sweep Asia.',
                status: 'CLOSED'
            },
            {
                id: 'mock_6',
                pair: 'XAUUSD',
                date: '2026-06-15',
                day: 'Monday',
                capitalAllocated: 194369860,
                actualPnl: -1943700, // -1%
                actualPnlPercent: -1.0,
                emotion: 'Patient',
                notes: 'Laporan harian: Loss minor di hari Senin pembukaan market.',
                status: 'CLOSED'
            },
            {
                id: 'mock_5',
                pair: 'XAUUSD',
                date: '2026-06-12',
                day: 'Friday',
                capitalAllocated: 185114160,
                actualPnl: 9255700, // +5%
                actualPnlPercent: 5.0,
                emotion: 'Disciplined',
                notes: 'Laporan harian: Menutup akhir pekan pertama dengan profit stabil.',
                status: 'CLOSED'
            },
            {
                id: 'mock_4',
                pair: 'XAUUSD',
                date: '2026-06-11',
                day: 'Thursday',
                capitalAllocated: 168285600,
                actualPnl: 16828560, // +10%
                actualPnlPercent: 10.0,
                emotion: 'Patient',
                notes: 'Laporan harian: Momentum kuat Gold di sesi London, recovery penuh dari loss kemarin.',
                status: 'CLOSED'
            },
            {
                id: 'mock_3',
                pair: 'XAUUSD',
                date: '2026-06-10',
                day: 'Wednesday',
                capitalAllocated: 171720000,
                actualPnl: -3434400, // -2%
                actualPnlPercent: -2.0,
                emotion: 'Disciplined',
                notes: 'Laporan harian: Terkena loss minor karena pembalikan arah harga saat rilis berita.',
                status: 'CLOSED'
            },
            {
                id: 'mock_2',
                pair: 'XAUUSD',
                date: '2026-06-09',
                day: 'Tuesday',
                capitalAllocated: 162000000,
                actualPnl: 9720000, // +6%
                actualPnlPercent: 6.0,
                emotion: 'Disciplined',
                notes: 'Laporan harian: Trading disiplin di sesi NY. Profit harian bertambah.',
                status: 'CLOSED'
            },
            {
                id: 'mock_1',
                pair: 'XAUUSD',
                date: '2026-06-08',
                day: 'Monday',
                capitalAllocated: 150000000,
                actualPnl: 12000000, // +8%
                actualPnlPercent: 8.0,
                emotion: 'Patient',
                notes: 'Laporan harian: Hari ke-1 target harian 5-10% tercapai dengan buy setup Gold di support OB H1.',
                status: 'CLOSED'
            }
    ];

    try {
        const addPromises = mockTradesList.map(trade => tradesRef.add(trade));
        await Promise.all(addPromises);
        alert('Sukses memuat data demonstrasi 1 Bulan Compound Growth ke Database Cloud. Buka Dashboard!');
    } catch (e) {
        console.error("Error adding mock documents:", e);
        alert("Gagal menambahkan berkas demonstrasi: " + e.message);
    }
}

// Local Storage IO Helpers
function saveData() {
    localStorage.setItem('prince_artha_trading_state', JSON.stringify(appState));
}

function loadData() {
    const raw = localStorage.getItem('prince_artha_trading_state');
    if (raw) {
        try {
            appState = JSON.parse(raw);
            // Detect old schema trades containing lot size or pending statuses, and clear for a fresh start
            const hasOldSchema = appState.trades && appState.trades.some(t => t.hasOwnProperty('lotSize') || t.status === 'PENDING' || t.status === 'ACTIVE');
            if (hasOldSchema) {
                console.log("Old schema detected. Resetting database for a clean start.");
                appState = {
                    initialCapital: 150000000.00,
                    currentCapital: 150000000.00,
                    trades: []
                };
                saveData();
            }
        } catch (e) {
            console.error('Error loading data from localStorage, resetting.', e);
        }
    }
}

// Deactivate PWA Service Worker to avoid aggressive file caching
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
            registration.unregister()
                .then(() => console.log('Active Service Worker unregistered successfully.'))
                .catch(err => console.error('Failed to unregister Service Worker:', err));
        }
    });
}

// Target Growth Simulator Logic (5% - 10% Compound Growth)
function setupGrowthPlanner() {
    const startCapitalInput = document.getElementById('simulate-capital');
    const growthSlider = document.getElementById('simulate-growth-slider');

    if (startCapitalInput && growthSlider) {
        // Sync starting capital dynamically with current capital balance for ease of use
        startCapitalInput.value = Math.round(appState.currentCapital);

        startCapitalInput.addEventListener('input', renderGrowthSimulation);
        
        // Re-sync with sidebar balance updates if changed
        startCapitalInput.addEventListener('focus', () => {
            if (parseFloat(startCapitalInput.value) === 150000000 && appState.currentCapital !== 150000000) {
                startCapitalInput.value = Math.round(appState.currentCapital);
                renderGrowthSimulation();
            }
        });

        growthSlider.addEventListener('input', renderGrowthSimulation);
    }
}

function renderGrowthSimulation() {
    const startCapitalInput = document.getElementById('simulate-capital');
    const growthSlider = document.getElementById('simulate-growth-slider');
    const rateDisplay = document.getElementById('growth-rate-display');
    const tbody = document.getElementById('growth-simulation-tbody');
    
    if (!startCapitalInput || !growthSlider || !tbody) return;
    
    const startCapital = parseFloat(startCapitalInput.value) || 150000000;
    const growthRate = parseInt(growthSlider.value, 10) || 5;
    
    rateDisplay.innerText = `${growthRate}%`;
    tbody.innerHTML = '';
    
    let currentCapital = startCapital;
    for (let day = 1; day <= 20; day++) {
        const dailyProfit = currentCapital * (growthRate / 100);
        const endingCapital = currentCapital + dailyProfit;
        const totalPctGrowth = ((endingCapital - startCapital) / startCapital) * 100;
        
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--border-dark)';
        
        row.innerHTML = `
            <td style="padding: 10px 16px; font-weight: 600; color: var(--text-light); font-size: 13px;">Hari ke-${day}</td>
            <td style="padding: 10px 16px; color: var(--success-green); font-weight: 600; font-size: 13px;">+Rp ${Math.round(dailyProfit).toLocaleString('id-ID')}</td>
            <td style="padding: 10px 16px; font-weight: 700; color: var(--text-light); font-size: 13px;">Rp ${Math.round(endingCapital).toLocaleString('id-ID')}</td>
            <td style="padding: 10px 16px; color: var(--gold-primary); font-weight: 600; font-size: 13px;">+${totalPctGrowth.toFixed(1)}%</td>
        `;
        tbody.appendChild(row);
        
        currentCapital = endingCapital; // compound
    }
}

// Expose functions to global window object since app.js is a module
window.deleteJournalRecord = deleteJournalRecord;
window.editJournalRecord = editJournalRecord;

// Firebase Authentication and Configuration Helpers
function loadFirebaseConfig() {
    const configStr = localStorage.getItem('prince_artha_firebase_config');
    if (configStr) {
        try {
            return JSON.parse(configStr);
        } catch (e) {
            console.error('Invalid firebase config JSON:', e);
            localStorage.removeItem('prince_artha_firebase_config');
        }
    }
    
    // Default Fallback: Hardcoded Firebase config for prince-arthafx so users don't see any setup modal!
    return {
        apiKey: "AIzaSyDFQdU9xEKdPnr1Fepl02wql4iBwqkGSsU",
        authDomain: "prince-arthafx.firebaseapp.com",
        projectId: "prince-arthafx",
        storageBucket: "prince-arthafx.firebasestorage.app",
        messagingSenderId: "873427086558",
        appId: "1:873427086558:web:fa76ee5360d14d4497664f",
        measurementId: "G-MLXJETGF9K"
    };
}

async function initFirebase() {
    const config = loadFirebaseConfig();
    if (!config) return false;
    
    try {
        // If an app is already initialized, delete it first to prevent already-exists errors
        if (firebase.apps.length > 0) {
            await firebase.app().delete();
        }
        firebaseApp = firebase.initializeApp(config);
        auth = firebase.auth();
        db = firebase.firestore();
        isFirebaseConnected = true;
        
        // Hide config modal if it was open
        document.getElementById('firebase-config-modal').style.display = 'none';
        
        // Listen to auth state changes
        setupAuthListener();
        return true;
    } catch (e) {
        console.error('Firebase initialization failed:', e);
        alert('Gagal menghubungkan ke Firebase. Periksa kembali JSON Config Anda.');
        localStorage.removeItem('prince_artha_firebase_config');
        document.getElementById('firebase-config-modal').style.display = 'flex';
        return false;
    }
}

async function saveFirebaseConfig() {
    let jsonStr = document.getElementById('firebase-config-json').value.trim();
    if (!jsonStr) {
        alert('Mohon masukkan JSON Config Firebase!');
        return;
    }
    
    // Auto-extract everything inside { } if they pasted the full script code
    if (jsonStr.includes('{') && jsonStr.includes('}')) {
        const start = jsonStr.indexOf('{');
        const end = jsonStr.lastIndexOf('}');
        jsonStr = jsonStr.substring(start, end + 1);
    }
    
    try {
        // Clean up common JS object properties to make it valid strict JSON
        let cleanedJson = jsonStr
            .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":') // Wrap keys in quotes
            .replace(/'/g, '"') // Swap single quotes to double quotes
            .replace(/,\s*([}\]])/g, '$1'); // Remove trailing commas
            
        const parsed = JSON.parse(cleanedJson);
        if (!parsed.apiKey || !parsed.projectId) {
            throw new Error('Konfigurasi tidak lengkap (apiKey atau projectId tidak ada).');
        }
        localStorage.setItem('prince_artha_firebase_config', JSON.stringify(parsed));
        if (await initFirebase()) {
            alert('Koneksi Firebase Berhasil Disimpan!');
        }
    } catch (e) {
        alert('Format JSON tidak valid: ' + e.message + '\n\nPastikan Anda menempelkan kode Firebase Config dengan benar.');
    }
}

function setupAuthListener() {
    if (!auth) return;
    
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentFirebaseUser = user;
            document.getElementById('auth-overlay').style.display = 'none';
            document.getElementById('user-profile-bar').style.display = 'flex';
            
            // 1. Fetch user role and initial details from Firestore
            const userRef = db.collection('users').doc(user.uid);
            let userDoc = await userRef.get();
            
            if (!userDoc.exists) {
                const isFirstAccount = (user.email === ADMIN_EMAIL);
                userProfileRole = isFirstAccount ? 'admin' : 'user';
                
                await userRef.set({
                    uid: user.uid,
                    name: user.displayName || 'Trading User',
                    email: user.email,
                    role: userProfileRole,
                    initialCapital: 150000000.00,
                    currentCapital: 150000000.00,
                    createdAt: new Date().toISOString()
                });
                
                userDoc = await userRef.get();
            } else {
                userProfileRole = userDoc.data().role || 'user';
            }
            
            // Strict Override: If email matches ADMIN_EMAIL, force role to admin instantly!
            if (user.email === ADMIN_EMAIL) {
                userProfileRole = 'admin';
                userRef.set({ role: 'admin' }, { merge: true }).catch(e => console.error("Admin role update error:", e));
            }
            
            const userData = userDoc.exists ? userDoc.data() : {};
            
            // Update sidebar info
            document.getElementById('user-display-name').innerText = userData.name || user.displayName || 'Trading User';
            document.getElementById('user-display-email').innerText = 'Role: ' + userProfileRole.toUpperCase();
            document.getElementById('user-profile-avatar').src = userData.photoUrl || 'logo.jpg';
            
            // Show Admin Menu option if user is Admin
            if (userProfileRole === 'admin') {
                document.getElementById('menu-admin').style.display = 'flex';
                loadAdminUserList();
            } else {
                document.getElementById('menu-admin').style.display = 'none';
            }
            
            // Update local appState with Firestore data
            appState.initialCapital = userData.initialCapital || 150000000.00;
            appState.currentCapital = userData.currentCapital || 150000000.00;
            
            // 2. Listen in real-time to User's Trades
            subscribeToUserTrades(user.uid);
            
        } else {
            currentFirebaseUser = null;
            userProfileRole = 'user';
            appState = {
                initialCapital: 150000000.00,
                currentCapital: 150000000.00,
                trades: []
            };
            
            if (unsubscribeUserTrades) unsubscribeUserTrades();
            if (adminUnsubscribeSelectedUserTrades) adminUnsubscribeSelectedUserTrades();
            
            document.getElementById('auth-overlay').style.display = 'flex';
            document.getElementById('user-profile-bar').style.display = 'none';
            document.getElementById('menu-admin').style.display = 'none';
            
            switchTab('dashboard');
            renderAll();
        }
    });
}

function subscribeToUserTrades(userId) {
    if (unsubscribeUserTrades) unsubscribeUserTrades();
    
    const tradesRef = db.collection('users').doc(userId).collection('trades');
    
    unsubscribeUserTrades = tradesRef.orderBy('date', 'desc').onSnapshot((snapshot) => {
        const trades = [];
        snapshot.forEach((doc) => {
            const trade = doc.data();
            trade.firebaseId = doc.id; // Save doc ID for editing/deletion
            trades.push(trade);
        });
        
        appState.trades = trades;
        
        // Recalculate current capital dynamically based on trades list to ensure consistency across devices
        recalculateBalance();
        renderAll();
    }, (error) => {
        console.error("Error subscribing to trades:", error);
    });
}

function recalculateBalance() {
    let closedPnl = 0;
    appState.trades.forEach(t => {
        if (t.status === 'CLOSED') {
            closedPnl += parseFloat(t.actualPnl) || 0;
        }
    });
    appState.currentCapital = appState.initialCapital + closedPnl;
    updateSidebarBalance();
}

function setupAuthFormListeners() {
    const loginTabBtn = document.getElementById('tab-btn-login');
    const registerTabBtn = document.getElementById('tab-btn-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const errorMsgDiv = document.getElementById('auth-error-msg');
    
    // Auth Form toggles
    loginTabBtn.addEventListener('click', () => {
        loginTabBtn.classList.add('active');
        registerTabBtn.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
        errorMsgDiv.style.display = 'none';
    });
    
    registerTabBtn.addEventListener('click', () => {
        registerTabBtn.classList.add('active');
        loginTabBtn.classList.remove('active');
        registerForm.classList.add('active');
        loginForm.classList.remove('active');
        errorMsgDiv.style.display = 'none';
    });
    
    // Custom Username & Password Sign Up (Registration)
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsgDiv.style.display = 'none';
        
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        
        if (!username || !password) {
            errorMsgDiv.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Harap isi semua kolom wajib!';
            errorMsgDiv.style.display = 'block';
            return;
        }
        
        if (password.length < 6) {
            errorMsgDiv.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Password harus minimal 6 karakter!';
            errorMsgDiv.style.display = 'block';
            return;
        }
        
        if (password !== confirmPassword) {
            errorMsgDiv.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Konfirmasi password tidak cocok!';
            errorMsgDiv.style.display = 'block';
            return;
        }
        
        // Map username silently to email format for Firebase Auth
        const email = username.toLowerCase() + "@princeartha.com";
        
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Set Display Name in Firebase Auth Profile (Use Username)
            await user.updateProfile({
                displayName: username
            });
            
            // Create user document in Firestore
            const isFirstAccount = (email === ADMIN_EMAIL);
            userProfileRole = isFirstAccount ? 'admin' : 'user';
            
            const userRef = db.collection('users').doc(user.uid);
            await userRef.set({
                uid: user.uid,
                name: username,
                email: email,
                role: userProfileRole,
                reason: "Active User",
                initialCapital: 150000000.00,
                currentCapital: 150000000.00,
                createdAt: new Date().toISOString()
            });
            
            registerForm.reset();
            alert("Pendaftaran berhasil! Selamat datang di Prince Artha FX.");
            
        } catch (error) {
            console.error("Registration error:", error);
            let message = "Gagal mendaftar: " + error.message;
            if (error.code === 'auth/email-already-in-use') {
                message = "Username '" + username + "' sudah digunakan. Gunakan username lain.";
            } else if (error.code === 'auth/invalid-email') {
                message = "Format username tidak valid.";
            }
            errorMsgDiv.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;
            errorMsgDiv.style.display = 'block';
        }
    });
    
    // Custom Username & Password Log In (With Admin Auto-Seed feature)
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMsgDiv.style.display = 'none';
        
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        
        if (!username || !password) {
            errorMsgDiv.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Harap isi username dan password!';
            errorMsgDiv.style.display = 'block';
            return;
        }

        // Map username silently to email format for Firebase Auth
        const email = username.toLowerCase() + "@princeartha.com";
        
        try {
            await auth.signInWithEmailAndPassword(email, password);
            loginForm.reset();
        } catch (error) {
            console.error("Login error:", error);
            
            // Auto-seed Admin account if first time logging in with admin credentials
            const isAdminCredentials = (username.toLowerCase() === 'admin' && password === 'Mojokerto25#');
            if (isAdminCredentials && (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password')) {
                try {
                    errorMsgDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyiapkan akun admin perdana...';
                    errorMsgDiv.style.display = 'block';
                    
                    // Create Admin user in Firebase Auth
                    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                    const user = userCredential.user;
                    
                    // Update Profile name
                    await user.updateProfile({
                        displayName: "Admin"
                    });
                    
                    // Set admin document role in Firestore
                    const userRef = db.collection('users').doc(user.uid);
                    await userRef.set({
                        uid: user.uid,
                        name: "Admin",
                        email: email,
                        role: "admin",
                        reason: "Main Administrator",
                        initialCapital: 150000000.00,
                        currentCapital: 150000000.00,
                        createdAt: new Date().toISOString()
                    });
                    
                    alert("Akun Admin berhasil dibuat secara otomatis dan masuk!");
                    loginForm.reset();
                    errorMsgDiv.style.display = 'none';
                    return;
                } catch (createErr) {
                    console.error("Failed to auto-create admin account:", createErr);
                }
            }
            
            let message = `Gagal masuk: ${error.message} (Kode: ${error.code})`;
            errorMsgDiv.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${message}`;
            errorMsgDiv.style.display = 'block';
        }
    });
    
    // Log Out Button
    document.getElementById('btn-logout').addEventListener('click', async () => {
        if (confirm("Apakah Anda yakin ingin keluar dari akun?")) {
            try {
                await auth.signOut();
            } catch (error) {
                console.error("Logout error:", error);
            }
        }
    });
    
    // Firebase Modal Config triggers
    document.getElementById('btn-open-firebase-config').addEventListener('click', (e) => {
        e.preventDefault();
        console.log("Setup Firebase Database clicked!");
        const modal = document.getElementById('firebase-config-modal');
        console.log("Modal state before opening:", modal ? modal.style.display : "null");
        if (modal) {
            modal.style.display = 'flex';
            console.log("Modal state after opening:", modal.style.display);
        }
    });
    
    document.getElementById('btn-close-firebase-modal').addEventListener('click', () => {
        console.log("Close Firebase Config modal clicked!");
        document.getElementById('firebase-config-modal').style.display = 'none';
    });
    
    document.getElementById('btn-save-firebase-config').addEventListener('click', () => {
        console.log("Save Firebase Config clicked!");
        saveFirebaseConfig();
    });
    
    let uploadedPhotoBase64 = null;
    
    // Open Profile Modal
    document.getElementById('btn-open-profile-modal').addEventListener('click', () => {
        if (!currentFirebaseUser) return;
        document.getElementById('profile-edit-modal').style.display = 'flex';
        document.getElementById('profile-display-name-input').value = document.getElementById('user-display-name').innerText;
        document.getElementById('profile-preview-avatar').src = document.getElementById('user-profile-avatar').src;
        uploadedPhotoBase64 = null;
    });
    
    // Close Profile Modal
    document.getElementById('btn-close-profile-modal').addEventListener('click', () => {
        document.getElementById('profile-edit-modal').style.display = 'none';
    });
    
    // Compress and handle photo upload
    document.getElementById('profile-photo-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Resize using HTML5 canvas to keep Firestore document sizes tiny (< 25KB)
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 120;
                canvas.height = 120;
                
                // Square cropping & rendering
                const size = Math.min(img.width, img.height);
                const xOffset = (img.width - size) / 2;
                const yOffset = (img.height - size) / 2;
                ctx.drawImage(img, xOffset, yOffset, size, size, 0, 0, 120, 120);
                
                const compressed = canvas.toDataURL('image/jpeg', 0.8);
                document.getElementById('profile-preview-avatar').src = compressed;
                uploadedPhotoBase64 = compressed;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
    
    // Save Profile Changes
    document.getElementById('btn-save-profile-changes').addEventListener('click', async () => {
        if (!currentFirebaseUser) return;
        
        const newName = document.getElementById('profile-display-name-input').value.trim();
        if (!newName) {
            alert("Nama tampilan tidak boleh kosong!");
            return;
        }
        
        const saveBtn = document.getElementById('btn-save-profile-changes');
        const originalHtml = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...';
        
        try {
            const userRef = db.collection('users').doc(currentFirebaseUser.uid);
            const updates = { name: newName };
            if (uploadedPhotoBase64) {
                updates.photoUrl = uploadedPhotoBase64;
            }
            
            await userRef.set(updates, { merge: true });
            
            // Instantly update sidebar UI without waiting for auth state reload
            document.getElementById('user-display-name').innerText = newName;
            if (uploadedPhotoBase64) {
                document.getElementById('user-profile-avatar').src = uploadedPhotoBase64;
            }
            
            document.getElementById('profile-edit-modal').style.display = 'none';
            alert("Profil Anda berhasil diperbarui!");
        } catch (err) {
            console.error("Error saving profile changes:", err);
            alert("Gagal memperbarui profil: " + err.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalHtml;
        }
    });
}

// Admin Panel Functions
async function loadAdminUserList() {
    const listUl = document.getElementById('admin-users-list');
    if (!listUl) return;
    
    listUl.innerHTML = '<li class="text-muted text-center" style="font-size: 12px; padding: 12px;">Memuat pengguna...</li>';
    
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.get();
        listUl.innerHTML = '';
        
        let hasUsers = false;
        snapshot.forEach((doc) => {
            const user = doc.data();
            // Don't show the admin itself in the user list to monitor
            if (user.email === ADMIN_EMAIL) return;
            
            hasUsers = true;
            const li = document.createElement('li');
            li.className = 'admin-user-item';
            li.setAttribute('data-user-id', user.uid);
            li.innerHTML = `
                <div class="name">${user.name || 'User'}</div>
                <div class="email" style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden;" title="${user.reason || ''}">${user.reason || '-'}</div>
            `;
            
            li.addEventListener('click', () => {
                // Remove active class from previous items
                document.querySelectorAll('.admin-user-item').forEach(item => item.classList.remove('active'));
                li.classList.add('active');
                
                // Load details
                viewSelectedUserDashboard(user.uid);
            });
            
            listUl.appendChild(li);
        });
        
        if (!hasUsers) {
            listUl.innerHTML = '<li class="text-muted text-center" style="font-size: 12px; padding: 12px;">Belum ada pengguna terdaftar</li>';
        }
    } catch (e) {
        console.error("Error loading user list:", e);
        listUl.innerHTML = '<li class="text-danger text-center" style="font-size: 11px; padding: 12px;">Gagal memuat pengguna</li>';
    }
}

async function viewSelectedUserDashboard(userId) {
    if (adminUnsubscribeSelectedUserTrades) adminUnsubscribeSelectedUserTrades();
    
    // Show details layout
    document.getElementById('admin-empty-state').style.display = 'none';
    document.getElementById('admin-user-details').style.display = 'block';
    
    // Fetch profile info
    try {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            const user = userDoc.data();
            document.getElementById('admin-user-name').innerText = user.name || 'User';
            document.getElementById('admin-user-reason').innerText = `Alasan: ${user.reason || '-'}`;
            
            // Set up real-time listener to chosen user's trades
            const tradesRef = db.collection('users').doc(userId).collection('trades');
            
            adminUnsubscribeSelectedUserTrades = tradesRef.orderBy('date', 'desc').onSnapshot((snapshot) => {
                const trades = [];
                snapshot.forEach((d) => {
                    trades.push(d.data());
                });
                
                // Calculate metrics
                let initialCapital = user.initialCapital || 150000000.00;
                let closedPnl = 0;
                let winDays = 0;
                let lossDays = 0;
                
                trades.forEach(t => {
                    if (t.status === 'CLOSED') {
                        closedPnl += t.actualPnl;
                        if (t.actualPnl > 0) winDays++;
                        if (t.actualPnl < 0) lossDays++;
                    }
                });
                
                let currentCapital = initialCapital + closedPnl;
                let totalTrades = trades.length;
                let winRate = totalTrades > 0 ? Math.round((winDays / totalTrades) * 100) : 0;
                
                // Render text values
                document.getElementById('admin-initial-capital').innerText = `Rp ${Math.round(initialCapital).toLocaleString('id-ID')}`;
                document.getElementById('admin-current-capital').innerText = `Rp ${Math.round(currentCapital).toLocaleString('id-ID')}`;
                
                const netPnlEl = document.getElementById('admin-net-pnl');
                netPnlEl.innerText = `${closedPnl >= 0 ? '+' : ''}Rp ${Math.round(closedPnl).toLocaleString('id-ID')}`;
                netPnlEl.className = `value ${closedPnl >= 0 ? 'text-success' : 'text-danger'}`;
                
                document.getElementById('admin-stat-winrate').innerText = `${winRate}%`;
                document.getElementById('admin-stat-total-trades').innerText = totalTrades;
                document.getElementById('admin-stat-profit-days').innerText = winDays;
                document.getElementById('admin-stat-loss-days').innerText = lossDays;
                
                // Render read-only table logs
                const tbody = document.getElementById('admin-journal-tbody');
                tbody.innerHTML = '';
                
                if (trades.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: 24px;">Belum ada catatan jurnal dari pengguna ini.</td></tr>';
                } else {
                    trades.forEach(t => {
                        const tr = document.createElement('tr');
                        const dateObj = new Date(t.date);
                        const displayDate = `${dateObj.getDate()} ${MONTH_NAMES_ID[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
                        
                        tr.innerHTML = `
                            <td style="font-weight: 600;">${displayDate}</td>
                            <td>${DAY_NAMES_ID[t.day] || t.day}</td>
                            <td><span class="badge ${t.pair.toLowerCase()}">${t.pair}</span></td>
                            <td>
                                <span class="badge ${t.actualPnl >= 0 ? 'profit' : 'loss'}">
                                    ${t.actualPnl >= 0 ? 'PROFIT' : 'LOSS'}
                                </span>
                            </td>
                            <td class="${t.actualPnl >= 0 ? 'text-success' : 'text-danger'}" style="font-weight: 700;">
                                ${t.actualPnl >= 0 ? '+' : ''}Rp ${Math.round(t.actualPnl).toLocaleString('id-ID')}
                            </td>
                            <td style="max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${t.notes || ''}">
                                ${t.notes || '-'}
                            </td>
                        `;
                        tbody.appendChild(tr);
                    });
                }
                
                // Render mini equity chart for admin review
                renderAdminEquityChart(initialCapital, trades);
            });
        }
    } catch (e) {
        console.error("Error viewing user profile details:", e);
    }
}

function renderAdminEquityChart(initialCapital, trades) {
    const canvas = document.getElementById('adminEquityChart');
    if (!canvas) return;
    
    const closedTrades = trades
        .filter(t => t.status === 'CLOSED')
        .reverse();

    let dataPoints = [initialCapital];
    let labels = ['Awal'];

    let currentSum = initialCapital;
    closedTrades.forEach((t) => {
        currentSum += t.actualPnl;
        dataPoints.push(currentSum);
        
        const dateObj = new Date(t.date);
        labels.push(`${DAY_NAMES_ID[t.day] || t.day} ${dateObj.getDate()}/${dateObj.getMonth() + 1}`);
    });

    if (adminEquityChartInstance) {
        adminEquityChartInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    adminEquityChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Capital Balance (IDR)',
                data: dataPoints,
                borderColor: '#00d9ff',
                borderWidth: 2,
                backgroundColor: 'rgba(0, 217, 255, 0.04)',
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#00d9ff',
                pointBorderColor: '#050910',
                pointHoverRadius: 6,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { size: 9 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.4)', font: { size: 9 } }
                }
            }
        }
    });
}
