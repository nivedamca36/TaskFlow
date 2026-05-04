/* =============================================
   TASKFLOW — script.js
   Central logic for all pages
   ============================================= */

'use strict';

// ─── STORAGE HELPERS ──────────────────────────
const STORAGE_KEY = 'taskflow_tasks';

function getTasks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── CORE TASK FUNCTIONS ──────────────────────

function addTask(text, date = '', time = '') {
  if (!text || !text.trim()) {
    showToast('Please enter a task!', 'error');
    return false;
  }
  const tasks = getTasks();
  const newTask = {
    id: generateId(),
    text: text.trim(),
    date: date || '',
    time: time || '',
    completed: false,
    createdAt: new Date().toISOString()
  };
  tasks.unshift(newTask);
  saveTasks(tasks);
  showToast('Task added!', 'success');
  return true;
}

function deleteTask(id) {
  const tasks = getTasks().filter(t => t.id !== id);
  saveTasks(tasks);
  showToast('Task deleted.', 'info');
}

function toggleTask(id) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    saveTasks(tasks);
    return task.completed;
  }
  return false;
}

// ─── TASK STATUS HELPERS ──────────────────────

function getTaskStatus(task) {
  if (!task.date) return 'no-reminder';
  const reminderDT = getReminderDateTime(task);
  if (!reminderDT) return 'no-reminder';
  const now = new Date();
  const diff = reminderDT - now;
  if (diff < 0) return 'overdue';
  if (diff < 60 * 60 * 1000) return 'soon';   // within 1 hour
  if (diff < 24 * 60 * 60 * 1000) return 'today'; // within 24 hours
  return 'upcoming';
}

function getReminderDateTime(task) {
  if (!task.date) return null;
  const dateStr = task.time ? `${task.date}T${task.time}` : `${task.date}T00:00`;
  const dt = new Date(dateStr);
  return isNaN(dt.getTime()) ? null : dt;
}

function formatDateTime(task) {
  const dt = getReminderDateTime(task);
  if (!dt) return task.date || '';
  const dateOpts = { month: 'short', day: 'numeric', year: 'numeric' };
  const timeOpts = { hour: '2-digit', minute: '2-digit' };
  const dateStr = dt.toLocaleDateString('en-US', dateOpts);
  const timeStr = task.time ? ` · ${dt.toLocaleTimeString('en-US', timeOpts)}` : '';
  return dateStr + timeStr;
}

function formatTimeRemaining(task) {
  const dt = getReminderDateTime(task);
  if (!dt) return '';
  const diff = dt - new Date();
  if (diff < 0) {
    const absDiff = Math.abs(diff);
    const h = Math.floor(absDiff / 3600000);
    const d = Math.floor(h / 24);
    if (d > 0) return `Overdue by ${d}d ${h % 24}h`;
    if (h > 0) return `Overdue by ${h}h`;
    return 'Just overdue';
  }
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(h / 24);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `In ${d}d ${h % 24}h`;
  if (h > 0) return `In ${h}h ${m}m`;
  return `In ${m}m`;
}

// ─── RENDER FUNCTIONS ─────────────────────────

function renderTasks(filterType = 'all') {
  const container = document.getElementById('task-list');
  const countEl = document.getElementById('tasks-count');
  if (!container) return;

  let tasks = getTasks().filter(t => !t.completed);

  if (filterType === 'with-reminder') {
    tasks = tasks.filter(t => t.date);
  } else if (filterType === 'no-reminder') {
    tasks = tasks.filter(t => !t.date);
  }

  if (countEl) countEl.textContent = tasks.length;

  if (tasks.length === 0) {
    container.innerHTML = buildEmptyState(
      filterType === 'all' ? '📝' : '🔍',
      filterType === 'all' ? 'No tasks yet' : 'No tasks match this filter',
      filterType === 'all' ? 'Add a task above to get started.' : 'Try a different filter.'
    );
    return;
  }

  container.innerHTML = tasks.map(task => buildTaskItem(task)).join('');
  attachTaskListeners(container);
}

