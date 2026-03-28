/* ══════════════════════════════════════
   MUSICAL TRIPS — App Logic 🎭
   ══════════════════════════════════════ */

// ── State ──
let state = {
  trips: [],
  tickets: [],
  itinerary: [],   // [{id, tripId, date, time, emoji, activity, place, lat, lng, notes}]
  packing: [],     // [{id, tripId, categoryId, name, checked}]
  categories: [],  // [{id, tripId, emoji, name}]
  currentSection: 'dashboard',
  currentFilter: 'all',
  activeItineraryDay: null,
  detailTripId: null,
};

let map = null;
let mapMarkers = [];

// ── Edit tracking ──
let editingTripId   = null;
let editingTicketId = null;
let editingItinId   = null;

// ── Storage ──
function save() {
  localStorage.setItem('musicalTrips', JSON.stringify(state));
}

function load() {
  const raw = localStorage.getItem('musicalTrips');
  if (raw) {
    const saved = JSON.parse(raw);
    state = { ...state, ...saved, currentSection: 'dashboard', currentFilter: 'all' };
  }
}

// ── IDs ──
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── Formatters ──
function fmtDate(dateStr) {
  if (!dateStr) return '–';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });
}

function fmtDateShort(dateStr) {
  if (!dateStr) return '–';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { day:'2-digit', month:'short' });
}

function fmtTime(timeStr) {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d - today) / 86400000);
}

const TYPE_ICONS = {
  musical:  '🎭',
  vuelo:    '✈️',
  hotel:    '🏨',
  actividad:'🎡',
  tren:     '🚂',
  otro:     '📌',
};

function getTripName(tripId) {
  const t = state.trips.find(t => t.id === tripId);
  return t ? t.name : '–';
}

function getTripStatus(trip) {
  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(trip.startDate + 'T00:00:00');
  const end   = new Date(trip.endDate   + 'T00:00:00');
  if (today < start) return 'upcoming';
  if (today > end)   return 'past';
  return 'ongoing';
}

function getFilteredTrip() {
  const sel = document.getElementById('globalTripSelect');
  return sel ? sel.value : '';
}

// ──────────────────────────────────────────
// RENDER FUNCTIONS
// ──────────────────────────────────────────

