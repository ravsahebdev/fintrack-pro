// localStorage keys
const USERS_KEY = 'fintrack_users';
const SESSION_KEY = 'fintrack_session';
const DARKMODE_KEY = 'fintrack_darkmode';

// currency format ke liye
const CURRENCY_LOCALES = {
    INR: 'en-IN',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    JPY: 'ja-JP'
};

// app state
let currentUser = null;
let userProfile = { fullName: '', currency: 'USD' };
let transactions = [];
let currentFilter = 'all';
let searchQuery = '';
let selectedType = 'income';
let cashFlowChart = null;

// har user ka transaction data alag save hoga
function getTransactionKey(username) {
    return `fintrack_transactions_${username}`;
}

// localStorage functions
function loadUsers() {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function findUser(username) {
    return loadUsers().find(u => u.username.toLowerCase() === username.toLowerCase());
}

function loadTransactions(username) {
    const raw = localStorage.getItem(getTransactionKey(username));
    return raw ? JSON.parse(raw) : [];
}

function saveTransactions() {
    localStorage.setItem(getTransactionKey(currentUser), JSON.stringify(transactions));
    // console.log(transactions);
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    modal.classList.remove('hidden');

    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    const cleanup = () => {
        modal.classList.add('hidden');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
    };
    const onOk = () => { cleanup(); onConfirm(); };
    const onCancel = () => cleanup();

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
}

// login / register
function showAuthPage(page) {
    const loginPage = document.getElementById('loginPage');
    const registerPage = document.getElementById('registerPage');
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('registerError').style.display = 'none';
    if (page === 'register') {
        loginPage.classList.add('hidden');
        registerPage.classList.remove('hidden');
    } else {
        registerPage.classList.add('hidden');
        loginPage.classList.remove('hidden');
    }
}

function registerUser() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;
    const errorEl = document.getElementById('registerError');

    if (!username || !password) {
        errorEl.textContent = 'Please fill both fields.';
        errorEl.style.display = 'block';
        return;
    }

    const users = loadUsers();
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        errorEl.textContent = 'That username is already taken.';
        errorEl.style.display = 'block';
        return;
    }

    users.push({
        username,
        password,
        profile: {
            fullName: username,
            currency: 'USD'
        }
    });
    saveUsers(users);

    showAuthPage('login');
    document.getElementById('loginUsername').value = username;
    document.getElementById('loginPassword').value = '';
}

function loginUser() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    const user = findUser(username);
    if (!user || user.password !== password) {
        errorEl.textContent = 'Invalid username or password.';
        errorEl.style.display = 'block';
        return;
    }
    errorEl.style.display = 'none';

    localStorage.setItem(SESSION_KEY, user.username);
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('registerPage').classList.add('hidden');
    document.getElementById('appWrap').classList.remove('hidden');
    bootApp(user.username);
}

function logoutUser() {
    localStorage.removeItem(SESSION_KEY);
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('appWrap').classList.add('hidden');
    document.getElementById('registerPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
}

// refresh ke baad session check
function checkSession() {
    const username = localStorage.getItem(SESSION_KEY);
    if (username && findUser(username)) {
        document.getElementById('loginPage').classList.add('hidden');
        document.getElementById('registerPage').classList.add('hidden');
        document.getElementById('appWrap').classList.remove('hidden');
        bootApp(username);
    }
}

function showPage(page) {
    const dashboard = document.getElementById('dashboardPage');
    const settingsPage = document.getElementById('settingsPage');
    const navDashboard = document.getElementById('navDashboard');
    const navSettings = document.getElementById('navSettings');

    const isDashboard = page === 'dashboard';
    dashboard.classList.toggle('hidden', !isDashboard);
    settingsPage.classList.toggle('hidden', isDashboard);
    navDashboard.classList.toggle('active', isDashboard);

    navSettings.classList.toggle('active', !isDashboard);
}

// dashboard calculations
function calculateTotals() {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
        if (t.type === 'income') income += t.amount;
        else expense += t.amount;
    });
    return { income, expense, balance: income - expense };
}

function formatAmount(amount) {
    const currency = userProfile.currency || 'USD';
    const locale = CURRENCY_LOCALES[currency] || 'en-US';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
}