function renderCompletedTasks() {
  const container = document.getElementById('completed-list');
  const countEl = document.getElementById('completed-count');
  if (!container) return;

  const tasks = getTasks().filter(t => t.completed);
  if (countEl) countEl.textContent = tasks.length;

  if (tasks.length === 0) {
    container.innerHTML = buildEmptyState(
      '🎉',
      'No completed tasks yet',
      'Complete some tasks and they will appear here.'
    );
    return;
  }

  container.innerHTML = tasks.map(task => buildCompletedItem(task)).join('');
  attachTaskListeners(container);
}

function renderReminders() {
  const container = document.getElementById('reminders-list');
  const countEl = document.getElementById('reminders-count');
  if (!container) return;

  const allTasks = getTasks().filter(t => !t.completed && t.date);
  const overdueList = [];
  const upcomingList = [];

  allTasks.forEach(task => {
    const status = getTaskStatus(task);
    if (status === 'overdue') overdueList.push(task);
    else upcomingList.push({ ...task, _status: status });
  });

  // Sort upcoming by date
  upcomingList.sort((a, b) => {
    const da = getReminderDateTime(a) || 0;
    const db = getReminderDateTime(b) || 0;
    return da - db;
  });
  overdueList.sort((a, b) => {
    const da = getReminderDateTime(a) || 0;
    const db = getReminderDateTime(b) || 0;
    return db - da;
  });

  const total = overdueList.length + upcomingList.length;
  if (countEl) countEl.textContent = total;

  if (total === 0) {
    container.innerHTML = buildEmptyState(
      '🔔',
      'No reminders set',
      'Add a date/time to any task to create a reminder.'
    );
    return;
  }

  let html = '';

  if (overdueList.length > 0) {
    html += `<div class="section-title" style="margin-bottom:12px;">⚠️ Overdue (${overdueList.length})</div>`;
    html += overdueList.map(task => buildReminderItem(task, 'overdue')).join('');
  }

  if (upcomingList.length > 0) {
    if (overdueList.length > 0) html += '<div style="margin:24px 0;"></div>';
    html += `<div class="section-title" style="margin-bottom:12px;">⏰ Upcoming (${upcomingList.length})</div>`;
    html += upcomingList.map(task => buildReminderItem(task, task._status)).join('');
  }

  container.innerHTML = html;
  attachTaskListeners(container);
}

// ─── ITEM BUILDERS ────────────────────────────

function buildTaskItem(task) {
  const status = getTaskStatus(task);
  const statusClass = status === 'overdue' ? 'overdue' : (status === 'soon' || status === 'today' ? 'upcoming' : '');
  const badgeHtml = buildBadge(task, status);

  return `
  <div class="task-item ${statusClass}" data-id="${task.id}">
    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-action="toggle" data-id="${task.id}">
    <div class="task-body">
      <div class="task-text">${escapeHtml(task.text)}</div>
      <div class="task-meta">
        ${badgeHtml}
      </div>
    </div>
    <div class="task-actions">
      <button class="btn btn-danger btn-icon btn-sm" data-action="delete" data-id="${task.id}" title="Delete task">🗑</button>
    </div>
  </div>`;
}

