import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDPz1BPnN7Xan09WgdA6UVKk9gjU0DGiKs",
    authDomain: "stash-tracke.firebaseapp.com",
    projectId: "stash-tracke",
    storageBucket: "stash-tracke.firebasestorage.app",
    messagingSenderId: "187196565090",
    appId: "1:187196565090:web:347de41a82978f17d5933b",
    measurementId: "G-DPLQWMGNLC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let state = {
    total: 0,
    saved: 0,
    goal: 5000,
    buckets: [],
    history: []
};

let statsChartInstance = null;
let showAllHistoryLogs = false;

const AUTH_LOGIN_FILE = 'dashboard.html'; 

// --- RESTORE ACCENT ON LOAD FROM LOCALSTORAGE ---
const savedAccent = localStorage.getItem('stash_active_accent');
if (savedAccent) {
    document.documentElement.style.setProperty('--accent-brand-color', savedAccent);
}

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = AUTH_LOGIN_FILE;
    } else {
        currentUser = user;
        await loadUserData(user.uid);
    }
});

async function loadUserData(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            state = docSnap.data();
            state.buckets = state.buckets || [];
            state.history = state.history || [];
        } else {
            state = { total: 0, saved: 0, goal: 5000, buckets: [], history: [] };
            await setDoc(docRef, state);
        }
        window.updateAllUI();
    } catch (e) {
        console.error("Database structural validation failure:", e);
    }
}

async function saveUserData() {
    if (!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid);
        await setDoc(docRef, state);
    } catch (e) {
        console.error("Database tracking persist intercept failure:", e);
    }
}

window.logOutUser = async () => {
    if(confirm("Are you sure you want to log out of STASH?")) {
        await signOut(auth);
        window.location.href = AUTH_LOGIN_FILE;
    }
};

let computedTaxSum = 0;
let computedInterestSum = 0;
let interestContextLabel = '';

window.navigateTo = function(pageId) {
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    const navEl = document.getElementById('nav-' + pageId);
    if (navEl) navEl.classList.add('active');
    
    document.querySelectorAll('.page-content').forEach(page => page.classList.remove('active'));
    const pageEl = document.getElementById('page-' + pageId);
    if (pageEl) pageEl.classList.add('active');
}

window.addItem = function() {
    const nameInput = document.getElementById('new-name');
    const amtInput = document.getElementById('new-amount');
    const name = nameInput.value.trim();
    const amt = parseFloat(amtInput.value);
    
    if(!name || isNaN(amt) || amt <= 0) {
        alert("Please enter a valid expense name and positive amount.");
        return;
    }

    state.total -= amt;
    const entry = { id: Date.now(), type: 'Expense', name: name, amount: amt, date: new Date().toLocaleDateString() };
    state.history.unshift(entry);
    window.updateAllUI();
    saveUserData();
    nameInput.value = '';
    amtInput.value = '';
}

window.depositFunds = function() {
    const amtInput = document.getElementById('deposit-amt');
    const amt = parseFloat(amtInput.value);
    
    if(isNaN(amt) || amt <= 0) {
        alert("Please enter a valid positive deposit amount.");
        return;
    }

    state.total += amt;
    state.history.unshift({ id: Date.now(), type: 'Deposit', name: 'Income Deposit', amount: amt, date: new Date().toLocaleDateString() });
    window.updateAllUI();
    saveUserData();
    amtInput.value = '';
}

window.addFundsToSavings = function() {
    const amt = parseFloat(prompt("Enter amount to transfer from available funds to savings:"));
    if(isNaN(amt) || amt <= 0) {
        if (!isNaN(amt)) alert("Please enter a positive transaction amount.");
        return;
    }
    if(amt > state.total) {
        alert("Insufficient available funds to complete this transfer.");
        return;
    }

    state.total -= amt;
    state.saved += amt;
    state.history.unshift({ id: Date.now(), type: 'SavingsTransfer', name: 'Transfer to Savings', amount: amt, date: new Date().toLocaleString() });
    window.updateAllUI();
    saveUserData();
}

window.updateGoalValue = function() {
    const valInput = document.getElementById('new-goal-input');
    const val = parseFloat(valInput.value);
    if(isNaN(val) || val < 0) {
        alert("Please provide a clean, positive target savings goal.");
        return;
    }

    state.goal = val;
    state.history.unshift({ id: Date.now(), type: 'ManualUpdate', name: 'Goal Set to $' + val, amount: val, date: new Date().toLocaleString() });
    window.updateAllUI();
    saveUserData();
    valInput.value = '';
}

