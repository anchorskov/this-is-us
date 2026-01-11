/**
 * static/js/admin/hot-topics.js
 * 
 * Hot topics draft review and publishing UI module.
 * Handles:
 * - Listing draft topics with linked bills
 * - Expanding topics to see linked bills
 * - Viewing AI summaries in modals
 * - Editing topic metadata
 * - Approving/rejecting/publishing topics
 */

import { apiFetch } from "/js/lib/api.js";

const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => context.querySelectorAll(selector);
const API_PATH = "/admin/hot-topics";

/**
 * Toast notification system
 */
function showToast(message, type = 'info') {
  const toastContainer = $('#toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type} animate-slide-in`;
  toast.setAttribute('data-testid', 'toast');
  toast.setAttribute('data-type', type);
  toast.innerHTML = `
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'fixed top-4 right-4 z-50 space-y-2';
  container.setAttribute('data-testid', 'toast-container');
  document.body.appendChild(container);
  return container;
}

/**
 * Fetch draft topics from API
 */
async function fetchDraftTopics() {
  try {
    const response = await apiFetch(`${API_PATH}/drafts`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.drafts || [];
  } catch (err) {
    console.error('Error fetching drafts:', err);
    showToast(`Error loading drafts: ${err.message}`, 'error');
    return [];
  }
}

/**
 * Render draft topics table
 */
function renderTopicsTable(topics, container) {
  if (topics.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <p>No draft topics found</p>
      </div>
    `;
    return;
  }

  const renderActionButtons = (topic) => `
    ${topic.status === 'draft' ? `
      <button class="btn-edit px-2 py-1 text-gray-600 hover:text-gray-800 text-sm font-medium">
        Edit
      </button>
      <button class="btn-approve px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-sm font-medium">
        Approve
      </button>
      <button class="btn-reject px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm font-medium">
        Reject
      </button>
    ` : ''}
    ${topic.status === 'approved' ? `
      <button class="btn-publish px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm font-medium">
        Publish
      </button>
      <button class="btn-revert px-2 py-1 text-gray-600 hover:text-gray-800 text-sm font-medium">
        Revert
      </button>
    ` : ''}
  `;

  const statusColorMap = {
    draft: 'gray',
    approved: 'green',
    rejected: 'red',
    published: 'blue'
  };

  const html = `
    <div class="overflow-x-auto">
      <table class="w-full border-collapse" data-testid="draft-topics-table">
        <thead>
          <tr class="border-b-2 border-gray-300 bg-gray-50">
            <th class="text-left py-3 px-4 font-semibold">Title</th>
            <th class="text-center py-3 px-4 font-semibold">Status</th>
            <th class="text-center py-3 px-4 font-semibold">Bills</th>
            <th class="text-center py-3 px-4 font-semibold">Avg Confidence</th>
            <th class="text-center py-3 px-4 font-semibold">Created</th>
            <th class="text-right py-3 px-4 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${topics.map(topic => `
            <tr class="border-b border-gray-200 hover:bg-gray-50" data-testid="topic-row" data-topic-id="${topic.id}">
              <td class="py-3 px-4">
                <div class="font-medium" data-testid="topic-title">${escapeHtml(topic.title)}</div>
                <div class="text-sm text-gray-500">${escapeHtml(topic.slug)}</div>
                ${topic.officialUrl ? `
                  <div class="text-xs text-blue-600 mt-1">
                    <a href="${escapeHtml(topic.officialUrl)}" target="_blank" class="hover:underline">
                      📄 View Topic Doc
                    </a>
                  </div>
                ` : ''}
                <div class="mt-2 flex flex-wrap gap-2 md:hidden">
                  ${renderActionButtons(topic)}
                </div>
              </td>
              <td class="py-3 px-4 text-center">
                <span class="inline-block px-2 py-1 rounded text-sm font-medium bg-${statusColorMap[topic.status]}-100 text-${statusColorMap[topic.status]}-800">
                  ${topic.status}
                </span>
              </td>
              <td class="py-3 px-4 text-center font-medium">${topic.linkedBillCount}</td>
              <td class="py-3 px-4 text-center">
                <div class="text-sm font-medium">${(topic.avgConfidence * 100).toFixed(0)}%</div>
              </td>
              <td class="py-3 px-4 text-center text-sm text-gray-600">
                ${new Date(topic.createdAt).toLocaleDateString()}
              </td>
              <td class="py-3 px-4 text-right">
                <button class="btn-expand px-2 py-1 text-blue-600 hover:text-blue-800 text-sm font-medium" data-testid="btn-view">
                  View
                </button>
                <span class="hidden md:inline-flex md:ml-2 md:gap-2">
                  ${renderActionButtons(topic)}
                </span>
              </td>
            </tr>
            <tr class="hidden expansion" data-topic-id="${topic.id}">
              <td colspan="6" class="py-4 px-4 bg-gray-50">
                <div class="bill-details-container">Loading bill details...</div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;

  // Attach event listeners
  $$('.btn-expand', container).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const topicId = e.target.closest('tr').dataset.topicId;
      toggleTopicExpansion(topicId, topics, container);
    });
  });

  $$('.btn-approve', container).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const topicId = e.target.closest('tr').dataset.topicId;
      approveTopic(topicId);
    });
  });

  $$('.btn-reject', container).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const topicId = e.target.closest('tr').dataset.topicId;
      showRejectModal(topicId);
    });
  });

  $$('.btn-publish', container).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const topicId = e.target.closest('tr').dataset.topicId;
      publishTopic(topicId);
    });
  });

  $$('.btn-edit', container).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const topicId = e.target.closest('tr').dataset.topicId;
      const topic = topics.find(t => t.id === parseInt(topicId));
      showEditModal(topic);
    });
  });
}