// number ko chhote se count-up animation ke saath set karta hai
function animateValue(el, from, to, formatter, duration = 550) {
    const start = performance.now();
    const step = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = formatter(from + (to - from) * eased);
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

function renderCards() {
    const totals = calculateTotals();
    const prevCount = Number(document.getElementById('cardCount').textContent) || 0;

    animateValue(document.getElementById('cardBalance'), 0, totals.balance, formatAmount);
    animateValue(document.getElementById('cardIncome'), 0, totals.income, formatAmount);
    animateValue(document.getElementById('cardExpense'), 0, totals.expense, formatAmount);
    animateValue(document.getElementById('cardCount'), prevCount, transactions.length, v => Math.round(v).toString());
}

// search aur filter
function getFilteredTransactions() {
    let list = transactions;
    if (currentFilter !== 'all') {
        list = list.filter(t => t.type === currentFilter);
    }
    if (searchQuery.trim() !== '') {
        const q = searchQuery.trim().toLowerCase();
        list = list.filter(t => t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    }
    return list;
}

function renderTable() {
    const tbody = document.getElementById('transactionTableBody');
    tbody.innerHTML = '';

    const list = getFilteredTransactions().slice().sort((a, b) => new Date(b.date) - new Date(a.date));

    if (list.length === 0) {
        const row = document.createElement('tr');
        row.className = 'empty-row';
        row.innerHTML = '<td colspan="5">No transactions to show yet. Click "Add Transaction" to get started.</td>';
        tbody.appendChild(row);
        return;
    }

    list.forEach(t => {
        const row = document.createElement('tr');
        const sign = t.type === 'income' ? '+' : '-';

        const dateCell = document.createElement('td');
        dateCell.dataset.label = 'Date';
        dateCell.textContent = formatDate(t.date);

        const descCell = document.createElement('td');
        descCell.dataset.label = 'Description';
        descCell.textContent = t.description;

        const catCell = document.createElement('td');
        catCell.dataset.label = 'Category';
        const pill = document.createElement('span');
        
        pill.className = 'category-pill';
        pill.textContent = t.category;
        catCell.appendChild(pill);

        const amountCell = document.createElement('td');
        amountCell.dataset.label = 'Amount';
        amountCell.className = `amount-cell ${t.type}`;
        amountCell.textContent = `${sign} ${formatAmount(t.amount)}`;

        const actionCell = document.createElement('td');
        actionCell.dataset.label = '';
        const delBtn = document.createElement('button');

        delBtn.className = 'delete-btn';
        delBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7H20M9 7V4.5A1.5 1.5 0 0 1 10.5 3H13.5A1.5 1.5 0 0 1 15 4.5V7M18 7L17.3 19A2 2 0 0 1 15.3 21H8.7A2 2 0 0 1 6.7 19L6 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Delete';
        delBtn.dataset.id = t.id;
        actionCell.appendChild(delBtn);

        row.append(dateCell, descCell, catCell, amountCell, actionCell);
        tbody.appendChild(row);
    });
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

// same date ki transactions chart ke liye combine
function buildDailyTotals() {
    const byDate = new Map();
    transactions.forEach(t => {
        if (!byDate.has(t.date)) byDate.set(t.date, { income: 0, expense: 0 });
        byDate.get(t.date)[t.type] += t.amount;
    });
    return [...byDate.entries()].sort((a, b) => new Date(a[0]) - new Date(b[0]));
}

// chart create ya update
function updateChart() {
    const ctx = document.getElementById('cashFlowChart').getContext('2d');
    const daily = buildDailyTotals();
    const labels = daily.map(([date]) => formatDate(date));
    const incomeData = daily.map(([, totals]) => totals.income);
    const expenseData = daily.map(([, totals]) => totals.expense);
    const isDark = document.body.classList.contains('dark');
    // console.log(daily);

    if (cashFlowChart) {
        cashFlowChart.data.labels = labels.length ? labels : ['No data'];
        cashFlowChart.data.datasets[0].data = incomeData.length ? incomeData : [0];
        cashFlowChart.data.datasets[1].data = expenseData.length ? expenseData : [0];

        cashFlowChart.options.plugins.legend.labels.color = isDark ? '#e2e8f0' : '#1e2130';
        cashFlowChart.options.scales.x.ticks.color = isDark ? '#94a3b8' : '#6b7280';
        cashFlowChart.options.scales.x.grid.color = isDark ? '#334155' : '#e5e7eb';
        cashFlowChart.options.scales.y.ticks.color = isDark ? '#94a3b8' : '#6b7280';
        cashFlowChart.options.scales.y.grid.color = isDark ? '#334155' : '#e5e7eb';
        cashFlowChart.update();
        return;
    }

    cashFlowChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length ? labels : ['No data'],
            datasets: [
                {
                    label: 'Income',
                    data: incomeData.length ? incomeData : [0],
                    backgroundColor: '#16a34a',
                    borderRadius: 4
                },
                {
                    label: 'Expenses',
                    data: expenseData.length ? expenseData : [0],
                    backgroundColor: '#8b0000',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: isDark ? '#e2e8f0' : '#1e2130' } } },
            scales: {
                x: { ticks: { color: isDark ? '#94a3b8' : '#6b7280' }, grid: { color: isDark ? '#334155' : '#e5e7eb' } },
                y: { ticks: { color: isDark ? '#94a3b8' : '#6b7280' }, grid: { color: isDark ? '#334155' : '#e5e7eb' } }
            }
        }
    });
}

function renderDashboard() {
    renderCards();
    renderTable();
    updateChart();
}