// ── Global trip selector ──
function renderTripSelector() {
  const sel = document.getElementById('globalTripSelect');
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Todos —</option>';
  state.trips.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.emoji} ${t.name}`;
    sel.appendChild(opt);
  });
  if (state.trips.find(t => t.id === cur)) sel.value = cur;

  // Populate modal trip selects
  ['ticketTrip','itineraryTrip','categoryTrip','packingItemTrip'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    el.innerHTML = '<option value="">Elige viaje…</option>';
    state.trips.forEach(t => {
      const o = document.createElement('option');
      o.value = t.id; o.textContent = `${t.emoji} ${t.name}`;
      el.appendChild(o);
    });
    if (state.trips.find(t => t.id === prev)) el.value = prev;
  });
}

// ── Dashboard ──
function renderDashboard() {
  // Stats
  const tripId = getFilteredTrip();
  const tickets = tripId ? state.tickets.filter(t => t.tripId === tripId) : state.tickets;

  document.getElementById('numTrips').textContent    = state.trips.length;
  document.getElementById('numTickets').textContent  = tickets.length;
  document.getElementById('numMusicals').textContent = tickets.filter(t => t.type === 'musical').length;
  document.getElementById('numPacked').textContent   = (tripId
    ? state.packing.filter(p => p.tripId === tripId)
    : state.packing).length;

  // Countdown: next upcoming trip
  const upcoming = state.trips
    .filter(t => getTripStatus(t) === 'upcoming')
    .sort((a,b) => a.startDate.localeCompare(b.startDate));

  const card = document.getElementById('countdownCard');
  if (upcoming.length) {
    const t = upcoming[0];
    const days = daysUntil(t.startDate);
    document.getElementById('countdownTrip').textContent        = `${t.emoji} ${t.name}`;
    document.getElementById('countdownDestination').textContent = t.destination;
    document.getElementById('countdownNumber').textContent      = days;
    card.classList.remove('hidden');
  } else {
    card.classList.add('hidden');
  }

  // Upcoming tickets list
  const today = new Date().toISOString().slice(0,10);
  const upcoming_tickets = (tripId ? tickets : state.tickets)
    .filter(t => t.date >= today)
    .sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''))
    .slice(0, 6);

  const list = document.getElementById('upcomingList');
  if (!upcoming_tickets.length) {
    list.innerHTML = '<p class="empty-msg">¡Añade entradas para verlas aquí! 🎟️</p>';
  } else {
    list.innerHTML = upcoming_tickets.map(t => `
      <div class="upcoming-item">
        <span class="upcoming-item-icon">${TYPE_ICONS[t.type] || '📌'}</span>
        <div class="upcoming-item-info">
          <strong>${esc(t.name)}</strong>
          <span>${esc(getTripName(t.tripId))}${t.venue ? ' · ' + esc(t.venue) : ''}${t.time ? ' · ' + fmtTime(t.time) : ''}</span>
        </div>
        <span class="upcoming-item-date">${fmtDateShort(t.date)}</span>
      </div>
    `).join('');
  }
}

// ── Trips ──
function renderTrips() {
  const container = document.getElementById('tripsList');
  if (!state.trips.length) {
    container.innerHTML = '<p class="empty-msg">Aún no tienes viajes. ¡Crea el primero! 🌟</p>';
    return;
  }

  const sorted = [...state.trips].sort((a,b) => a.startDate.localeCompare(b.startDate));
  const colors = ['var(--pink)','var(--lavender)','var(--mint)','var(--peach)','var(--yellow)'];
  container.innerHTML = sorted.map((t, i) => {
    const status = getTripStatus(t);
    const badgeText = { upcoming:'¡Próximo!', ongoing:'En curso 🌟', past:'Completado' }[status];
    const color = colors[i % colors.length];
    const ticketCount = state.tickets.filter(tk => tk.tripId === t.id).length;
    return `
      <div class="trip-card" data-id="${t.id}" style="border-top-color:${color}">
        <div class="trip-card-emoji">${t.emoji}</div>
        <span class="trip-badge ${status}">${badgeText}</span>
        <button class="card-edit-btn" data-edit-trip="${t.id}" title="Editar viaje">✏️</button>
        <h3>${esc(t.name)}</h3>
        <p class="trip-dest">📍 ${esc(t.destination)}</p>
        <span class="trip-dates">📅 ${fmtDate(t.startDate)} → ${fmtDate(t.endDate)}</span>
        ${ticketCount ? `<p style="margin-top:10px;font-size:0.78rem;color:var(--text-light);font-weight:600">${ticketCount} entrada${ticketCount>1?'s':''}</p>` : ''}
        ${t.notes ? `<p style="margin-top:8px;font-size:0.8rem;color:var(--text-light);font-style:italic">${esc(t.notes)}</p>` : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.trip-card').forEach(card => {
    card.addEventListener('click', () => openTripDetail(card.dataset.id));
  });
  container.querySelectorAll('[data-edit-trip]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEditTrip(btn.dataset.editTrip); });
  });
}