window.updateSavedValue = function() {
    const valInput = document.getElementById('new-saved-input');
    const val = parseFloat(valInput.value);
    if(isNaN(val) || val < 0) {
        alert("Please provide a clean, positive baseline savings asset value.");
        return;
    }

    state.saved = val;
    state.history.unshift({ id: Date.now(), type: 'ManualUpdate', name: 'Saved Amount Set to $' + val, amount: val, date: new Date().toLocaleString() });
    window.updateAllUI();
    saveUserData();
    valInput.value = '';
}

window.createSavingsBucket = function() {
    const name = document.getElementById('new-bucket-name').value.trim();
    const amt = parseFloat(document.getElementById('new-bucket-amount').value);

    if(!name || isNaN(amt) || amt <= 0) {
        alert("Please input a structural name and positive dollar share amount.");
        return;
    }
    if(amt > state.saved) {
        alert("Insufficient pool balance. You cannot allocate more than your general Saved pool threshold.");
        return;
    }

    state.saved -= amt; 
    state.buckets.push({ id: Date.now(), name: name, amount: amt });
    state.history.unshift({ id: Date.now(), type: 'ManualUpdate', name: `Created Savings Bucket: ${name}`, amount: amt, date: new Date().toLocaleDateString() });
    
    document.getElementById('new-bucket-name').value = '';
    document.getElementById('new-bucket-amount').value = '';
    window.updateAllUI();
    saveUserData();
}

window.deleteSavingsBucket = function(id) {
    const targetBucket = state.buckets.find(b => b.id === id);
    if(targetBucket) {
        state.saved += targetBucket.amount; 
        state.history.unshift({ id: Date.now(), type: 'ManualUpdate', name: `Dissolved Bucket Refund: ${targetBucket.name}`, amount: targetBucket.amount, date: new Date().toLocaleDateString() });
        state.buckets = state.buckets.filter(b => b.id !== id);
        window.updateAllUI();
        saveUserData();
    }
}

window.toggleInterestView = function(view) {
    document.getElementById('interest-decision-box').style.display = 'none';
    if(view === 'calc') {
        document.getElementById('btn-show-interest-calc').style.background = '#1a1a1a';
        document.getElementById('btn-show-interest-manual').style.background = '#757575';
        document.getElementById('interest-calc-area').style.display = 'block';
        document.getElementById('interest-manual-area').style.display = 'none';
    } else {
        document.getElementById('btn-show-interest-calc').style.background = '#757575';
        document.getElementById('btn-show-interest-manual').style.background = '#1a1a1a';
        document.getElementById('interest-calc-area').style.display = 'none';
        document.getElementById('interest-manual-area').style.display = 'block';
    }
}

window.runInterestCalculation = function() {
    const apy = parseFloat(document.getElementById('interest-rate-input').value);
    const cycle = parseInt(document.getElementById('interest-period-select').value);

    if(isNaN(apy) || apy <= 0) {
        alert("Please assign a valid interest asset rate percentage.");
        return;
    }
    if(state.saved <= 0) {
        alert("Your snapshot savings yield pool calculation is currently sitting at $0.00.");
        return;
    }

    const frequencyRate = (apy / 100) / cycle;
    computedInterestSum = state.saved * frequencyRate;
    const layoutText = cycle === 12 ? 'Monthly' : 'Annual';
    interestContextLabel = `${layoutText} Interest Accumulation (${apy}% APY)`;

    document.getElementById('interest-output-msg').innerHTML = `Calculated Earnings: <strong>$${computedInterestSum.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong> via ${layoutText} compound parameters.`;
    document.getElementById('interest-decision-box').style.display = 'block';
}

window.runManualInterestCalculation = function() {
    const manualVal = parseFloat(document.getElementById('interest-manual-input').value);
    if(!isNaN(manualVal) && manualVal > 0) {
        computedInterestSum = manualVal;
        interestContextLabel = 'Manual Interest Adjustment Entry';
        document.getElementById('interest-output-msg').innerHTML = `Calculated Earnings: <strong>$${computedInterestSum.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</strong> via fixed allocation parameter manual entries.`;
        document.getElementById('interest-decision-box').style.display = 'block';
    }
}