// transaction modal
function openTransactionModal() {
    document.getElementById('addModal').classList.remove('hidden');
    document.getElementById('txnDescription').value = '';
    document.getElementById('txnAmount').value = '';

    document.getElementById('txnDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('txnCategory').selectedIndex = 0;

    document.getElementById('formError').style.display = 'none';
    setTransactionType('income');
}

function closeTransactionModal() {
    document.getElementById('addModal').classList.add('hidden');
}

function handleModalBackdropClick(e) {
    if (e.target.id === 'addModal') closeTransactionModal();
}

function setTransactionType(type) {
    selectedType = type;

    document.getElementById('typeIncomeBtn').classList.toggle('active-income', type === 'income');
    document.getElementById('typeExpenseBtn').classList.toggle('active-expense', type === 'expense');
}

function addTransaction() {
    const description = document.getElementById('txnDescription').value.trim();
    const amount = parseFloat(document.getElementById('txnAmount').value);
    const date = document.getElementById('txnDate').value;
    const category = document.getElementById('txnCategory').value;
    const errorEl = document.getElementById('formError');

    if (!description || !amount || amount <= 0 || !date || !category) {
        errorEl.style.display = 'block';
        return;
    }
    errorEl.style.display = 'none';

    transactions.push({
        id: Date.now(),
        type: selectedType,
        description,
        amount,
        date,
        category
    });
    saveTransactions();
    closeTransactionModal();
    renderDashboard();
    showToast('Transaction added');
}

function removeTransaction(id) {
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();
    renderDashboard();
}

// profile and theme settings
function saveProfile() {
    userProfile.fullName = document.getElementById('settingsName').value.trim();
    userProfile.currency = document.getElementById('settingsCurrency').value;

    const users = loadUsers();
    const user = users.find(u => u.username === currentUser);
    if (user) {
        user.profile = userProfile;
        saveUsers(users);
    }

    document.getElementById('userChip').textContent = userProfile.fullName || currentUser;
    renderDashboard();
    showToast('Profile updated successfully');
}

function toggleDarkMode() {
    const checked = document.getElementById('darkModeToggle').checked;
    document.body.classList.toggle('dark', checked);

    localStorage.setItem(DARKMODE_KEY, checked ? 'true' : 'false');
    updateChart();
}

function resetTransactions() {
    showConfirm(
        'Reset all data?',
        'This will permanently delete all your transactions. This cannot be undone.',
        () => {
            transactions = [];
            saveTransactions();
            renderDashboard();
            showToast('All transactions cleared');
        }
    );
}

function handleSearchInput() {
    searchQuery = document.getElementById('searchInput').value;
    renderTable();
}

function handleTypeFilterChange() {
    currentFilter = document.getElementById('typeFilterSelect').value;
    renderTable();
}

// login ke baad user data load
function bootApp(username) {
    currentUser = username;
    const user = findUser(username);
    userProfile = user.profile || { fullName: username, currency: 'USD' };

    transactions = loadTransactions(username);

    document.getElementById('settingsName').value = userProfile.fullName || '';
    document.getElementById('settingsCurrency').value = userProfile.currency || 'USD';
    document.getElementById('userChip').textContent = userProfile.fullName || username;

    const darkMode = localStorage.getItem(DARKMODE_KEY) === 'true';
    document.getElementById('darkModeToggle').checked = darkMode;
    document.body.classList.toggle('dark', darkMode);

    showPage('dashboard');
    renderDashboard();
}

// event listeners
function bindEvents() {
    document.getElementById('loginSubmitBtn').addEventListener('click', loginUser);
    document.getElementById('registerSubmitBtn').addEventListener('click', registerUser);

    document.getElementById('goToRegisterLink').addEventListener('click', e => { e.preventDefault(); showAuthPage('register'); });
    document.getElementById('goToLoginLink').addEventListener('click', e => { e.preventDefault(); showAuthPage('login'); });

    document.getElementById('navDashboard').addEventListener('click', () => showPage('dashboard'));
    document.getElementById('navSettings').addEventListener('click', () => showPage('settings'));

    document.getElementById('logoutBtn').addEventListener('click', logoutUser);

    document.getElementById('openAddTransactionBtn').addEventListener('click', openTransactionModal);
    document.getElementById('closeModalBtn').addEventListener('click', closeTransactionModal);
    document.getElementById('addModal').addEventListener('click', handleModalBackdropClick);
    document.getElementById('typeIncomeBtn').addEventListener('click', () => setTransactionType('income'));

    document.getElementById('typeExpenseBtn').addEventListener('click', () => setTransactionType('expense'));
    document.getElementById('saveTransactionBtn').addEventListener('click', addTransaction);

    document.getElementById('transactionTableBody').addEventListener('click', e => {
        const btn = e.target.closest('.delete-btn');
        if (btn) removeTransaction(Number(btn.dataset.id));
    });

    document.getElementById('searchInput').addEventListener('input', handleSearchInput);
    document.getElementById('typeFilterSelect').addEventListener('change', handleTypeFilterChange);

    document.getElementById('darkModeToggle').addEventListener('change', toggleDarkMode);
    document.getElementById('resetDataBtn').addEventListener('click', resetTransactions);
    document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
}

document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    checkSession();
});