// ── Trip Detail ──
function openTripDetail(tripId) {
  const trip = state.trips.find(t => t.id === tripId);
  if (!trip) return;
  state.detailTripId = tripId;
  document.getElementById('tripDetailTitle').textContent = `${trip.emoji} ${trip.name}`;
  const tickets = state.tickets.filter(t => t.tripId === tripId);
  document.getElementById('tripDetailContent').innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px">
      <div style="flex:1;min-width:140px">
        <p style="font-size:0.75rem;font-weight:700;color:var(--text-light);text-transform:uppercase">Destino</p>
        <p style="font-weight:700">📍 ${esc(trip.destination)}</p>
      </div>
      <div style="flex:1;min-width:140px">
        <p style="font-size:0.75rem;font-weight:700;color:var(--text-light);text-transform:uppercase">Fechas</p>
        <p style="font-weight:700">📅 ${fmtDate(trip.startDate)} – ${fmtDate(trip.endDate)}</p>
      </div>
    </div>
    ${trip.notes ? `<p style="color:var(--text-light);font-size:0.88rem;margin-bottom:16px;font-style:italic">${esc(trip.notes)}</p>` : ''}
    <p style="font-size:0.75rem;font-weight:700;color:var(--text-light);text-transform:uppercase;margin-bottom:8px">
      Entradas (${tickets.length})
    </p>
    ${tickets.length ? tickets.map(t => `
      <div style="display:flex;gap:10px;align-items:center;padding:8px;background:var(--cream);border-radius:10px;margin-bottom:6px">
        <span>${TYPE_ICONS[t.type]||'📌'}</span>
        <span style="font-weight:700;flex:1;font-size:0.88rem">${esc(t.name)}</span>
        <span style="font-size:0.78rem;color:var(--text-light)">${fmtDate(t.date)}</span>
      </div>
    `).join('') : '<p style="color:var(--text-light);font-size:0.85rem">Sin entradas aún</p>'}
  `;
  openModal('modalTripDetail');
}

// ── Tickets ──
function renderTickets() {
  const tripId = getFilteredTrip();
  let tickets = tripId ? state.tickets.filter(t => t.tripId === tripId) : state.tickets;

  if (state.currentFilter !== 'all') {
    tickets = tickets.filter(t => t.type === state.currentFilter);
  }

  tickets = [...tickets].sort((a,b) => a.date.localeCompare(b.date) || (a.time||'').localeCompare(b.time||''));

  const container = document.getElementById('ticketsList');
  if (!tickets.length) {
    container.innerHTML = '<p class="empty-msg">No hay entradas que mostrar. 🎟️</p>';
    return;
  }

  container.innerHTML = tickets.map(t => `
    <div class="ticket-card" data-type="${t.type}" data-id="${t.id}">
      <span class="ticket-icon">${TYPE_ICONS[t.type]||'📌'}</span>
      <div class="ticket-info">
        <h4>${esc(t.name)}</h4>
        <div class="ticket-meta">
          <span>📅 ${fmtDate(t.date)}${t.time ? ' · ' + fmtTime(t.time) : ''}</span>
          ${t.venue  ? `<span>📍 ${esc(t.venue)}</span>` : ''}
          ${t.seat   ? `<span>💺 ${esc(t.seat)}</span>`  : ''}
          ${t.code   ? `<span>🔖 ${esc(t.code)}</span>`  : ''}
          <span style="background:var(--pink);color:white">${esc(getTripName(t.tripId))}</span>
        </div>
        ${t.notes ? `<p style="font-size:0.78rem;color:var(--text-light);margin-top:4px;font-style:italic">${esc(t.notes)}</p>` : ''}
        ${(t.url || t.fileData) ? `
          <div class="ticket-attachments">
            ${t.url ? `<a class="btn-attachment url" href="${esc(t.url)}" target="_blank" rel="noopener">🔗 Ver reserva</a>` : ''}
            ${t.fileData ? `<button class="btn-attachment file" data-open-file="${t.id}">📎 ${esc(t.fileName || 'Ver archivo')}</button>` : ''}
          </div>` : ''}
      </div>
      <div class="ticket-actions">
        ${t.price ? `<span class="ticket-price">${parseFloat(t.price).toFixed(2)}€</span>` : ''}
        <button class="btn-icon" data-edit-ticket="${t.id}" title="Editar">✏️</button>
        <button class="btn-icon" data-delete-ticket="${t.id}" title="Eliminar">🗑️</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-edit-ticket]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEditTicket(btn.dataset.editTicket); });
  });
  container.querySelectorAll('[data-delete-ticket]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('¿Eliminar esta entrada?')) {
        state.tickets = state.tickets.filter(t => t.id !== btn.dataset.deleteTicket);
        save(); renderAll();
      }
    });
  });

  container.querySelectorAll('[data-open-file]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ticket = state.tickets.find(t => t.id === btn.dataset.openFile);
      if (!ticket?.fileData) return;
      const byteStr = atob(ticket.fileData.split(',')[1]);
      const ab = new ArrayBuffer(byteStr.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteStr.length; i++) ia[i] = byteStr.charCodeAt(i);
      const blob = new Blob([ab], { type: ticket.fileType || 'application/pdf' });
      const url  = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  });
}