function buildCompletedItem(task) {
  const completedAt = task.completedAt
    ? new Date(task.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';

  return `
  <div class="task-item completed" data-id="${task.id}">
    <input type="checkbox" class="task-checkbox" checked data-action="toggle" data-id="${task.id}">
    <div class="task-body">
      <div class="task-text">${escapeHtml(task.text)}</div>
      <div class="task-meta">
        <span class="task-badge badge-done">✓ Completed${completedAt ? ' · ' + completedAt : ''}</span>
        ${task.date ? `<span class="task-badge badge-reminder">🗓 ${formatDateTime(task)}</span>` : ''}
      </div>
    </div>
    <div class="task-actions">
      <button class="btn btn-ghost btn-sm" data-action="toggle" data-id="${task.id}" title="Restore task">↩ Restore</button>
      <button class="btn btn-danger btn-icon btn-sm" data-action="delete" data-id="${task.id}" title="Delete task">🗑</button>
    </div>
  </div>`;
}

function buildReminderItem(task, status) {
  const dt = getReminderDateTime(task);
  const time = dt ? (task.time ? dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'All day') : '';
  const date = dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const remaining = formatTimeRemaining(task);
  const remainingClass = status === 'overdue' ? 'overdue' : (status === 'soon' ? 'soon' : '');

  return `
  <div class="reminder-item ${status === 'overdue' ? 'overdue' : ''} task-item-wrapper" data-id="${task.id}" style="display:flex;align-items:flex-start;gap:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin-bottom:10px;transition:all 0.2s;">
    <div class="reminder-time-block">
      <span class="time">${time}</span>
      <span class="date">${date}</span>
    </div>
    <div class="reminder-body" style="flex:1;">
      <div class="task-text" style="font-size:15px;font-weight:500;">${escapeHtml(task.text)}</div>
      <div class="task-meta" style="margin-top:6px;">
        ${status === 'overdue'
          ? '<span class="task-badge badge-overdue">⚠️ Overdue</span>'
          : status === 'soon'
          ? '<span class="task-badge badge-upcoming">🔥 Due soon</span>'
          : '<span class="task-badge badge-reminder">🔔 Upcoming</span>'
        }
        ${remaining ? `<span class="time-remaining ${remainingClass}">${remaining}</span>` : ''}
      </div>
    </div>
    <div class="task-actions" style="opacity:1;">
      <button class="btn btn-success btn-sm" data-action="toggle" data-id="${task.id}">✓ Done</button>
      <button class="btn btn-danger btn-icon btn-sm" data-action="delete" data-id="${task.id}">🗑</button>
    </div>
  </div>`;
}

function buildBadge(task, status) {
  if (!task.date) return '';
  const dateStr = formatDateTime(task);
  let cls = 'badge-reminder';
  let icon = '🗓';
  if (status === 'overdue') { cls = 'badge-overdue'; icon = '⚠️'; }
  else if (status === 'soon' || status === 'today') { cls = 'badge-upcoming'; icon = '🔔'; }
  return `<span class="task-badge ${cls}">${icon} ${dateStr}</span>`;
}

function buildEmptyState(icon, title, message) {
  return `
  <div class="empty-state">
    <div class="empty-state-icon">${icon}</div>
    <h3>${title}</h3>
    <p>${message}</p>
  </div>`;
}

// ─── EVENT DELEGATION ─────────────────────────

function attachTaskListeners(container) {
  container.addEventListener('click', handleTaskAction, { capture: false });
  container.addEventListener('change', handleTaskAction, { capture: false });
}

function handleTaskAction(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const id = el.dataset.id;
  if (!id) return;

  if (action === 'delete') {
    deleteTask(id);
    refreshCurrentPage();
  } else if (action === 'toggle') {
    const completed = toggleTask(id);
    showToast(completed ? 'Task completed! 🎉' : 'Task restored.', 'success');
    refreshCurrentPage();
  }
}

function refreshCurrentPage() {
  const path = window.location.pathname;
  if (path.includes('completed')) renderCompletedTasks();
  else if (path.includes('reminders')) renderReminders();
  else if (path.includes('tasks')) renderTasks(window._currentFilter || 'all');
  updateHomeStats();
}

// ─── FORM HANDLING (tasks.html) ───────────────

function initTaskForm() {
  const form = document.getElementById('task-form');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const textInput = document.getElementById('task-input');
    const dateInput = document.getElementById('task-date');
    const timeInput = document.getElementById('task-time');
    const success = addTask(
      textInput.value,
      dateInput ? dateInput.value : '',
      timeInput ? timeInput.value : ''
    );
    if (success) {
      textInput.value = '';
      if (dateInput) dateInput.value = '';
      if (timeInput) timeInput.value = '';
      textInput.focus();
      renderTasks(window._currentFilter || 'all');
    }
  });
}

// ─── FILTER BAR ───────────────────────────────

function initFilterBar() {
  const bar = document.querySelector('.filter-bar');
  if (!bar) return;
  bar.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    window._currentFilter = btn.dataset.filter || 'all';
    renderTasks(window._currentFilter);
  });
}

// ─── HOME STATS ───────────────────────────────

function updateHomeStats() {
  const tasks = getTasks();
  const totalEl = document.getElementById('stat-total');
  const completedEl = document.getElementById('stat-completed');
  const reminderEl = document.getElementById('stat-reminders');
  if (totalEl) totalEl.textContent = tasks.filter(t => !t.completed).length;
  if (completedEl) completedEl.textContent = tasks.filter(t => t.completed).length;
  if (reminderEl) {
    const now = new Date();
    reminderEl.textContent = tasks.filter(t => {
      if (t.completed || !t.date) return false;
      const dt = getReminderDateTime(t);
      return dt && dt > now;
    }).length;
  }
}

