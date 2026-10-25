const STORAGE_KEY = 'mis-tarjetas-v1';
const cardList = document.querySelector('#cards-list');
const emptyState = document.querySelector('#empty-state');
const dialog = document.querySelector('#card-dialog');
const form = document.querySelector('#card-form');
const toast = document.querySelector('#toast');
let cards = loadCards();
let toastTimer;

function loadCards() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved.filter(isValidCard) : [];
  } catch {
    return [];
  }
}

function isValidCard(card) {
  return card && typeof card.id === 'string' && typeof card.name === 'string' &&
    (card.currency === 'ARS' || card.currency === 'USD') &&
    Number.isFinite(Number(card.limit)) && Number.isFinite(Number(card.debt));
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
  } catch {
    showToast('No se pudo guardar. Revisá el espacio disponible en el dispositivo.');
  }
}

function money(amount, currency, compact = false) {
  const maxDigits = compact ? 0 : 2;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDigits
  }).format(Number(amount) || 0);
}

function formatPair(amounts) {
  return `<span><small>ARS</small> ${money(amounts.ARS, 'ARS')}</span><span><small>USD</small> ${money(amounts.USD, 'USD')}</span>`;
}

function totalsFor(field) {
  return cards.reduce((sum, card) => {
    sum[card.currency] += Number(card[field]) || 0;
    return sum;
  }, { ARS: 0, USD: 0 });
}

function renderSummary() {
  const debt = totalsFor('debt');
  const limit = totalsFor('limit');
  const available = {
    ARS: cards.filter(card => card.currency === 'ARS').reduce((sum, card) => sum + Number(card.limit) - Number(card.debt), 0),
    USD: cards.filter(card => card.currency === 'USD').reduce((sum, card) => sum + Number(card.limit) - Number(card.debt), 0)
  };
  document.querySelector('#debt-values').innerHTML = `
    <div class="money-block"><span class="currency-label">Pesos argentinos</span><strong class="money-value">${money(debt.ARS, 'ARS')}</strong></div>
    <div class="money-block"><span class="currency-label">Dólares</span><strong class="money-value">${money(debt.USD, 'USD')}</strong></div>`;
  document.querySelector('#limit-values').innerHTML = formatPair(limit);
  document.querySelector('#available-values').innerHTML = formatPair(available);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

const cardIcon = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18M7 15h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;
const editIcon = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 6 4 4M4 20l4-.8L19.3 7.9a2.1 2.1 0 0 0-3-3L5 16.2 4 20Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const deleteIcon = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function renderCards() {
  const count = cards.length;
  document.querySelector('#card-count').textContent = count;
  emptyState.hidden = count > 0;
  cardList.hidden = count === 0;
  cardList.innerHTML = cards.map(card => {
    const limit = Number(card.limit) || 0;
    const debt = Number(card.debt) || 0;
    const available = limit - debt;
    const used = limit > 0 ? debt / limit * 100 : 0;
    const barWidth = Math.min(Math.max(used, 0), 100);
    const stateClass = used > 100 ? 'over' : used >= 75 ? 'high' : '';
    const title = escapeHtml(card.name);
    const subline = [card.brand, card.bank].filter(Boolean).map(escapeHtml).join(' · ') || card.currency;
    return `<article class="credit-card" data-card-id="${escapeHtml(card.id)}">
      <div class="card-topline">
        <div class="card-identity"><span class="card-emblem">${cardIcon}</span><div><h3 class="card-title">${title}</h3><p class="card-subtitle">${subline} · ${card.currency}</p></div></div>
        <div class="card-actions">
          <button class="icon-button" type="button" data-action="edit" data-id="${escapeHtml(card.id)}" aria-label="Editar ${title}" title="Editar">${editIcon}</button>
          <button class="icon-button delete" type="button" data-action="delete" data-id="${escapeHtml(card.id)}" aria-label="Borrar ${title}" title="Borrar">${deleteIcon}</button>
        </div>
      </div>
      <div class="card-summary">
        <div><span class="card-metric-label">Límite total</span><strong class="card-limit">${money(limit, card.currency)}</strong></div>
        <div class="available-block"><span class="card-metric-label">Disponible</span><strong class="available-value">${money(available, card.currency)}</strong></div>
      </div>
      <div class="progress-meta"><span>${money(debt, card.currency)} usado${used > 100 ? ' · supera el límite' : ''}</span><strong>${Math.max(0, used).toFixed(0)}% usado</strong></div>
      <div class="progress-track" role="progressbar" aria-label="Porcentaje del límite utilizado en ${title}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(Math.max(used, 0), 100)}"><div class="progress-fill ${stateClass}" style="width:${barWidth}%"></div></div>
    </article>`;
  }).join('');
}

function render() {
  renderSummary();
  renderCards();
}

function openCardDialog(card = null) {
  form.reset();
  document.querySelector('#card-id').value = card?.id || '';
  document.querySelector('#dialog-title').textContent = card ? 'Editar tarjeta' : 'Agregar tarjeta';
  document.querySelector('#save-card-button').textContent = card ? 'Guardar cambios' : 'Guardar tarjeta';
  document.querySelector('#card-name').value = card?.name || '';
  document.querySelector('#card-bank').value = card?.bank || '';
  document.querySelector('#card-brand').value = card?.brand || 'Visa';
  document.querySelector('#card-currency').value = card?.currency || 'ARS';
  document.querySelector('#card-limit').value = card?.limit ?? '';
  document.querySelector('#card-debt').value = card?.debt ?? 0;
  dialog.showModal();
  window.setTimeout(() => document.querySelector('#card-name').focus(), 40);
}

function closeDialog() {
  dialog.close();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2600);
}

function handleCardAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const index = cards.findIndex(card => card.id === button.dataset.id);
  if (index < 0) return;
  if (button.dataset.action === 'edit') {
    openCardDialog(cards[index]);
    return;
  }
  if (button.dataset.action === 'delete') {
    const cardName = cards[index].name;
    if (window.confirm(`¿Borrar ${cardName}? Se eliminará de este dispositivo.`)) {
      cards.splice(index, 1);
      persist();
      render();
      showToast('Tarjeta borrada.');
    }
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const id = document.querySelector('#card-id').value;
  const existing = cards.find(card => card.id === id);
  const card = {
    id: id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    name: document.querySelector('#card-name').value.trim(),
    bank: document.querySelector('#card-bank').value.trim(),
    brand: document.querySelector('#card-brand').value,
    currency: document.querySelector('#card-currency').value,
    limit: Number(document.querySelector('#card-limit').value),
    debt: Number(document.querySelector('#card-debt').value)
  };
  if (!card.name) {
    showToast('Poné un nombre para identificar la tarjeta.');
    document.querySelector('#card-name').focus();
    return;
  }
  if (card.limit < 0 || card.debt < 0) return;
  if (existing) cards[cards.indexOf(existing)] = card;
  else cards.unshift(card);
  persist();
  render();
  closeDialog();
  showToast(existing ? 'Tarjeta actualizada.' : 'Tarjeta agregada.');
});

document.querySelector('#add-card-button').addEventListener('click', () => openCardDialog());
document.querySelector('#empty-add-button').addEventListener('click', () => openCardDialog());
document.querySelector('#nav-add-button').addEventListener('click', () => showToast('El registro de compras llega en la próxima etapa.'));
document.querySelector('#close-dialog').addEventListener('click', closeDialog);
document.querySelector('#cancel-dialog').addEventListener('click', closeDialog);
cardList.addEventListener('click', handleCardAction);
document.querySelectorAll('[data-coming-soon]').forEach(item => {
  item.addEventListener('click', event => {
    if (item.dataset.comingSoon === 'Tarjetas') return;
    event.preventDefault();
    showToast(`${item.dataset.comingSoon}: lo sumamos en una próxima etapa.`);
  });
});

dialog.addEventListener('click', event => {
  if (event.target === dialog) closeDialog();
});

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

render();