// ── Itinerary ──
function renderItinerary() {
  const tripId = getFilteredTrip();
  const container = document.getElementById('itineraryDays');

  let items = tripId ? state.itinerary.filter(i => i.tripId === tripId) : state.itinerary;

  if (!items.length) {
    container.innerHTML = '<p class="empty-msg">Selecciona un viaje y añade actividades al itinerario. 🌍</p>';
    updateMap([]);
    return;
  }

  // Group by date
  const byDay = {};
  items.forEach(item => {
    if (!byDay[item.date]) byDay[item.date] = [];
    byDay[item.date].push(item);
  });

  const days = Object.keys(byDay).sort();
  container.innerHTML = days.map(date => {
    const dayItems = byDay[date].sort((a,b) => (a.time||'').localeCompare(b.time||''));
    return `
      <div class="itinerary-day">
        <div class="itinerary-day-header" data-date="${date}">
          <h4>📅 ${fmtDate(date)}</h4>
          <small style="color:rgba(255,255,255,0.8);font-size:0.78rem">${dayItems.length} actividad${dayItems.length>1?'es':''}</small>
        </div>
        <div class="itinerary-day-items">
          ${dayItems.map(item => `
            <div class="itinerary-item" data-id="${item.id}"
              ${item.lat && item.lng ? `data-lat="${item.lat}" data-lng="${item.lng}"` : ''}>
              <span class="itin-emoji">${item.emoji || '📍'}</span>
              <div class="itin-content">
                <span class="itin-activity">${esc(item.activity)}</span>
                ${item.time   ? `<span class="itin-time">🕐 ${fmtTime(item.time)}</span>` : ''}
                ${item.place  ? `<span class="itin-place">📍 ${esc(item.place)}</span>` : ''}
                ${item.notes  ? `<span class="itin-place" style="font-style:italic">${esc(item.notes)}</span>` : ''}
              </div>
              <button class="itin-edit" data-edit-itin="${item.id}" title="Editar">✏️</button>
              <button class="itin-delete" data-delete-itin="${item.id}" title="Eliminar">✕</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Map: show first day by default or all
  const allWithCoords = items.filter(i => i.lat && i.lng);
  updateMap(allWithCoords);

  // Click day header → show that day on map
  container.querySelectorAll('.itinerary-day-header').forEach(header => {
    header.addEventListener('click', () => {
      const date = header.dataset.date;
      const dayItems = (byDay[date] || []).filter(i => i.lat && i.lng);
      updateMap(dayItems);
    });
  });

  // Click item → focus on map
  container.querySelectorAll('.itinerary-item').forEach(el => {
    el.addEventListener('click', () => {
      const lat = parseFloat(el.dataset.lat);
      const lng = parseFloat(el.dataset.lng);
      if (!isNaN(lat) && !isNaN(lng) && map) {
        map.setView([lat, lng], 15);
      }
    });
  });

  // Edit itinerary item
  container.querySelectorAll('[data-edit-itin]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); openEditItin(btn.dataset.editItin); });
  });

  // Delete
  container.querySelectorAll('[data-delete-itin]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('¿Eliminar esta actividad?')) {
        state.itinerary = state.itinerary.filter(i => i.id !== btn.dataset.deleteItin);
        save(); renderItinerary();
      }
    });
  });
}

function updateMap(items) {
  if (!map) initMap();

  // Clear markers
  mapMarkers.forEach(m => map.removeLayer(m));
  mapMarkers = [];

  if (!items.length) {
    map.setView([48.8566, 2.3522], 4);
    return;
  }

  const kawaiIcon = (emoji) => L.divIcon({
    html: `<div style="
      font-size:22px;
      background:white;
      border-radius:50%;
      width:38px;height:38px;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 3px 10px rgba(180,100,200,0.35);
      border:2px solid #C9B8E8;
    ">${emoji}</div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -40],
    className: '',
  });

  const bounds = [];
  items.forEach(item => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lng);
    if (isNaN(lat) || isNaN(lng)) return;
    const marker = L.marker([lat, lng], { icon: kawaiIcon(item.emoji || '📍') })
      .bindPopup(`
        <div style="font-family:'Nunito',sans-serif;min-width:160px">
          <strong style="font-size:0.9rem">${esc(item.activity)}</strong>
          ${item.time  ? `<p style="font-size:0.78rem;color:#9B89B4;margin:2px 0">🕐 ${fmtTime(item.time)}</p>` : ''}
          ${item.place ? `<p style="font-size:0.78rem;color:#9B89B4">📍 ${esc(item.place)}</p>` : ''}
        </div>
      `)
      .addTo(map);
    mapMarkers.push(marker);
    bounds.push([lat, lng]);
  });

  if (bounds.length === 1) {
    map.setView(bounds[0], 14);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

function initMap() {
  map = L.map('map', { zoomControl: true }).setView([48.8566, 2.3522], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);
}

// ── Packing ──
function renderPacking() {
  const tripId = getFilteredTrip();
  const container = document.getElementById('packingCategories');

  const cats = tripId
    ? state.categories.filter(c => c.tripId === tripId)
    : state.categories;

  if (!cats.length) {
    container.innerHTML = '<p class="empty-msg">Selecciona un viaje y crea categorías para tu maleta. 🧳</p>';
    updatePackingProgress(tripId);
    return;
  }

  container.innerHTML = cats.map(cat => {
    const items = state.packing.filter(p => p.categoryId === cat.id);
    const checked = items.filter(p => p.checked).length;
    return `
      <div class="packing-category">
        <div class="packing-category-header" data-cat="${cat.id}">
          <h4>${cat.emoji || '📦'} ${esc(cat.name)}</h4>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:0.78rem;font-weight:700;color:var(--text-light)">${checked}/${items.length}</span>
            <button class="btn-icon delete-cat" data-cat-id="${cat.id}" title="Eliminar categoría">🗑️</button>
          </div>
        </div>
        <div class="packing-category-items" id="catItems_${cat.id}">
          ${items.map(item => `
            <div class="packing-item ${item.checked ? 'checked' : ''}" data-item="${item.id}">
              <input type="checkbox" id="chk_${item.id}" ${item.checked ? 'checked' : ''}>
              <label for="chk_${item.id}">${esc(item.name)}</label>
              <button class="packing-item-delete" data-delete-item="${item.id}">✕</button>
            </div>
          `).join('')}
          <div class="add-item-inline">
            <input type="text" placeholder="Añadir item..." data-add-cat="${cat.id}" id="addInline_${cat.id}">
            <button data-add-cat-btn="${cat.id}">+ Añadir</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Checkboxes
  container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
    chk.addEventListener('change', () => {
      const itemEl = chk.closest('.packing-item');
      const itemId = itemEl.dataset.item;
      const item = state.packing.find(p => p.id === itemId);
      if (item) {
        item.checked = chk.checked;
        itemEl.classList.toggle('checked', chk.checked);
        save();
        updatePackingProgress(tripId);
      }
    });
  });

  // Delete item
  container.querySelectorAll('[data-delete-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.packing = state.packing.filter(p => p.id !== btn.dataset.deleteItem);
      save(); renderPacking();
    });
  });

  // Delete category
  container.querySelectorAll('.delete-cat').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('¿Eliminar esta categoría y todos sus items?')) {
        const catId = btn.dataset.catId;
        state.categories = state.categories.filter(c => c.id !== catId);
        state.packing    = state.packing.filter(p => p.categoryId !== catId);
        save(); renderPacking();
      }
    });
  });

  // Inline add item
  container.querySelectorAll('[data-add-cat-btn]').forEach(btn => {
    btn.addEventListener('click', () => {
      const catId = btn.dataset.addCatBtn;
      const input = document.getElementById(`addInline_${catId}`);
      const name  = input.value.trim();
      if (!name) return;
      const cat = state.categories.find(c => c.id === catId);
      if (!cat) return;
      state.packing.push({ id: uid(), tripId: cat.tripId, categoryId: catId, name, checked: false });
      input.value = '';
      save(); renderPacking();
    });
  });
  container.querySelectorAll('[data-add-cat]').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const catId = input.dataset.addCat;
        document.querySelector(`[data-add-cat-btn="${catId}"]`)?.click();
      }
    });
  });

  updatePackingProgress(tripId);
}