/**
 * Toggle topic expansion to show linked bills
 */
function toggleTopicExpansion(topicId, topics, container) {
  const topic = topics.find(t => t.id === parseInt(topicId));
  if (!topic) return;

  const expansionRow = $(`.expansion[data-topic-id="${topicId}"]`, container);
  const isExpanded = !expansionRow.classList.contains('hidden');

  if (isExpanded) {
    expansionRow.classList.add('hidden');
  } else {
    expansionRow.classList.remove('hidden');
    renderBillDetails(topic, expansionRow);
  }
}

/**
 * Render linked bills for a topic
 */
function renderBillDetails(topic, container) {
  const detailsContainer = $('.bill-details-container', container);

  const billsHtml = topic.linkedBills.map((bill, idx) => `
    <div class="mb-4 p-4 border border-gray-300 rounded bg-white">
      <div class="flex justify-between items-start mb-2">
        <div>
          <h4 class="font-semibold text-gray-900">${escapeHtml(bill.billNumber)}</h4>
          <p class="text-gray-700">${escapeHtml(bill.title)}</p>
        </div>
        <div class="text-right text-sm">
          <div class="text-gray-600">Confidence: <span class="font-semibold">${(bill.confidence * 100).toFixed(0)}%</span></div>
          ${bill.officialUrl ? `
            <a href="${escapeHtml(bill.officialUrl)}" target="_blank" class="text-blue-600 hover:text-blue-800 text-sm block mt-2">
              Bill Text ↗
            </a>
          ` : ''}
        </div>
      </div>

      ${bill.aiSummary ? `
        <div class="my-3 p-3 bg-blue-50 rounded border border-blue-200">
          <strong class="text-blue-900 block mb-2">🤖 AI Summary:</strong>
          <p class="text-sm text-blue-800">${escapeHtml(bill.aiSummary)}</p>
        </div>
      ` : ''}

      ${bill.triggerSnippet ? `
        <div class="my-2 text-sm">
          <strong class="text-gray-700">Trigger Snippet:</strong>
          <p class="text-gray-600 italic">"${escapeHtml(bill.triggerSnippet)}"</p>
        </div>
      ` : ''}

      ${bill.reasonSummary ? `
        <div class="my-2 text-sm">
          <strong class="text-gray-700">Why it Matches:</strong>
          <p class="text-gray-600">${escapeHtml(bill.reasonSummary)}</p>
        </div>
      ` : ''}

      <div class="flex justify-end gap-2 mt-3 text-sm">
        <button class="btn-remove-bill px-2 py-1 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded" data-bill-id="${bill.civicItemId}">
          Remove
        </button>
      </div>
    </div>
  `).join('');

  detailsContainer.innerHTML = `
    <div class="space-y-4">
      <h3 class="font-semibold text-lg">Linked Bills (${topic.linkedBills.length})</h3>
      ${billsHtml}
    </div>
  `;
}

