// static/js/admin/dashboard.js

// Import the new modular functions from the Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-functions.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";


// Helper function to get DOM elements
const $ = (selector) => document.querySelector(selector);

// --- Role Mapping ---
const ROLES = {
  100: 'Super Admin',
  80: 'Admin',
  50: 'Editor',
  30: 'Moderator',
  0: 'User'
};

// --- Panel Rendering Functions ---

function renderWelcome() {
  $('#admin-content-panel').innerHTML = `
    <h2 class="text-xl font-semibold">Welcome to the Admin Dashboard</h2>
    <p class="mt-2 text-gray-600">Please select a section from the menu to begin.</p>
  `;
}

function renderTownhallPanel() {
  $('#admin-content-panel').innerHTML = `
    <h2 class="text-xl font-semibold">Townhall Management</h2>
    <p class="mt-2 text-gray-600">Townhall management UI will be built here.</p>
  `;
}

function renderEventsPanel() {
  $('#admin-content-panel').innerHTML = `
    <h2 class="text-xl font-semibold">Event Management</h2>
    <p class="mt-2 text-gray-600">Event management UI will be built here.</p>
  `;
}

async function renderUsersPanel(currentUserRole) {
  const panel = $('#admin-content-panel');
  panel.innerHTML = `<h2 class="text-xl font-semibold">User Management</h2><p class="mt-2 text-gray-600">Loading users...</p>`;

  try {
    // Get a reference to the functions service using the new modular syntax
    const functions = getFunctions();
    const listUsers = httpsCallable(functions, 'listUsers');
    
    const result = await listUsers();
    const users = result.data.users;

    let tableRows = users.map(user => {
      const roleSelector = currentUserRole === 100
        ? `
          <select data-uid="${user.uid}" class="role-selector border border-gray-300 rounded p-1">
            <option value="100" ${user.roleLevel === 100 ? 'selected' : ''}>Super Admin</option>
            <option value="80" ${user.roleLevel === 80 ? 'selected' : ''}>Admin</option>
            <option value="50" ${user.roleLevel === 50 ? 'selected' : ''}>Editor</option>
            <option value="30" ${user.roleLevel === 30 ? 'selected' : ''}>Moderator</option>
            <option value="0" ${user.roleLevel === 0 ? 'selected' : ''}>User</option>
          </select>
        `
        : ROLES[user.roleLevel] || 'User';

      return `
        <tr>
          <td class="py-2 px-4 border-b">${user.displayName}</td>
          <td class="py-2 px-4 border-b">${user.email}</td>
          <td class="py-2 px-4 border-b">${roleSelector}</td>
          <td class="py-2 px-4 border-b">${user.disabled ? 'Yes' : 'No'}</td>
        </tr>
      `;
    }).join('');

    panel.innerHTML = `
      <h2 class="text-xl font-semibold mb-4">User Management</h2>
      <div class="overflow-x-auto">
        <table class="min-w-full bg-white">
          <thead>
            <tr>
              <th class="py-2 px-4 border-b text-left">Name</th>
              <th class="py-2 px-4 border-b text-left">Email</th>
              <th class="py-2 px-4 border-b text-left">Role</th>
              <th class="py-2 px-4 border-b text-left">Disabled</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      ${currentUserRole === 100 ? '<button id="save-roles-btn" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save Role Changes</button>' : ''}
      <p id="roles-status" class="mt-2 text-sm"></p>
    `;

    $('#save-roles-btn')?.addEventListener('click', handleSaveRoles);

  } catch (error) {
    console.error("Error rendering users panel:", error);
    panel.innerHTML = `<p class="text-red-500">Error loading users: ${error.message}</p>`;
  }
}