window.commitInterestYield = function() {
    if(computedInterestSum > 0) {
        state.saved += computedInterestSum;
        state.history.unshift({ id: Date.now(), type: 'InterestYield', name: interestContextLabel, amount: computedInterestSum, date: new Date().toLocaleDateString() });
        window.clearInterestSimulationView();
        window.updateAllUI();
        saveUserData();
    }
}

window.clearInterestSimulationView = function() {
    computedInterestSum = 0;
    interestContextLabel = '';
    document.getElementById('interest-decision-box').style.display = 'none';
    document.getElementById('interest-manual-input').value = '';
}

window.toggleTaxView = function(view) {
    document.getElementById('tax-decision-box').style.display = 'none';
    if(view === 'calc') {
        document.getElementById('btn-show-calc').style.background = '#1a1a1a';
        document.getElementById('btn-show-manual').style.background = '#757575';
        document.getElementById('tax-calc-area').style.display = 'block';
        document.getElementById('tax-manual-area').style.display = 'none';
    } else {
        document.getElementById('btn-show-calc').style.background = '#757575';
        document.getElementById('btn-show-manual').style.background = '#1a1a1a';
        document.getElementById('tax-calc-area').style.display = 'none';
        document.getElementById('tax-manual-area').style.display = 'block';
    }
}

window.runBracketCalculation = function() {
    const rate = parseFloat(document.getElementById('tax-bracket-select').value);
    if(!rate) {
        alert("Please select a tax bracket context.");
        return;
    }
    if(state.total <= 0) {
        alert("Your Available Funds pool must be above $0.00 to process bracket reductions.");
        return;
    }
    computedTaxSum = state.total * rate;
    document.getElementById('tax-output-msg').innerHTML = `Calculated Obligation: <strong>$${computedTaxSum.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</strong> (${rate * 100}% of available liquidity).`;
    document.getElementById('tax-decision-box').style.display = 'block';
}

window.commitTaxDeduction = function() {
    if(computedTaxSum > 0) {
        state.total -= computedTaxSum;
        state.history.unshift({ id: Date.now(), type: 'TaxWithholding', name: 'Withholding Tax Payment Allocation', amount: computedTaxSum, date: new Date().toLocaleDateString() });
        window.clearTaxBracketView();
        window.updateAllUI();
        saveUserData();
    }
}

window.commitManualTaxDeduction = function() {
    const amtInput = document.getElementById('tax-manual-input');
    const amt = parseFloat(amtInput.value);
    if(!isNaN(amt) && amt > 0) {
        state.total -= amt;
        state.history.unshift({ id: Date.now(), type: 'TaxWithholding', name: 'Withholding Tax Payment Allocation (Manual)', amount: amt, date: new Date().toLocaleDateString() });
        amtInput.value = '';
        window.updateAllUI();
        saveUserData();
    } else {
        alert("Please enter a valid, positive tax withholding figure.");
    }
}

window.clearTaxBracketView = function() {
    computedTaxSum = 0;
    document.getElementById('tax-decision-box').style.display = 'none';
    document.getElementById('tax-bracket-select').value = '';
}

window.deleteLogEntry = function(id) {
    if(confirm("Are you sure you want to delete this log entry? This will reverse its financial impact on your balances.")) {
        const entryIndex = state.history.findIndex(item => item.id === id);
        if (entryIndex !== -1) {
            const item = state.history[entryIndex];
            
            if (item.type === 'Expense') {
                state.total += item.amount;
            } else if (item.type === 'Deposit') {
                state.total -= item.amount;
            } else if (item.type === 'SavingsTransfer') {
                state.total += item.amount;
                state.saved -= item.amount;
            } else if (item.type === 'InterestYield') {
                state.saved -= item.amount;
            } else if (item.type === 'TaxWithholding') {
                state.total += item.amount;
            }

            state.history.splice(entryIndex, 1);
            window.updateAllUI();
            saveUserData();
        }
    }
}

window.toggleHistoryViewLimit = function() {
    showAllHistoryLogs = !showAllHistoryLogs;
    window.updateAllUI();
}

window.toggleAppTheme = function() {
    const currentTheme = document.body.getAttribute('data-theme');
    if (currentTheme === 'light') {
        document.body.removeAttribute('data-theme');
    } else {
        document.body.setAttribute('data-theme', 'light');
    }
}