/**
 * Approve topic
 */
async function approveTopic(topicId, opts = {}) {
  try {
    const response = await apiFetch(`${API_PATH}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId: parseInt(topicId),
        reviewerName: opts.reviewerName || 'Admin User'
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    showToast('Topic approved!', 'success');
    if (opts.reload !== false) {
      reloadUI();
    }
    return true;
  } catch (err) {
    showToast(`Error approving topic: ${err.message}`, 'error');
    return false;
  }
}

/**
 * Show reject modal
 */
function showRejectModal(topicId) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <h3 class="text-lg font-semibold mb-4">Reject Topic</h3>
      <textarea id="reject-reason" class="w-full p-2 border border-gray-300 rounded mb-4" placeholder="Reason for rejection..."></textarea>
      <div class="flex justify-end gap-2">
        <button class="px-4 py-2 text-gray-600 hover:text-gray-900" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" onclick="submitRejectTopic(${topicId}, this)">Reject</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  $('#reject-reason', modal).focus();
}

/**
 * Submit topic rejection
 */
async function submitRejectTopic(topicId, btn) {
  const reason = $('#reject-reason').value;
  btn.disabled = true;

  try {
    const response = await apiFetch(`${API_PATH}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicId: parseInt(topicId),
        reason,
        invalidated: true,
        reviewerName: 'Admin User'
      })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    showToast('Topic rejected and invalidated', 'success');
    document.querySelector('.modal-overlay').remove();
    reloadUI();
  } catch (err) {
    showToast(`Error rejecting topic: ${err.message}`, 'error');
    btn.disabled = false;
  }
}

/**
 * Publish topic
 */
