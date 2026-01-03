const stateKey = 'freelancer-time-tracker-v1';

const projectForm = document.getElementById('project-form');
const projectList = document.getElementById('project-list');
const manualEntryForm = document.getElementById('manual-entry-form');
const manualProjectSelect = manualEntryForm.querySelector('select[name="manualProject"]');
const filterProject = document.getElementById('filter-project');
const filterRange = document.getElementById('filter-range');
const entryList = document.getElementById('entry-list');
const emptyState = document.getElementById('empty-state');
const activeProjectLabel = document.getElementById('active-project');
const timerDisplay = document.getElementById('timer-display');
const timerHint = document.getElementById('timer-hint');
const stopTimerButton = document.getElementById('stop-timer');
const addNoteButton = document.getElementById('add-note');
const noteDialog = document.getElementById('note-dialog');
const noteForm = document.getElementById('note-form');
const exportButton = document.getElementById('export-csv');
const clearButton = document.getElementById('clear-data');
const summaryToday = document.getElementById('summary-today');
const summaryWeek = document.getElementById('summary-week');
const summaryMonth = document.getElementById('summary-month');
const summaryTodayBillable = document.getElementById('summary-today-billable');
const summaryWeekBillable = document.getElementById('summary-week-billable');
const summaryMonthBillable = document.getElementById('summary-month-billable');

const defaultState = {
  projects: [],
  entries: [],
  timer: {
    runningEntryId: null,
    startedAt: null,
  },
};

let state = loadState();
let tickInterval = null;