function updatePackingProgress(tripId) {
  const items  = tripId ? state.packing.filter(p => p.tripId === tripId) : state.packing;
  const total   = items.length;
  const checked = items.filter(p => p.checked).length;
  const pct     = total ? Math.round((checked / total) * 100) : 0;
  document.getElementById('packingProgressFill').style.width  = pct + '%';
  document.getElementById('packingProgressLabel').textContent = `${checked} / ${total} preparados`;
}

// Populate packing item category dropdown
function populatePackingCategories(tripId) {
  const sel = document.getElementById('packingItemCategory');
  sel.innerHTML = '<option value="">Elige categoría…</option>';
  (tripId ? state.categories.filter(c => c.tripId === tripId) : state.categories).forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = `${c.emoji || '📦'} ${c.name}`;
    sel.appendChild(o);
  });
}

// ── renderAll ──
function renderAll() {
  renderTripSelector();
  renderDashboard();
  renderTrips();
  renderTickets();
  renderItinerary();
  renderPacking();
}

// ──────────────────────────────────────────
// MODAL HELPERS
// ──────────────────────────────────────────

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

document.querySelectorAll('.modal-close, [data-modal]').forEach(el => {
  el.addEventListener('click', () => {
    const modalId = el.dataset.modal || el.closest('.modal-overlay')?.id;
    if (modalId) closeModal(modalId);
  });
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ──────────────────────────────────────────
// FORMS
// ──────────────────────────────────────────

// ──────────────────────────────────────────
// EDIT FUNCTIONS
// ──────────────────────────────────────────

function openEditTrip(id) {
  const t = state.trips.find(t => t.id === id);
  if (!t) return;
  editingTripId = id;
  document.getElementById('tripName').value        = t.name;
  document.getElementById('tripDestination').value = t.destination;
  document.getElementById('tripStart').value       = t.startDate;
  document.getElementById('tripEnd').value         = t.endDate;
  document.getElementById('tripNotes').value       = t.notes || '';
  document.getElementById('tripEmoji').value       = t.emoji;
  document.querySelectorAll('.emoji-opt').forEach(b => {
    b.classList.toggle('selected', b.dataset.emoji === t.emoji);
  });
  document.querySelector('#modalAddTrip .modal-header h3').textContent = '✏️ Editar Viaje';
  document.querySelector('#formAddTrip .btn-primary').textContent      = 'Actualizar 💾';
  closeModal('modalTripDetail');
  openModal('modalAddTrip');
}

function openEditTicket(id) {
  const t = state.tickets.find(t => t.id === id);
  if (!t) return;
  editingTicketId = id;
  document.getElementById('ticketTrip').value  = t.tripId;
  document.getElementById('ticketType').value  = t.type;
  document.getElementById('ticketName').value  = t.name;
  document.getElementById('ticketDate').value  = t.date;
  document.getElementById('ticketTime').value  = t.time  || '';
  document.getElementById('ticketVenue').value = t.venue || '';
  document.getElementById('ticketSeat').value  = t.seat  || '';
  document.getElementById('ticketCode').value  = t.code  || '';
  document.getElementById('ticketPrice').value = t.price || '';
  document.getElementById('ticketNotes').value = t.notes || '';
  document.getElementById('ticketUrl').value   = t.url   || '';
  if (t.fileData) {
    pendingFileData = t.fileData;
    pendingFileName = t.fileName;
    pendingFileType = t.fileType;
    showFilePreview(t.fileName, t.fileType);
  } else {
    clearFilePreview();
  }
  document.querySelector('#modalAddTicket .modal-header h3').textContent = '✏️ Editar Entrada';
  document.querySelector('#formAddTicket .btn-primary').textContent      = 'Actualizar 💾';
  openModal('modalAddTicket');
}

function openEditItin(id) {
  const item = state.itinerary.find(i => i.id === id);
  if (!item) return;
  editingItinId = id;
  document.getElementById('itineraryTrip').value     = item.tripId;
  document.getElementById('itineraryDate').value     = item.date;
  document.getElementById('itineraryTime').value     = item.time     || '';
  document.getElementById('itineraryEmoji').value    = item.emoji    || '';
  document.getElementById('itineraryActivity').value = item.activity;
  document.getElementById('itineraryPlace').value    = item.place    || '';
  document.getElementById('itineraryLat').value      = item.lat      || '';
  document.getElementById('itineraryLng').value      = item.lng      || '';
  document.getElementById('itineraryNotes').value    = item.notes    || '';
  document.querySelector('#modalAddItinerary .modal-header h3').textContent = '✏️ Editar actividad';
  document.querySelector('#formAddItinerary .btn-primary').textContent      = 'Actualizar 💾';
  openModal('modalAddItinerary');
}

function resetModalTitle(modalId, originalTitle, formId, originalBtn) {
  document.querySelector(`#${modalId} .modal-header h3`).textContent = originalTitle;
  document.querySelector(`#${formId} .btn-primary`).textContent      = originalBtn;
}

// ── Add Trip ──
document.getElementById('openAddTrip').addEventListener('click', () => {
  editingTripId = null;
  resetModalTitle('modalAddTrip', '✈️ Nuevo Viaje', 'formAddTrip', 'Guardar viaje 💾');
  openModal('modalAddTrip');
});

document.getElementById('formAddTrip').addEventListener('submit', e => {
  e.preventDefault();
  const data = {
    name:        document.getElementById('tripName').value.trim(),
    destination: document.getElementById('tripDestination').value.trim(),
    startDate:   document.getElementById('tripStart').value,
    endDate:     document.getElementById('tripEnd').value,
    emoji:       document.getElementById('tripEmoji').value || '🎭',
    notes:       document.getElementById('tripNotes').value.trim(),
  };
  if (editingTripId) {
    const idx = state.trips.findIndex(t => t.id === editingTripId);
    if (idx !== -1) state.trips[idx] = { ...state.trips[idx], ...data };
    editingTripId = null;
  } else {
    state.trips.push({ id: uid(), ...data });
  }
  save(); renderAll();
  closeModal('modalAddTrip');
  e.target.reset();
  resetModalTitle('modalAddTrip', '✈️ Nuevo Viaje', 'formAddTrip', 'Guardar viaje 💾');
  document.querySelector('.emoji-opt.selected')?.classList.remove('selected');
  document.querySelector('.emoji-opt[data-emoji="🎭"]')?.classList.add('selected');
  document.getElementById('tripEmoji').value = '🎭';
});

// Emoji picker
document.querySelectorAll('.emoji-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.emoji-opt').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('tripEmoji').value = btn.dataset.emoji;
  });
});