async function handleSaveRoles() {
    const statusEl = $('#roles-status');
    statusEl.textContent = 'Saving...';
    statusEl.classList.remove('text-red-500', 'text-green-500');

    const functions = getFunctions();
    const setUserRole = httpsCallable(functions, 'setUserRole');
    const roleSelectors = document.querySelectorAll('.role-selector');
    const promises = [];

    roleSelectors.forEach(selector => {
        const userId = selector.dataset.uid;
        const newRoleLevel = parseInt(selector.value, 10);
        promises.push(setUserRole({ userId, newRoleLevel }));
    });

    try {
        await Promise.all(promises);
        statusEl.textContent = 'Roles updated successfully!';
        statusEl.classList.add('text-green-500');
    } catch (error) {
        console.error("Error saving roles:", error);
        statusEl.textContent = `Error: ${error.message}`;
        statusEl.classList.add('text-red-500');
    }
}

function showPanel(panelId) {
  $('#admin-loading').classList.add('hidden');
  $('#admin-access-denied').classList.add('hidden');
  $('#admin-dashboard-ui').classList.add('hidden');

  if (panelId === 'loading') {
    $('#admin-loading').classList.remove('hidden');
  } else if (panelId === 'denied') {
    $('#admin-access-denied').classList.remove('hidden');
  } else if (panelId === 'ui') {
    $('#admin-dashboard-ui').classList.remove('hidden');
  }
}
function buildSidebar(roleLevel) {
  const sidebarList = $('#admin-sidebar ul');
  if (!sidebarList) return;

  sidebarList.innerHTML = '';
  let navLinks = [];

  if (roleLevel >= 30) {
    navLinks.push({ href: '#townhall', text: 'Townhall Management' });
  }
  if (roleLevel >= 50) {
    navLinks.push({ href: '#events', text: 'Event Management' });
  }
  if (roleLevel >= 80) {
    navLinks.push({ href: '#users', text: 'User Management' });
  }

  navLinks.forEach(link => {
    const li = document.createElement('li');
    li.innerHTML = `<a href="${link.href}" class="block px-3 py-2 rounded-md hover:bg-gray-100">${link.text}</a>`;
    sidebarList.appendChild(li);
  });
}
function handleRouting(currentUserRole) {
    const hash = window.location.hash || '#';
    console.log(`Routing to: ${hash}`);

    switch(hash) {
        case '#townhall':
            renderTownhallPanel();
            break;
        case '#events':
            renderEventsPanel();
            break;
        case '#users':
            renderUsersPanel(currentUserRole);
            break;
        default:
            renderWelcome();
            break;
    }
}
async function initializeDashboard(user) {
  try {
    const idTokenResult = await user.getIdTokenResult();
    const claims = idTokenResult.claims;
    const userRole = claims.roleLevel || 0;

    console.log(`Admin Dashboard: User role level is ${userRole}`);

    const MIN_ACCESS_LEVEL = 30;
    if (userRole < MIN_ACCESS_LEVEL) {
      showPanel('denied');
      setTimeout(() => { window.location.href = '/'; }, 3000);
      return;
    }

    buildSidebar(userRole);
    showPanel('ui');

    const routerWithRole = () => handleRouting(userRole);
    window.addEventListener('hashchange', routerWithRole);
    routerWithRole();

  } catch (error) {
    console.error("Error initializing admin dashboard:", error);
    showPanel('denied');
  }
}

// Main execution starts here
document.addEventListener('DOMContentLoaded', () => {
  // This assumes another script (firebase-config.js) has placed the config
  // object on the window. We call initializeApp safely here.
  const app = initializeApp(window.firebaseConfig);
  const functions = getFunctions(app);
  const auth = getAuth(app);

  if (window.location.hostname === 'localhost') {
      console.log('Using local function emulators on port 5001');
      // Use '127.0.0.1' instead of 'localhost' to avoid potential IPv6 issues
      connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }

  // Use the new modular onAuthStateChanged listener
  onAuthStateChanged(auth, user => {
    if (user) {
      initializeDashboard(user);
    } else {
      console.log("Admin Dashboard: No user logged in.");
      showPanel('denied');
      setTimeout(() => { window.location.href = '/'; }, 3000);
    }
  });
});