function loadState() {
  try {
    const saved = localStorage.getItem(stateKey);
    if (!saved) return structuredClone(defaultState);
    const parsed = JSON.parse(saved);
    return {
      ...structuredClone(defaultState),
      ...parsed,
    };
  } catch (error) {
    console.warn('Unable to load saved data', error);
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(stateKey, JSON.stringify(state));
}

function createId(prefix) {
  if (crypto?.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDurationLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

function formatDateLabel(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function getProjectById(projectId) {
  return state.projects.find(project => project.id === projectId);
}

function getRunningEntry() {
  if (!state.timer.runningEntryId) return null;
  return state.entries.find(entry => entry.id === state.timer.runningEntryId) || null;
}

function ensureTimerTick() {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    renderTimer();
  }, 1000);
}

function stopTimerTick() {
  if (!tickInterval) return;
  clearInterval(tickInterval);
  tickInterval = null;
}

function updateTimerState(entry) {
  state.timer.runningEntryId = entry ? entry.id : null;
  state.timer.startedAt = entry ? entry.start : null;
  saveState();
}

function startTimer(projectId) {
  const existing = getRunningEntry();
  if (existing) {
    const existingProject = getProjectById(existing.projectId);
    const confirmStop = confirm(`A timer for ${existingProject?.name || 'another project'} is running. Stop it?`);
    if (!confirmStop) return;
    stopTimer();
  }

  const now = new Date().toISOString();
  const entry = {
    id: createId('entry'),
    projectId,
    start: now,
    end: null,
    durationMinutes: 0,
    notes: '',
    billable: true,
    createdAt: now,
  };
  state.entries.push(entry);
  updateTimerState(entry);
  saveState();
  renderApp();
}

function stopTimer() {
  const entry = getRunningEntry();
  if (!entry) return;
  const now = new Date();
  entry.end = now.toISOString();
  entry.durationMinutes = Math.max(1, Math.round((now - new Date(entry.start)) / 60000));
  updateTimerState(null);
  saveState();
  renderApp();
}

function appendNoteToEntry(entryId, note) {
  const entry = state.entries.find(item => item.id === entryId);
  if (!entry) return;
  entry.notes = note.trim();
  saveState();
  renderEntries();
}

function addProject({ name, client, rate }) {
  state.projects.push({
    id: createId('project'),
    name,
    client,
    rate: rate ? Number(rate) : 0,
    archived: false,
    createdAt: new Date().toISOString(),
  });
  saveState();
  renderApp();
}

function handleProjectSubmit(event) {
  event.preventDefault();
  const formData = new FormData(projectForm);
  const name = formData.get('projectName').trim();
  const client = formData.get('clientName').trim();
  const rate = formData.get('rate').trim();
  if (!name) return;
  addProject({ name, client, rate });
  projectForm.reset();
}

function handleManualEntrySubmit(event) {
  event.preventDefault();
  const formData = new FormData(manualEntryForm);
  const projectId = formData.get('manualProject');
  const start = formData.get('manualStart');
  const end = formData.get('manualEnd');
  if (!projectId || !start || !end) return;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;
  if (endDate <= startDate) {
    alert('End time must be after start time.');
    return;
  }

  const minutes = Math.round((endDate - startDate) / 60000);
  state.entries.push({
    id: createId('entry'),
    projectId,
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    durationMinutes: Math.max(1, minutes),
    notes: formData.get('manualNotes').trim(),
    billable: formData.get('manualBillable') === 'on',
    createdAt: new Date().toISOString(),
  });

  saveState();
  manualEntryForm.reset();
  renderApp();
}

function renderProjects() {
  projectList.innerHTML = '';
  if (!state.projects.length) {
    projectList.innerHTML = '<p class="hint">Add a project to start tracking time.</p>';
    return;
  }

  const fragment = document.createDocumentFragment();
  const runningEntry = getRunningEntry();
  state.projects.forEach(project => {
    const card = document.createElement('article');
    card.className = 'project-card';
    const meta = [project.client, project.rate ? `${formatCurrency(project.rate)}/hr` : null]
      .filter(Boolean)
      .join(' • ');
    const row = document.createElement('div');
    row.className = 'project-row';

    const details = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = project.name;
    const metaText = document.createElement('p');
    metaText.className = 'project-meta';
    metaText.textContent = meta || 'No client details yet';
    details.append(title, metaText);

    const actionButton = document.createElement('button');
    actionButton.className = 'primary';
    actionButton.dataset.project = project.id;
    const isRunning = runningEntry?.projectId === project.id;
    actionButton.textContent = isRunning ? 'Timer running' : 'Start timer';
    actionButton.disabled = isRunning;
    if (isRunning) {
      card.classList.add('active');
    }
    actionButton.addEventListener('click', () => startTimer(project.id));

    row.append(details, actionButton);
    card.appendChild(row);
    fragment.appendChild(card);
  });

  projectList.appendChild(fragment);
}

function renderProjectSelects() {
  manualProjectSelect.innerHTML = '';
  filterProject.innerHTML = '';

  const defaultManualOption = document.createElement('option');
  defaultManualOption.value = '';
  defaultManualOption.textContent = state.projects.length ? 'Select a project' : 'No projects yet';
  manualProjectSelect.appendChild(defaultManualOption);

  const allProjectsOption = document.createElement('option');
  allProjectsOption.value = 'all';
  allProjectsOption.textContent = 'All projects';
  filterProject.appendChild(allProjectsOption);

  state.projects.forEach(project => {
    const label = project.client ? `${project.name} · ${project.client}` : project.name;
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = label;
    manualProjectSelect.appendChild(option);

    const filterOption = option.cloneNode(true);
    filterProject.appendChild(filterOption);
  });

  const hasProjects = state.projects.length > 0;
  manualProjectSelect.disabled = !hasProjects;
  manualEntryForm.querySelectorAll('input, textarea, button').forEach(element => {
    if (element.name === 'manualProject') return;
    element.disabled = !hasProjects;
  });
}

function renderTimer() {
  const runningEntry = getRunningEntry();
  if (!runningEntry) {
    activeProjectLabel.textContent = 'No timer running';
    timerDisplay.textContent = '00:00:00';
    timerHint.textContent = 'Start a timer from a project below.';
    stopTimerButton.disabled = true;
    addNoteButton.disabled = true;
    stopTimerTick();
    return;
  }

  const project = getProjectById(runningEntry.projectId);
  const startTime = new Date(runningEntry.start);
  const now = new Date();
  timerDisplay.textContent = formatDuration(now - startTime);
  activeProjectLabel.textContent = project ? project.name : 'Unknown project';
  timerHint.textContent = project?.client ? `Client: ${project.client}` : 'Remember to add context to this timer.';
  stopTimerButton.disabled = false;
  addNoteButton.disabled = false;
  ensureTimerTick();
}

function getEntriesForFilter() {
  const rangeDays = Number(filterRange.value || 30);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - rangeDays + 1);

  return state.entries
    .filter(entry => entry.end)
    .filter(entry => new Date(entry.start) >= cutoff)
    .filter(entry => filterProject.value === 'all' || entry.projectId === filterProject.value)
    .sort((a, b) => new Date(b.start) - new Date(a.start));
}

function renderEntries() {
  const entries = getEntriesForFilter();
  entryList.innerHTML = '';
  if (!entries.length) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  const fragment = document.createDocumentFragment();
  entries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'table-row';
    const project = getProjectById(entry.projectId);
    const dateCell = document.createElement('span');
    dateCell.textContent = formatDateLabel(entry.start);
    const projectCell = document.createElement('span');
    projectCell.textContent = project?.name || 'Unknown project';
    const durationCell = document.createElement('span');
    durationCell.textContent = formatDurationLabel(entry.durationMinutes);
    const billableCell = document.createElement('span');
    billableCell.textContent = entry.billable ? 'Yes' : 'No';
    const notesCell = document.createElement('span');
    notesCell.textContent = entry.notes || '—';
    row.append(dateCell, projectCell, durationCell, billableCell, notesCell);
    fragment.appendChild(row);
  });
  entryList.appendChild(fragment);
}