// ── Delete Trip ──
document.getElementById('deleteTripBtn').addEventListener('click', () => {
  if (!state.detailTripId) return;
  if (!confirm('¿Eliminar este viaje y TODAS sus entradas, itinerario y maleta?')) return;
  const id = state.detailTripId;
  state.trips      = state.trips.filter(t => t.id !== id);
  state.tickets    = state.tickets.filter(t => t.tripId !== id);
  state.itinerary  = state.itinerary.filter(i => i.tripId !== id);
  state.packing    = state.packing.filter(p => p.tripId !== id);
  state.categories = state.categories.filter(c => c.tripId !== id);
  state.detailTripId = null;
  save(); renderAll();
  closeModal('modalTripDetail');
});

// ── Add Ticket ──
// ── File upload UI logic ──
let pendingFileData = null;
let pendingFileName = null;
let pendingFileType = null;

const fileInput       = document.getElementById('ticketFile');
const fileUploadArea  = document.getElementById('fileUploadArea');
const filePlaceholder = document.getElementById('fileUploadPlaceholder');
const filePreview     = document.getElementById('fileUploadPreview');
const filePreviewName = document.getElementById('filePreviewName');
const filePreviewIcon = document.getElementById('filePreviewIcon');
const fileRemoveBtn   = document.getElementById('fileRemoveBtn');

