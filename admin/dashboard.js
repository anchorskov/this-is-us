// static/js/admin/dashboard.js

// Helper function to get DOM elements
const $ = (selector) => document.querySelector(selector);

// Minimum role level required to access the admin dashboard at all
const MIN_ACCESS_LEVEL = 30; // Moderator

// --- Panel Rendering Functions (Placeholders for now) ---

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

function renderUsersPanel() {
  $('#admin-content-panel').innerHTML = `
    <h2 class="text-xl font-semibold">User Management</h2>
    <p class="mt-2 text-gray-600">User management UI will be built here.</p>
  `;
}


/**
 * Hides all main panels and then shows the specified one.
 * @param {string} panelId The ID of the panel to show ('loading', 'denied', 'ui')
 */
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

/**
 * Builds the sidebar navigation links based on the user's role level.
 * @param {number} roleLevel The user's role level from custom claims.
 */
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

/**
 * Simple hash-based router to show content based on the URL fragment.
 */
function handleRouting() {
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
            renderUsersPanel();
            break;
        default:
            renderWelcome();
            break;
    }
}


/**
 * Initializes the admin dashboard.
 * @param {object} user The authenticated Firebase user object.
 */
async function initializeDashboard(user) {
  try {
    const idTokenResult = await user.getIdTokenResult();
    const claims = idTokenResult.claims;
    const userRole = claims.roleLevel || 0;

    console.log(`Admin Dashboard: User role level is ${userRole}`);

    if (userRole < MIN_ACCESS_LEVEL) {
      showPanel('denied');
      setTimeout(() => { window.location.href = '/'; }, 3000);
      return;
    }

    buildSidebar(userRole);
    showPanel('ui');

    // Set up the router
    window.addEventListener('hashchange', handleRouting);
    handleRouting(); // Initial call to render the correct panel on page load

  } catch (error) {
    console.error("Error initializing admin dashboard:", error);
    showPanel('denied');
  }
}

// Main execution starts here
document.addEventListener('DOMContentLoaded', () => {
  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      initializeDashboard(user);
    } else {
      console.log("Admin Dashboard: No user logged in.");
      showPanel('denied');
      setTimeout(() => { window.location.href = '/'; }, 3000);
    }
  });
});