function calculateBillableTotals(entries) {
  return entries.reduce(
    (total, entry) => {
      if (!entry.billable || !entry.end) return total;
      const project = getProjectById(entry.projectId);
      const rate = project?.rate || 0;
      const hours = entry.durationMinutes / 60;
      return total + rate * hours;
    },
    0,
  );
}

function renderSummaries() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - todayStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const completeEntries = state.entries.filter(entry => entry.end);
  const entriesToday = completeEntries.filter(entry => new Date(entry.start) >= todayStart);
  const entriesWeek = completeEntries.filter(entry => new Date(entry.start) >= weekStart);
  const entriesMonth = completeEntries.filter(entry => new Date(entry.start) >= monthStart);

  const minutesToday = entriesToday.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const minutesWeek = entriesWeek.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const minutesMonth = entriesMonth.reduce((sum, entry) => sum + entry.durationMinutes, 0);

  summaryToday.textContent = formatDurationLabel(minutesToday);
  summaryWeek.textContent = formatDurationLabel(minutesWeek);
  summaryMonth.textContent = formatDurationLabel(minutesMonth);

  summaryTodayBillable.textContent = `${formatCurrency(calculateBillableTotals(entriesToday))} billable`;
  summaryWeekBillable.textContent = `${formatCurrency(calculateBillableTotals(entriesWeek))} billable`;
  summaryMonthBillable.textContent = `${formatCurrency(calculateBillableTotals(entriesMonth))} billable`;
}

function exportCsv() {
  if (!state.entries.length) {
    alert('No entries to export yet.');
    return;
  }

  const header = ['Project', 'Client', 'Start', 'End', 'Duration (minutes)', 'Billable', 'Hourly Rate', 'Notes'];
  const rows = state.entries.map(entry => {
    const project = getProjectById(entry.projectId);
    return [
      project?.name || 'Unknown project',
      project?.client || '',
      entry.start,
      entry.end || '',
      entry.durationMinutes,
      entry.billable ? 'Yes' : 'No',
      project?.rate || 0,
      (entry.notes || '').replace(/\n/g, ' '),
    ];
  });

  const csvContent = [header, ...rows]
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `time-entries-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function clearAllData() {
  if (!confirm('This will delete all projects and time entries. Continue?')) return;
  state = structuredClone(defaultState);
  saveState();
  renderApp();
}

function renderApp() {
  renderProjects();
  renderProjectSelects();
  renderTimer();
  renderEntries();
  renderSummaries();
}

projectForm.addEventListener('submit', handleProjectSubmit);
manualEntryForm.addEventListener('submit', handleManualEntrySubmit);
stopTimerButton.addEventListener('click', stopTimer);
addNoteButton.addEventListener('click', () => {
  if (noteDialog.open) return;
  const runningEntry = getRunningEntry();
  if (!runningEntry) return;
  noteForm.noteContent.value = runningEntry.notes || '';
  noteDialog.showModal();
});

noteForm.addEventListener('submit', event => {
  event.preventDefault();
  const runningEntry = getRunningEntry();
  if (!runningEntry) return;
  const note = noteForm.noteContent.value;
  appendNoteToEntry(runningEntry.id, note);
  noteDialog.close('confirm');
});

noteDialog.addEventListener('close', () => {
  noteForm.reset();
});

filterProject.addEventListener('change', renderEntries);
filterRange.addEventListener('change', renderEntries);
exportButton.addEventListener('click', exportCsv);
clearButton.addEventListener('click', clearAllData);

renderApp();