async function publishTopic(topicId, opts = {}) {
  if (!opts.skipConfirm && !confirm('Publish this topic to live?')) return;

  try {
    const response = await apiFetch(`${API_PATH}/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicIds: [parseInt(topicId)],
        publisherName: opts.publisherName || 'Admin User'
      })
    });

    const data = await response.json();
    if (data.errors?.length > 0) {
      showToast(`Error: ${data.errors[0].error}`, 'error');
      return false;
    } else {
      showToast('Topic published successfully!', 'success');
      if (opts.reload !== false) {
        reloadUI();
      }
      return true;
    }
  } catch (err) {
    showToast(`Error publishing topic: ${err.message}`, 'error');
    return false;
  }
}

/**
 * Show edit modal
 */
function showEditModal(topic) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.setAttribute('data-testid', 'edit-modal');
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 600px;">
      <h3 class="text-lg font-semibold mb-4">Edit Topic</h3>
      
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Title</label>
          <input type="text" id="edit-title" data-testid="field-title" class="w-full p-2 border border-gray-300 rounded" value="${escapeHtml(topic.title)}">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Slug</label>
          <input type="text" id="edit-slug" class="w-full p-2 border border-gray-300 rounded" value="${escapeHtml(topic.slug)}">
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Summary</label>
          <textarea id="edit-summary" data-testid="field-summary" class="w-full p-2 border border-gray-300 rounded" rows="3">${escapeHtml(topic.summary || '')}</textarea>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Priority</label>
          <select id="edit-priority" data-testid="field-priority" class="w-full p-2 border border-gray-300 rounded">
            <option value="low" ${topic.priority === 'low' ? 'selected' : ''}>Low</option>
            <option value="medium" ${topic.priority === 'medium' ? 'selected' : ''}>Medium</option>
            <option value="high" ${topic.priority === 'high' ? 'selected' : ''}>High</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Official URL (PDF/Document Link)</label>
          <input type="url" id="edit-official-url" data-testid="field-official-url" class="w-full p-2 border border-gray-300 rounded" placeholder="https://example.com/document.pdf" value="${escapeHtml(topic.officialUrl || '')}">
        </div>

        <div class="flex items-center gap-2">
          <input type="checkbox" id="edit-invalidated" data-testid="field-invalidated" class="h-4 w-4" ${topic.invalidated ? "checked" : ""}>
          <label for="edit-invalidated" class="text-sm font-medium text-gray-700">Invalidate (hide from public)</label>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-6">
        <button class="px-4 py-2 text-gray-600 hover:text-gray-900" data-testid="btn-cancel" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
        <button class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" data-testid="btn-save" onclick="submitEditTopic(${topic.id}, this, { publish: false })">Save Changes</button>
        <button class="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700" data-testid="btn-save-publish" onclick="submitEditTopic(${topic.id}, this, { publish: true, status: '${topic.status}' })">Save & Publish</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

/**
 * Submit topic edits
 */
async function submitEditTopic(topicId, btn, opts = {}) {
  btn.disabled = true;

  try {
    const priorityValue = $('#edit-priority').value;
    const payload = {
      title: $('#edit-title').value,
      slug: $('#edit-slug').value,
      summary: $('#edit-summary').value,
      priority: priorityValue,
      officialUrl: $('#edit-official-url').value || null,
      invalidated: $('#edit-invalidated')?.checked || false
    };
    const response = await apiFetch(`${API_PATH}/drafts/${topicId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    showToast('Topic saved!', 'success');

    if (opts.publish) {
      const reviewerName = window.currentUser?.email || 'Admin User';
      if (opts.status !== 'approved') {
        const approved = await approveTopic(topicId, { reload: false, reviewerName });
        if (!approved) {
          btn.disabled = false;
          return;
        }
      }
      const published = await publishTopic(topicId, { skipConfirm: true, publisherName: reviewerName, reload: false });
      if (!published) {
        btn.disabled = false;
        return;
      }
    }

    document.querySelector('.modal-overlay').remove();
    reloadUI();
  } catch (err) {
    showToast(`Error saving topic: ${err.message}`, 'error');
    btn.disabled = false;
  }
}

/**
 * Reload the UI with fresh data
 */
async function reloadUI() {
  const container = document.getElementById('hot-topics-container');
  if (container) {
    await loadHotTopicsUI(container);
  }
}

/**
 * HTML escape helper
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Main entry point: Load and render the hot topics UI
 */
export async function loadHotTopicsUI(container) {
  // Add styles
  if (!document.getElementById('hot-topics-styles')) {
    const style = document.createElement('style');
    style.id = 'hot-topics-styles';
    style.textContent = `
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .modal-content {
        background: white;
        padding: 2rem;
        border-radius: 0.5rem;
        max-width: 800px;
        max-height: 90vh;
        overflow-y-auto;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
      }

      .toast {
        background: white;
        padding: 1rem;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .toast-error {
        border-left: 4px solid #dc2626;
        color: #dc2626;
      }

      .toast-success {
        border-left: 4px solid #16a34a;
        color: #16a34a;
      }

      .toast-info {
        border-left: 4px solid #2563eb;
        color: #2563eb;
      }

      .toast-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 1.5rem;
        line-height: 1;
        opacity: 0.7;
      }

      .toast-close:hover {
        opacity: 1;
      }

      .animate-slide-in {
        animation: slideIn 0.3s ease-out;
      }

      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .expansion.hidden {
        display: none;
      }

      .bill-details-container {
        font-size: 0.875rem;
      }

      .bg-gray-100 { background-color: #f3f4f6; }
      .bg-gray-200 { background-color: #e5e7eb; }
      .text-gray-700 { color: #374151; }
      .text-green-700 { color: #15803d; }
      .bg-green-100 { background-color: #dcfce7; }
      .bg-green-200 { background-color: #bbf7d0; }
      .text-red-700 { color: #b91c1c; }
      .bg-red-100 { background-color: #fee2e2; }
      .bg-red-200 { background-color: #fecaca; }
      .text-blue-700 { color: #1d4ed8; }
      .bg-blue-100 { background-color: #dbeafe; }
      .bg-blue-200 { background-color: #bfdbfe; }
    `;
    document.head.appendChild(style);
  }

  // Fetch and render topics
  const topics = await fetchDraftTopics();
  renderTopicsTable(topics, container);
}
