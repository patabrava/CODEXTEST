const entryForm = document.getElementById('entry-form');
const entryList = document.getElementById('entry-list');
const clearEntriesBtn = document.getElementById('clear-entries');
const emptyState = document.getElementById('empty-state');

const storageKey = 'radiant-diary-entries';
let entries = loadEntries();

function loadEntries() {
  try {
    const persisted = localStorage.getItem(storageKey);
    return persisted ? JSON.parse(persisted) : [];
  } catch (error) {
    console.warn('Unable to parse stored entries', error);
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(storageKey, JSON.stringify(entries));
}

function createId() {
  return `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitize(value) {
  const temp = document.createElement('div');
  temp.textContent = value;
  return temp.innerHTML.replace(/\n/g, '<br/>');
}

function renderEntries() {
  entryList.innerHTML = '';

  if (!entries.length) {
    emptyState.style.visibility = 'visible';
    return;
  }

  emptyState.style.visibility = 'hidden';
  const fragment = document.createDocumentFragment();

  [...entries]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach(entry => {
      const card = document.createElement('article');
      card.className = 'entry';
      card.innerHTML = `
        <header class="entry-header">
          <p class="eyebrow subtle">${new Date(entry.createdAt).toLocaleString()}</p>
          <strong>${entry.title}</strong>
        </header>
        <p class="entry-body">${sanitize(entry.content)}</p>
      `;
      fragment.appendChild(card);
    });

  entryList.appendChild(fragment);
}

function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(entryForm);
  const title = formData.get('title').trim();
  const content = formData.get('content').trim();

  if (!title || !content) return;

  entries.push({ id: createId(), title, content, createdAt: new Date().toISOString() });
  saveEntries();
  renderEntries();
  entryForm.reset();
}

function clearEntries() {
  if (!entries.length) return;
  if (!confirm('Delete all entries?')) return;
  entries = [];
  saveEntries();
  renderEntries();
}

entryForm.addEventListener('submit', handleSubmit);
clearEntriesBtn.addEventListener('click', clearEntries);

renderEntries();