window.changeWebsiteColorAccent = function(hexColorCode) {
    if(/^#[0-9A-F]{6}$/i.test(hexColorCode)) {
        document.documentElement.style.setProperty('--accent-brand-color', hexColorCode);
        localStorage.setItem('stash_active_accent', hexColorCode);
    } else {
        console.warn("Invalid hexadecimal structural configuration parameter passed.");
    }
}

window.quickDeposit = function(amount) {
    if (typeof amount !== 'number' || amount <= 0) return;
    state.total += amount;
    state.history.unshift({ id: Date.now(), type: 'Deposit', name: `Micro-Deposit (+$${amount})`, amount: amount, date: new Date().toLocaleDateString() });
    window.updateAllUI();
    saveUserData();
}

window.exportLedgerToCSV = function() {
    if (!state.history || state.history.length === 0) {
        alert("There are no history records in your ledger to export.");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,Type,Name,Amount,Date\n";
    state.history.forEach(item => {
        const sanitizedName = item.name.replace(/,/g, " "); 
        csvContent += `${item.type},${sanitizedName},${item.amount},${item.date}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `STASH_Financial_Ledger_${new Date().toLocaleDateString().replace(/\//g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- DYNAMIC CUSTOM ACCENT COLOR MEMORY STORAGE HANDLERS ---
let savedCustomColors = JSON.parse(localStorage.getItem('stash_saved_colors')) || [];

window.saveCustomAccentColor = function() {
    const currentPickerVal = document.getElementById('custom-accent-picker').value;
    
    if (!savedCustomColors.includes(currentPickerVal)) {
        if (savedCustomColors.length >= 5) {
            savedCustomColors.shift();
        }
        savedCustomColors.push(currentPickerVal);
        localStorage.setItem('stash_saved_colors', JSON.stringify(savedCustomColors));
        window.changeWebsiteColorAccent(currentPickerVal);
        window.renderSavedColorSwatches();
    }
};

window.renderSavedColorSwatches = function() {
    const container = document.getElementById('custom-saved-slots');
    if (!container) return;
    
    container.innerHTML = '';
    savedCustomColors.forEach(color => {
        const dot = document.createElement('div');
        dot.className = 'color-swatch-dot';
        dot.style.background = color;
        dot.style.border = '1px solid var(--text-muted)';
        dot.onclick = () => window.changeWebsiteColorAccent(color);
        container.appendChild(dot);
    });
};

window.renderStatsChart = function() {
    const chartEl = document.getElementById('statsChart');
    if (!chartEl) return;
    
    const ctx = chartEl.getContext('2d');
    if (statsChartInstance) {
        statsChartInstance.destroy();
    }
    statsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Available', 'Saved'],
            datasets: [{
                data: [state.total, state.saved],
                backgroundColor: ['#1a1a1a', '#757575'],
                borderRadius: 6,
                borderWidth: 0,
                barThickness: 24
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#262626' }, ticks: { font: { size: 10 } } },
                x: { grid: { display: false }, ticks: { font: { size: 11, weight: '600' } } }
            }
        }
    });
}

window.updateAllUI = function() {
    const displayTotal = document.getElementById('display-total');
    let formattedTotal = '$' + state.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    if (displayTotal) {
        displayTotal.innerText = formattedTotal;
        
        // Dynamic typography scaling safety check: 
        // Reduces text slightly for large figures to keep the circle footprint perfect.
        if (formattedTotal.length > 10) {
            displayTotal.style.fontSize = "1.95rem";
        } else if (formattedTotal.length > 8) {
            displayTotal.style.fontSize = "2.2rem";
        } else {
            displayTotal.style.fontSize = "2.5rem";
        }
    }
    
    const savedText = document.getElementById('saved-text');
    if (savedText) savedText.innerText = '$' + state.saved.toLocaleString(undefined, {minimumFractionDigits: 0});
    
    const goalText = document.getElementById('goal-text');
    if (goalText) goalText.innerText = '$' + state.goal.toLocaleString(undefined, {minimumFractionDigits: 0});

    let pct = state.goal > 0 ? (state.saved / state.goal) * 100 : 0;
    const progressEl = document.getElementById('savings-progress');
    if (progressEl) progressEl.style.width = Math.min(pct, 100) + '%';

    const targetRingCircumference = 624; 
    const progressCircleEl = document.querySelector('.progress-ring__circle');
    if (progressCircleEl) {
        const boundedPercentage = Math.min(Math.max(pct, 0), 100);
        const offsetCalculation = targetRingCircumference - (boundedPercentage / 100) * targetRingCircumference;
        progressCircleEl.style.strokeDasharray = `${targetRingCircumference}`;
        progressCircleEl.style.strokeDashoffset = `${offsetCalculation}`;
        
        const percentageTextEl = document.getElementById('ring-percentage-label');
        if (percentageTextEl) percentageTextEl.innerText = `${Math.round(pct)}% of Goal`;
    }

    const tbody = document.getElementById('expense-table-body');
    if (tbody) {
        tbody.innerHTML = '';
        const expensesList = state.history.filter(item => item.type === 'Expense');
        
        if (expensesList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#757575; padding:20px; font-style:italic;">No expenses tracked yet. Use the fields above to add your first transaction.</td></tr>`;
        } else {
            expensesList.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>📉 Expense</td><td>${item.name}</td><td>$${item.amount.toFixed(2)}</td><td>${item.date}</td><td>-</td>`;
                tbody.appendChild(tr);
            });
        }
    }

    let totalBucketAllocations = state.buckets.reduce((acc, b) => acc + b.amount, 0);
    const leftOverPool = state.saved; 
    const poolEl = document.getElementById('bucket-pool-available');
    if (poolEl) poolEl.innerText = leftOverPool.toLocaleString(undefined, {minimumFractionDigits: 2});

    const bucketsTbody = document.getElementById('buckets-table-body');
    if (bucketsTbody) {
        bucketsTbody.innerHTML = '';
        if (state.buckets.length === 0) {
            bucketsTbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#757575; padding:20px; font-style:italic;">No active sub-savings buckets found. Allocate a goal portion above.</td></tr>`;
        } else {
            state.buckets.forEach(b => {
                const tr = document.createElement('tr');
                tr.innerHTML = `<td>📂 ${b.name}</td><td><strong>$${b.amount.toLocaleString()}</strong></td><td><button class="action-btn" onclick="deleteSavingsBucket(${b.id})">Release Allocation</button></td>`;
                bucketsTbody.appendChild(tr);
            });
        }
    }

    const reportBody = document.getElementById('report-log-body');
    if (reportBody) {
        reportBody.innerHTML = '';
        
        if (state.history.length === 0) {
            reportBody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#757575; padding:20px; font-style:italic;">Modification ledger empty. Financial updates will construct logs here.</td></tr>`;
        } else {
            const visibleLogs = showAllHistoryLogs ? state.history : state.history.slice(0, 20);
            
            visibleLogs.forEach(item => {
                const tr = document.createElement('tr');
                const itemId = item.id || Date.now();
                
                let colorStyle = 'color: var(--text-main);'; 
                let prefixes = '';
                if(item.type === 'Expense' || item.type === 'TaxWithholding') {
                    colorStyle = 'color: #cc0000; font-weight: 500;';
                    prefixes = '-';
                } else if(item.type === 'Deposit' || item.type === 'InterestYield') {
                    colorStyle = 'color: #2e7d32; font-weight: 500;';
                    prefixes = '+';
                }

                tr.innerHTML = `
                    <td>${item.type} - ${item.name}</td>
                    <td style="${colorStyle}">${prefixes}$${item.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    <td>${item.date}</td>
                    <td><button class="action-btn" style="background:#cc0000; color:white; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;" onclick="deleteLogEntry(${itemId})">Delete</button></td>
                `;
                reportBody.appendChild(tr);
            });
        }

        const toggleButtonEl = document.getElementById('show-more-btn');
        if (toggleButtonEl) {
            if (state.history.length <= 20) {
                toggleButtonEl.style.display = 'none';
            } else {
                toggleButtonEl.style.display = 'inline-block';
                toggleButtonEl.innerText = showAllHistoryLogs ? 'Show Less (Limit View)' : `Show All History (${state.history.length} Logs)`;
                toggleButtonEl.onclick = window.toggleHistoryViewLimit;
            }
        }
    }

    window.renderSavedColorSwatches();
    window.renderStatsChart();
}