function showFilePreview(name, type) {
  const isPdf = type === 'application/pdf';
  filePreviewIcon.textContent = isPdf ? '📄' : '🖼️';
  filePreviewName.textContent = name;
  filePlaceholder.classList.add('hidden');
  filePreview.classList.remove('hidden');
}
function clearFilePreview() {
  pendingFileData = null; pendingFileName = null; pendingFileType = null;
  fileInput.value = '';
  filePlaceholder.classList.remove('hidden');
  filePreview.classList.add('hidden');
}

fileUploadArea.addEventListener('click', () => fileInput.click());
fileUploadArea.addEventListener('dragover', e => { e.preventDefault(); fileUploadArea.classList.add('drag-over'); });
fileUploadArea.addEventListener('dragleave', () => fileUploadArea.classList.remove('drag-over'));
fileUploadArea.addEventListener('drop', e => {
  e.preventDefault();
  fileUploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); });
fileRemoveBtn.addEventListener('click', e => { e.stopPropagation(); clearFilePreview(); });

function handleFile(file) {
  if (file.size > 4 * 1024 * 1024) {
    alert('El archivo es demasiado grande (máx. 4 MB). Si es un PDF grande, usa la opción de URL.');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    pendingFileData = ev.target.result;
    pendingFileName = file.name;
    pendingFileType = file.type;
    showFilePreview(file.name, file.type);
  };
  reader.readAsDataURL(file);
}

document.getElementById('openAddTicket').addEventListener('click', () => {
  editingTicketId = null;
  resetModalTitle('modalAddTicket', '🎟️ Nueva Entrada', 'formAddTicket', 'Guardar 💾');
  const tripId = getFilteredTrip();
  if (tripId) document.getElementById('ticketTrip').value = tripId;
  clearFilePreview();
  openModal('modalAddTicket');
});

document.getElementById('formAddTicket').addEventListener('submit', e => {
  e.preventDefault();
  const tripId = document.getElementById('ticketTrip').value;
  if (!tripId) { alert('Selecciona un viaje'); return; }
  const data = {
    tripId,
    type:     document.getElementById('ticketType').value,
    name:     document.getElementById('ticketName').value.trim(),
    date:     document.getElementById('ticketDate').value,
    time:     document.getElementById('ticketTime').value,
    venue:    document.getElementById('ticketVenue').value.trim(),
    seat:     document.getElementById('ticketSeat').value.trim(),
    code:     document.getElementById('ticketCode').value.trim(),
    price:    document.getElementById('ticketPrice').value,
    notes:    document.getElementById('ticketNotes').value.trim(),
    url:      document.getElementById('ticketUrl').value.trim(),
    fileData: pendingFileData,
    fileName: pendingFileName,
    fileType: pendingFileType,
  };
  try {
    if (editingTicketId) {
      const idx = state.tickets.findIndex(t => t.id === editingTicketId);
      if (idx !== -1) state.tickets[idx] = { ...state.tickets[idx], ...data };
      editingTicketId = null;
    } else {
      state.tickets.push({ id: uid(), ...data });
    }
    save();
  } catch (err) {
    if (!editingTicketId) state.tickets.pop();
    alert('No hay espacio suficiente para guardar el archivo. Intenta con uno más pequeño o usa la opción de URL.');
    return;
  }
  renderAll();
  closeModal('modalAddTicket');
  e.target.reset();
  clearFilePreview();
  resetModalTitle('modalAddTicket', '🎟️ Nueva Entrada', 'formAddTicket', 'Guardar 💾');
});