// ─── TOAST NOTIFICATIONS ──────────────────────

function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fadeout');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ─── NAVBAR ACTIVE STATE ──────────────────────

function setNavActive() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

// ─── SIDEBAR NAV ──────────────────────────────

function injectSidebar() {
  // Only inject on mobile (sidebar is handled via HTML too, but we build it dynamically)
  if (document.getElementById('taskflow-sidebar')) return;

  const path = window.location.pathname.split('/').pop() || 'index.html';

  const links = [
    { href: 'index.html',     icon: '🏠', label: 'Home' },
    { href: 'tasks.html',     icon: '📝', label: 'Tasks' },
    { href: 'completed.html', icon: '✅', label: 'Completed' },
    { href: 'reminders.html', icon: '🔔', label: 'Reminders' },
    { href: 'about.html',     icon: '💡', label: 'About' },
    { href: 'contact.html',   icon: '📬', label: 'Contact' },
  ];

  const linksHtml = links.map(l => `
    <a href="${l.href}" class="sidebar-link${l.href === path ? ' active' : ''}">
      <span class="sidebar-link-icon">${l.icon}</span>
      <span>${l.label}</span>
    </a>
  `).join('');

  const overlay = document.createElement('div');
  overlay.id = 'sidebar-overlay';
  overlay.className = 'sidebar-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const sidebar = document.createElement('aside');
  sidebar.id = 'taskflow-sidebar';
  sidebar.className = 'sidebar';
  sidebar.setAttribute('aria-label', 'Navigation');
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <a href="index.html" class="sidebar-brand">
        <div class="sidebar-brand-icon">⚡</div>
        <span class="sidebar-brand-text">Task<span>Flow</span></span>
      </a>
      <button class="sidebar-close" id="sidebar-close-btn" aria-label="Close menu">✕</button>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-nav-label">Navigation</div>
      ${linksHtml}
    </nav>
    <div class="sidebar-footer">
      TaskFlow · All data stored locally
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(sidebar);

  // Bind close button
  document.getElementById('sidebar-close-btn').addEventListener('click', closeSidebar);
  overlay.addEventListener('click', closeSidebar);

  // Close on link click
  sidebar.querySelectorAll('.sidebar-link').forEach(a => {
    a.addEventListener('click', closeSidebar);
  });
}

function openSidebar() {
  const overlay = document.getElementById('sidebar-overlay');
  const sidebar = document.getElementById('taskflow-sidebar');
  const hamburger = document.getElementById('hamburger');
  if (!overlay || !sidebar) return;
  overlay.classList.add('open');
  sidebar.classList.add('open');
  hamburger && hamburger.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  const overlay = document.getElementById('sidebar-overlay');
  const sidebar = document.getElementById('taskflow-sidebar');
  const hamburger = document.getElementById('hamburger');
  if (!overlay || !sidebar) return;
  overlay.classList.remove('open');
  sidebar.classList.remove('open');
  hamburger && hamburger.classList.remove('active');
  document.body.style.overflow = '';
}

function initHamburger() {
  const btn = document.getElementById('hamburger');
  if (!btn) return;
  injectSidebar();
  btn.addEventListener('click', () => {
    const sidebar = document.getElementById('taskflow-sidebar');
    if (sidebar && sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });
  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSidebar();
  });
}

// ─── CLEAR COMPLETED ──────────────────────────

function clearCompleted() {
  const tasks = getTasks().filter(t => !t.completed);
  saveTasks(tasks);
  showToast('Cleared all completed tasks.', 'info');
  renderCompletedTasks();
}

// ─── UTILITY ──────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── INIT ─────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  setNavActive();
  initHamburger();
  initTaskForm();
  initFilterBar();
  updateHomeStats();

  // Page-specific renders
  const path = window.location.pathname;
  if (path.includes('tasks')) renderTasks('all');
  if (path.includes('completed')) renderCompletedTasks();
  if (path.includes('reminders')) renderReminders();

  // Refresh reminders every minute
  if (path.includes('reminders')) {
    setInterval(renderReminders, 60000);
  }

  // Clear completed button
  const clearBtn = document.getElementById('clear-completed-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearCompleted);
  }
});