// ── Filter tickets ──
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.currentFilter = btn.dataset.filter;
    renderTickets();
  });
});

// ── Add Itinerary ──
document.getElementById('openAddItinerary').addEventListener('click', () => {
  editingItinId = null;
  resetModalTitle('modalAddItinerary', '📅 Añadir actividad', 'formAddItinerary', 'Añadir 💾');
  const tripId = getFilteredTrip();
  if (tripId) document.getElementById('itineraryTrip').value = tripId;
  openModal('modalAddItinerary');
});

document.getElementById('formAddItinerary').addEventListener('submit', e => {
  e.preventDefault();
  const tripId = document.getElementById('itineraryTrip').value;
  if (!tripId) { alert('Selecciona un viaje'); return; }
  const data = {
    tripId,
    date:     document.getElementById('itineraryDate').value,
    time:     document.getElementById('itineraryTime').value,
    emoji:    document.getElementById('itineraryEmoji').value || '📍',
    activity: document.getElementById('itineraryActivity').value.trim(),
    place:    document.getElementById('itineraryPlace').value.trim(),
    lat:      document.getElementById('itineraryLat').value,
    lng:      document.getElementById('itineraryLng').value,
    notes:    document.getElementById('itineraryNotes').value.trim(),
  };
  if (editingItinId) {
    const idx = state.itinerary.findIndex(i => i.id === editingItinId);
    if (idx !== -1) state.itinerary[idx] = { ...state.itinerary[idx], ...data };
    editingItinId = null;
  } else {
    state.itinerary.push({ id: uid(), ...data });
  }
  save(); renderItinerary();
  closeModal('modalAddItinerary');
  e.target.reset();
  resetModalTitle('modalAddItinerary', '📅 Añadir actividad', 'formAddItinerary', 'Añadir 💾');
});

// ── Add Packing Category ──
document.getElementById('openAddCategory').addEventListener('click', () => {
  const tripId = getFilteredTrip();
  if (tripId) document.getElementById('categoryTrip').value = tripId;
  openModal('modalAddCategory');
});

document.getElementById('formAddCategory').addEventListener('submit', e => {
  e.preventDefault();
  const tripId = document.getElementById('categoryTrip').value;
  if (!tripId) { alert('Selecciona un viaje'); return; }
  const cat = {
    id:     uid(),
    tripId,
    emoji:  document.getElementById('categoryEmoji').value.trim() || '📦',
    name:   document.getElementById('categoryName').value.trim(),
  };
  state.categories.push(cat);
  save(); renderPacking();
  closeModal('modalAddCategory');
  e.target.reset();
});

// ── Add Packing Item ──
document.getElementById('openAddPackingItem').addEventListener('click', () => {
  const tripId = getFilteredTrip();
  if (tripId) {
    document.getElementById('packingItemTrip').value = tripId;
    populatePackingCategories(tripId);
  }
  openModal('modalAddPackingItem');
});

document.getElementById('packingItemTrip').addEventListener('change', function() {
  populatePackingCategories(this.value);
});

document.getElementById('formAddPackingItem').addEventListener('submit', e => {
  e.preventDefault();
  const tripId     = document.getElementById('packingItemTrip').value;
  const categoryId = document.getElementById('packingItemCategory').value;
  const name       = document.getElementById('packingItemName').value.trim();
  if (!tripId || !categoryId) { alert('Selecciona viaje y categoría'); return; }
  state.packing.push({ id: uid(), tripId, categoryId, name, checked: false });
  save(); renderPacking();
  closeModal('modalAddPackingItem');
  e.target.reset();
});

// ──────────────────────────────────────────
// NAVIGATION
// ──────────────────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const section = btn.dataset.section;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(section)?.classList.add('active');
    state.currentSection = section;

    // Init map lazily when itinerary section opens
    if (section === 'itinerary' && !map) {
      initMap();
      renderItinerary();
    } else if (section === 'itinerary') {
      renderItinerary();
    }
  });
});

// Global trip selector change
document.getElementById('globalTripSelect').addEventListener('change', () => {
  renderAll();
  if (state.currentSection === 'itinerary') renderItinerary();
});

// ── Escape HTML ──
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ──────────────────────────────────────────
// INIT
// ──────────────────────────────────────────

load();
renderAll();

// Add some default packing categories if it's the user's first time
if (state.trips.length === 0 && state.categories.length === 0) {
  console.log('¡Bienvenida a Musical Trips! 🎭✨');
}
