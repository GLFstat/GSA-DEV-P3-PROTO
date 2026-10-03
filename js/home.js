const API_BASE = 'https://api.opengolfapi.org/api/v1';
/* Phase 3 account hook — current prototype is competitive. */
const ACCOUNT_TYPE = 'competitive';
const toast = document.getElementById('toast');
let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 1400);
}
/* =========================================================
   SCREEN NAVIGATION
   ========================================================= */
const homeScreen = document.getElementById('homeScreen');
const roundSetupScreen = document.getElementById('roundSetupScreen');
const bottomNav = document.getElementById('bottomNav');
const setupBackBtn = document.getElementById('setupBackBtn');
function showHome() {
  courseDataScreen.hidden = true;
  roundSetupScreen.hidden = true;
  homeScreen.hidden = false;
  bottomNav.hidden = false;
  window.scrollTo({
    top: 0,
    behavior: 'instant'
  });
}
function showRoundSetup() {
  courseDataScreen.hidden = true;
  homeScreen.hidden = true;
  roundSetupScreen.hidden = false;
  bottomNav.hidden = true;
  window.scrollTo({
    top: 0,
    behavior: 'instant'
  });
}
setupBackBtn.addEventListener('click', showHome);
/* =========================================================
   HOME CARDS
   ========================================================= */
const startNewRoundBtn = document.querySelector('.start-round');
startNewRoundBtn.addEventListener('click', showRoundSetup);

document.querySelectorAll('[data-action]:not(.start-round)').forEach(button => {
  button.addEventListener('click', () => {
    const action = button.dataset.action;
    const labels = {
      'last-round': 'Last Round',
      'summary': 'Last Round Summary',
      'clubhouse': 'Clubhouse',
      'my-game': 'My Game',
      'history': 'History'
    };
    showToast(`${labels[action]} — prototype destination`);
  });
});
/* =========================================================
   ROUND SETUP — SELECT CONTROLS
   ========================================================= */
const roundTypeSelect = document.getElementById('roundTypeSelect');
const roundLengthSelect = document.getElementById('roundLengthSelect');
const teeSelect = document.getElementById('teeSelect');
const startingHoleSelect = document.getElementById('startingHoleSelect');
const teeSection = document.getElementById('teeSection');
const startingHoleSection = document.getElementById('startingHoleSection');
const competitionNameSection = document.getElementById('competitionNameSection');
function updateSelectState(select) {
  select.classList.toggle('is-unselected', !select.value);
}
roundTypeSelect.addEventListener('change', () => {
  updateSelectState(roundTypeSelect);
});
roundLengthSelect.addEventListener('change', () => {
  updateSelectState(roundLengthSelect);
});
startingHoleSelect.addEventListener('change', () => {
  updateSelectState(startingHoleSelect);
  startingHoleSection.classList.toggle('needs-selection', !startingHoleSelect.value);
});
updateSelectState(roundTypeSelect);
updateSelectState(roundLengthSelect);
updateSelectState(startingHoleSelect);
/* =========================================================
   COURSE SEARCH — OPENGOLFAPI
   ========================================================= */
const courseSelectBtn = document.getElementById('courseSelectBtn');
const courseSearchPanel =
  document.getElementById('courseSearchPanel');
const courseSearchCloseBtn =
  document.getElementById('courseSearchCloseBtn');
const courseSearchInput =
  document.getElementById('courseSearchInput');
const courseSearchStatus =
  document.getElementById('courseSearchStatus');
const courseSearchResults =
  document.getElementById('courseSearchResults');
let selectedCourse = null;
let selectedTees = [];
let selectedHoles = [];
let searchTimer = null;
let searchRequestNumber = 0;
/* Open the search panel every time the Course card is tapped. */
courseSelectBtn.addEventListener('click', openCourseSearch);
function openCourseSearch() {
  courseSearchPanel.hidden = false;
  courseSearchInput.value = '';
  courseSearchResults.innerHTML = '';
  courseSearchStatus.textContent =
    'Type at least 2 characters to search.';
  setTimeout(() => {
    courseSearchPanel.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
    courseSearchInput.focus();
  }, 60);
}
courseSearchCloseBtn.addEventListener(
  'click',
  closeCourseSearch
);
function closeCourseSearch() {
  courseSearchPanel.hidden = true;
}
/* Search as the golfer types, with a short debounce. */
courseSearchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const query = courseSearchInput.value.trim();
  if (query.length < 2) {
    courseSearchStatus.textContent =
      'Type at least 2 characters to search.';
    courseSearchResults.innerHTML = '';
    return;
  }
  courseSearchStatus.textContent = 'Searching…';
  searchTimer = setTimeout(() => {
    searchCourses(query);
  }, 350);
});
async function searchCourses(query) {
  const requestNumber = ++searchRequestNumber;
  try {
    const url =
      `${API_BASE}/courses/search?q=${encodeURIComponent(query)}&state=CO&limit=10`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Course search failed (${response.status})`);
    }
    const data = await response.json();
    if (requestNumber !== searchRequestNumber) {
      return;
    }
    const courses = Array.isArray(data)
      ? data
      : Array.isArray(data.courses)
        ? data.courses
        : [];
    renderCourseResults(courses);
  } catch (error) {
    console.error('OpenGolfAPI course search:', error);
    courseSearchStatus.textContent =
      'Course search is temporarily unavailable.';
    courseSearchResults.innerHTML = '';
  }
}
function renderCourseResults(courses) {
  courseSearchResults.innerHTML = '';
  if (!courses.length) {
    courseSearchStatus.textContent =
      'No matching Colorado courses found.';
    return;
  }
  courseSearchStatus.textContent =
    `${courses.length} course${courses.length === 1 ? '' : 's'} found.`;
  courses.forEach(course => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'course-search-result';
    const name =
      course.name ||
      course.course_name ||
      'Unnamed Course';
    const city =
      course.city ||
      '';
    const state =
      course.state ||
      'CO';
    const type =
      course.type ||
      '';
    button.innerHTML = `
      <span class="course-search-result-main">
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(
          [city, state].filter(Boolean).join(', ')
        )}</span>
      </span>
      <span class="course-search-result-arrow">»</span>
    `;
    button.addEventListener('click', () => {
      selectCourse(course);
    });
    courseSearchResults.appendChild(button);
  });
}
/* =========================================================
   COURSE SELECTION
   ========================================================= */
async function selectCourse(course) {
  selectedCourse = course;
  selectedTees = [];
  selectedHoles = [];
  courseDataConfirmedRows.clear();
  courseSelectBtn.classList.remove('needs-selection');
  courseSelectBtn.classList.add('is-selected');
  closeCourseSearch();
  teeSection.hidden = false;
  teeSection.classList.add('needs-selection');
  const name =
    course.name ||
    course.course_name ||
    'Selected Course';
  const location =
    [course.city, course.state]
      .filter(Boolean)
      .join(', ');
  courseSelectBtn.innerHTML = `
    <div>
      <div class="setup-card-primary">
        ${escapeHtml(name)}
      </div>
      <div class="setup-card-secondary">
        ${escapeHtml(location || 'Course selected')}
      </div>
    </div>
    <span class="setup-chevron">»</span>
  `;
  resetCourseDetails();
  teeSelect.disabled = true;
  teeSelect.innerHTML = `
    <option value="" selected>Loading Tees…</option>
  `;
  teeSelect.classList.add('is-unselected');
  teeSection.classList.add('needs-selection');
  courseDataStatus.textContent = 'Course selected — select tees';
  courseDataStatus.classList.add('is-attention');
  courseDataStatus.classList.remove('is-complete');
  courseDataIndicator.classList.add('is-attention');
  courseDataIndicator.classList.remove('is-complete');
  showToast('Course selected — now select tees');
  await loadCourseData(course.id);
}
/* =========================================================
   LOAD TEES + HOLES
   ========================================================= */
async function loadCourseData(courseId) {
  if (!courseId) {
    setCourseAttention('Course ID unavailable.');
    return;
  }
  try {
    const [teesResponse, holesResponse] = await Promise.all([
      fetch(`${API_BASE}/courses/${courseId}/tees`),
      fetch(`${API_BASE}/courses/${courseId}/holes`)
    ]);
    if (!teesResponse.ok) {
      throw new Error(
        `Tee data failed (${teesResponse.status})`
      );
    }
    if (!holesResponse.ok) {
      throw new Error(
        `Hole data failed (${holesResponse.status})`
      );
    }
    const teesData = await teesResponse.json();
    const holesData = await holesResponse.json();
    selectedTees = normalizeArray(teesData);
    selectedHoles = normalizeArray(holesData);
    populateTeeSelect(selectedTees);
    teeSection.classList.add('needs-selection');
    populateCourseDetailsFromCourse();
    if (!selectedTees.length) {
      setCourseAttention('No tee sets were returned.');
      return;
    }
    courseDataStatus.textContent = 'Course selected — select tees';
    courseDataStatus.classList.add('is-attention');
    courseDataStatus.classList.remove('is-complete');
    courseDataIndicator.classList.add('is-attention');
    courseDataIndicator.classList.remove('is-complete');
    setTimeout(() => {
      teeSection.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 80);
} catch (error) {
    console.error('OpenGolfAPI course data:', error);
    resetTeeSelect();
    teeSection.classList.remove('needs-selection');
    setCourseAttention(
      'Course found, but complete course data could not be retrieved.'
    );
  }
}
function normalizeArray(data) {
  if (Array.isArray(data)) {
    return data;
  }
  if (Array.isArray(data.tees)) {
    return data.tees;
  }
  if (Array.isArray(data.holes)) {
    return data.holes;
  }
  if (Array.isArray(data.data)) {
    return data.data;
  }
  return [];
}
/* =========================================================
   TEES
   ========================================================= */
function resetTeeSelect() {
  teeSelect.disabled = true;
  teeSelect.innerHTML = `
    <option value="" selected>
      Select Course First
    </option>
  `;
  updateSelectState(teeSelect);
}
function populateTeeSelect(tees) {
  teeSelect.disabled = false;
  teeSelect.innerHTML = `
    <option value="" selected>
      Select Tees
    </option>
  `;
  /*
    Isaiah's current prototype is using male tees.
    We therefore put male tee sets first and omit female
    tee sets from this prototype.
  */
  const usableTees = tees.filter(tee => {
    return !tee.gender ||
      String(tee.gender).toLowerCase() === 'male';
  });
  usableTees.forEach((tee, index) => {
    const option = document.createElement('option');
    const teeKey =
      tee.tee_key ||
      tee.key ||
      String(index);
    const teeName =
      tee.tee_name ||
      tee.name ||
      `Tee ${index + 1}`;
    const yardage =
      tee.yardage ??
      tee.yards ??
      null;
    const rating =
      tee.course_rating ??
      tee.rating ??
      null;
    const slope =
      tee.slope ??
      null;
    option.value = String(index);
    option.textContent =
      formatTeeLabel(
        teeName,
        yardage,
        rating,
        slope
      );
    option.dataset.teeKey = teeKey;
    teeSelect.appendChild(option);
  });
  updateSelectState(teeSelect);
}
function formatTeeLabel(name, yardage, rating, slope) {
  const parts = [name];
  if (yardage != null) {
    parts.push(`${Number(yardage).toLocaleString()} yds`);
  }
  if (rating != null && slope != null) {
    parts.push(`${rating} / ${slope}`);
  }
  return parts.join(' — ');
}
teeSelect.addEventListener('change', () => {
  updateSelectState(teeSelect);
  teeSection.classList.toggle('needs-selection', !teeSelect.value);
  if (!teeSelect.value) {
    resetCourseDetails();
    return;
  }
  const tee = getSelectedTee();
  if (!tee) {
    resetCourseDetails();
    return;
  }
  populateCourseDetails(tee);
  startingHoleSection.classList.add('needs-selection');
  setTimeout(() => {
    startingHoleSection.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }, 120);
});
function getSelectedTee() {
  return selectedTees[
    Number(teeSelect.value)
  ] || null;
}
/* =========================================================
   COURSE DETAILS
   ========================================================= */
const courseDataStatus =
  document.getElementById('courseDataStatus');

const courseDataLabel =
  document.querySelector('.course-data-label');

const courseDataIndicator =
  document.getElementById('courseDataIndicator');
const courseHoles =
  document.getElementById('courseHoles');
const courseYardage =
  document.getElementById('courseYardage');
const coursePar =
  document.getElementById('coursePar');
const courseRatingSlope =
  document.getElementById('courseRatingSlope');
const holeDataMessage =
  document.getElementById('holeDataMessage');
function resetCourseDetails() {
  courseHoles.textContent = '—';
  courseYardage.textContent = '—';
  coursePar.textContent = '—';
  courseRatingSlope.textContent = '—';
  courseDataStatus.textContent = 'Not retrieved';
  courseDataStatus.classList.remove(
    'is-complete',
    'is-attention'
  );
  courseDataIndicator.classList.remove(
    'is-complete',
    'is-attention'
  );
  holeDataMessage.textContent =
    'Choose a course and tees to retrieve hole yardages, pars, rating and slope.';
}
function setCourseReady() {
  courseDataStatus.textContent =
    'Course data retrieved';
  courseDataStatus.classList.add('is-complete');
  courseDataStatus.classList.remove('is-attention');
  courseDataIndicator.classList.add('is-complete');
  courseDataIndicator.classList.remove('is-attention');
  holeDataMessage.textContent =
    'Hole pars and yardages are available for this course and tees.';
  courseDataLabel.classList.remove('is-attention');
}
function setCourseAttention(message) {
  courseDataStatus.textContent =
    message;
  courseDataStatus.classList.add('is-attention');
  courseDataStatus.classList.remove('is-complete');
  courseDataIndicator.classList.add('is-attention');
  courseDataIndicator.classList.remove('is-complete');
  holeDataMessage.textContent =
    'You can add or correct missing course information before, during, or after the round.';
  courseDataLabel.classList.add('is-attention');
}
function populateCourseDetailsFromCourse() {
  const holesCount = selectedHoles.length || '—';
  const totalYardage = selectedHoles.reduce((sum, hole) => {
    const yardage = hole.yardage ?? hole.yards ?? hole.distance ?? null;
    const value = Number(yardage);
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  const par = calculateCoursePar();
  courseHoles.textContent = holesCount;
  courseYardage.textContent = totalYardage || '—';
  coursePar.textContent = par != null ? par : '—';
  courseRatingSlope.textContent = '—';
  holeDataMessage.textContent =
    'Hole pars and yardages loaded. Select tees to add tee yardage, rating and slope.';
}
function populateCourseDetails(tee) {
  const holesCount =
    selectedHoles.length || 18;
  const yardage =
    tee.yardage ??
    tee.yards ??
    null;
  const par =
    tee.par ??
    calculateCoursePar();
  const rating =
    tee.course_rating ??
    tee.rating ??
    null;
  const slope =
    tee.slope ??
    null;
  courseHoles.textContent =
    holesCount || '—';
  courseYardage.textContent =
    yardage != null
      ? Number(yardage).toLocaleString()
      : '—';
  coursePar.textContent =
    par != null
      ? par
      : '—';
  courseRatingSlope.textContent =
    rating != null && slope != null
      ? `${rating} / ${slope}`
      : '—';
  courseDataStatus.textContent =
    rating == null || slope == null
      ? 'Retrieved — rating/slope missing'
      : 'Course data retrieved';
  courseDataStatus.classList.toggle(
    'is-attention',
    rating == null || slope == null
  );
  courseDataStatus.classList.toggle(
    'is-complete',
    rating != null && slope != null
  );
  courseDataIndicator.classList.toggle(
    'is-attention',
    rating == null || slope == null
  );
  courseDataIndicator.classList.toggle(
    'is-complete',
    rating != null && slope != null
  );
  const selectedTeeName =
    tee.tee_name ||
    tee.name ||
    'Selected tees';
  holeDataMessage.textContent =
    `${selectedTeeName}: ${selectedHoles.length || '—'} hole pars and yardages loaded.`;
  showToast('Course details loaded');
}
function calculateCoursePar() {
  if (!selectedHoles.length) {
    return null;
  }
  const total = selectedHoles.reduce(
    (sum, hole) => {
      const par = Number(hole.par);
      return Number.isFinite(par)
        ? sum + par
        : sum;
    },
    0
  );
  return total || null;
}
/* =========================================================
   COURSE DATA EDITOR
   ========================================================= */
const courseDataScreen = document.getElementById('courseDataScreen');
const courseDataBackBtn = document.getElementById('courseDataBackBtn');
const courseHoleTable = document.getElementById('courseHoleTable');
const courseDataConfirmed = document.getElementById('courseDataConfirmed');
const courseDataTotalPar = document.getElementById('courseDataTotalPar');
const courseDataTotalYards = document.getElementById('courseDataTotalYards');
const courseDataCourseName = document.getElementById('courseDataCourseName');
const courseDataCourseLocation = document.getElementById('courseDataCourseLocation');
const courseDataTeeName = document.getElementById('courseDataTeeName');
const courseDataProfileYardage = document.getElementById('courseDataProfileYardage');
const courseDataProfilePar = document.getElementById('courseDataProfilePar');
const courseDataProfileRatingSlope = document.getElementById('courseDataProfileRatingSlope');
let courseDataReturnScreen = 'roundSetup';
let courseDataConfirmedRows = new Set();

function getHoleValue(hole, keys) {
  for (const key of keys) {
    if (hole && hole[key] != null && hole[key] !== '') return hole[key];
  }
  return '';
}

function getCourseHoleRows() {
  return Array.isArray(selectedHoles) ? selectedHoles : [];
}

function initializeCourseDataConfirmations() {
  const holes = getCourseHoleRows();
  if (!holes.length) {
    courseDataConfirmedRows.clear();
    return;
  }
  const validHoleNumbers = new Set();
  holes.forEach((hole, index) => {
    const holeNumber = Number(getHoleValue(hole, ['hole','hole_number','number'])) || index + 1;
    validHoleNumbers.add(holeNumber);
  });
  courseDataConfirmedRows = new Set(
    [...courseDataConfirmedRows].filter(number => validHoleNumbers.has(number))
  );
  validHoleNumbers.forEach(number => {
    const hole = holes.find((item, index) => {
      const itemNumber = Number(getHoleValue(item, ['hole','hole_number','number'])) || index + 1;
      return itemNumber === number;
    });
    const par = getHolePar(hole);
    const yards = getHoleYardage(hole);
    if (par !== '' && yards !== '') {
      courseDataConfirmedRows.add(number);
    }
  });
}

function getSelectedTeeForEditor() {
  return getSelectedTee();
}

function getSelectedTeeColor() {
  const tee = getSelectedTeeForEditor() || {};
  return String(tee.tee_color || '').trim().toLowerCase();
}

function getHolePar(hole) {
  if (hole && hole.__courseDataDraftPar !== undefined) {
    return hole.__courseDataDraftPar;
  }
  return getHoleValue(hole, ['par', 'hole_par']);
}

function getHoleYardage(hole) {
  if (hole && hole.__courseDataDraftYardage !== undefined) {
    return hole.__courseDataDraftYardage;
  }
  if (hole && hole.__courseDataYardage !== undefined) {
    return hole.__courseDataYardage;
  }
  const teeColor = getSelectedTeeColor();
  if (hole && hole.yardages && teeColor && hole.yardages[teeColor] != null) {
    return hole.yardages[teeColor];
  }
  return getHoleValue(hole, ['yardage', 'yards', 'distance', 'hole_yardage']);
}

function openCourseData(returnScreen = 'roundSetup') {
  courseDataReturnScreen = returnScreen;
  courseDataScreen.hidden = false;
  roundSetupScreen.hidden = true;
  homeScreen.hidden = true;
  bottomNav.hidden = true;
  initializeCourseDataConfirmations();
  renderCourseDataEditor();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function closeCourseData() {
  courseDataScreen.hidden = true;
  if (courseDataReturnScreen === 'home') {
    showHome();
    return;
  }
  showRoundSetup();
}

courseDataBackBtn.addEventListener('click', closeCourseData);

document.getElementById('editHoleYardagesBtn').addEventListener('click', () => {
  openCourseData('roundSetup');
});

function renderCourseDataEditor() {
  const course = selectedCourse || {};
  const tee = getSelectedTeeForEditor() || {};
  const holes = getCourseHoleRows();
  courseDataCourseName.textContent = course.name || course.course_name || 'Selected Course';
  courseDataCourseLocation.textContent = [course.city, course.state].filter(Boolean).join(', ') || '—';
  courseDataTeeName.textContent = tee.tee_name || tee.name || 'Selected Tees';
  const profileYardage = tee.yardage ?? tee.yards ?? calculateHoleYardageTotal();
  courseDataProfileYardage.textContent = profileYardage != null && profileYardage !== '' ? Number(profileYardage).toLocaleString() : '—';
  const profilePar = tee.par ?? calculateCoursePar();
  courseDataProfilePar.textContent = profilePar != null ? profilePar : '—';
  const rating = tee.course_rating ?? tee.rating ?? null;
  const slope = tee.slope ?? null;
  courseDataProfileRatingSlope.textContent = rating != null && slope != null ? `${rating} / ${slope}` : '—';
  if (!holes.length) {
    courseHoleTable.innerHTML = '<div class="hole-data-message">No hole data is currently available for this course.</div>';
    updateCourseDataTotals();
    return;
  }
  courseHoleTable.innerHTML = holes.map((hole, index) => {
    const holeNumber = Number(getHoleValue(hole, ['hole','hole_number','number'])) || index + 1;
    const par = getHolePar(hole);
    const yards = getHoleYardage(hole);
    const confirmed = courseDataConfirmedRows.has(holeNumber);
    const edited = hole.__courseDataEdited === true;
    const rowClass = [
      'course-hole-row',
      edited ? 'is-edited' : '',
      !confirmed ? 'is-needs-confirmation' : ''
    ].filter(Boolean).join(' ');
    return `
      <div class="${rowClass}" data-hole-number="${holeNumber}">
        <div class="course-hole-number">${holeNumber}</div>
        <div class="course-hole-field">
          <input class="course-hole-par" type="number" min="1" max="9" inputmode="numeric" value="${escapeHtml(par)}" aria-label="Hole ${holeNumber} par">
        </div>
        <div class="course-hole-field">
          <input class="course-hole-yards" type="number" min="1" max="999" inputmode="numeric" value="${escapeHtml(yards)}" aria-label="Hole ${holeNumber} yards">
        </div>
        <button class="course-hole-check ${confirmed ? 'is-confirmed' : ''}" type="button" aria-label="${confirmed ? 'Confirmed' : 'Check hole to save'}">${confirmed ? '✓' : '✓'}</button>
      </div>`;
  }).join('');
  courseHoleTable.querySelectorAll('.course-hole-row').forEach(row => {
    const holeNumber = Number(row.dataset.holeNumber);
    row.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', () => {
        const hole = holes.find((item, index) => (Number(getHoleValue(item, ['hole','hole_number','number'])) || index + 1) === holeNumber);
        if (!hole) return;
        hole.__courseDataEdited = true;
        const parInput = row.querySelector('.course-hole-par');
        const yardsInput = row.querySelector('.course-hole-yards');
        hole.__courseDataDraftPar = parInput.value.trim();
        hole.__courseDataDraftYardage = yardsInput.value.trim();
        courseDataConfirmedRows.delete(holeNumber);
        row.classList.add('is-edited','is-needs-confirmation');
        row.querySelector('.course-hole-check').classList.remove('is-confirmed');
        updateCourseDataTotals();
      });
    });
    row.querySelector('.course-hole-check').addEventListener('click', () => {
      const hole = holes.find((item, index) => (Number(getHoleValue(item, ['hole','hole_number','number'])) || index + 1) === holeNumber);
      if (!hole) return;
      const parInput = row.querySelector('.course-hole-par');
      const yardsInput = row.querySelector('.course-hole-yards');
      if (parInput.value.trim() === '' || yardsInput.value.trim() === '') {
        showToast('Enter Par and Yards before saving this hole');
        return;
      }
      hole.par = Number(parInput.value);
      hole.__courseDataYardage = Number(yardsInput.value);
      delete hole.__courseDataDraftPar;
      delete hole.__courseDataDraftYardage;
      hole.__courseDataEdited = false;
      courseDataConfirmedRows.add(holeNumber);
      row.classList.remove('is-needs-confirmation');
      row.classList.add('is-edited');
      row.querySelector('.course-hole-check').classList.add('is-confirmed');
      updateCourseDataTotals();
      updateRoundSetupCourseDetails();
      showToast(`Hole ${holeNumber} saved`);
    });
  });
  updateCourseDataTotals();
}

function calculateHoleYardageTotal() {
  const holes = getCourseHoleRows();
  const total = holes.reduce((sum, hole) => {
    const value = Number(getHoleYardage(hole));
    return Number.isFinite(value) ? sum + value : sum;
  }, 0);
  return total || null;
}

function updateCourseDataTotals() {
  const holes = getCourseHoleRows();
  let parTotal = 0;
  let yardTotal = 0;
  let parCount = 0;
  let yardCount = 0;
  holes.forEach((hole, index) => {
    const par = Number(getHolePar(hole));
    const yards = Number(getHoleYardage(hole));
    if (Number.isFinite(par)) { parTotal += par; parCount++; }
    if (Number.isFinite(yards)) { yardTotal += yards; yardCount++; }
  });
  courseDataTotalPar.textContent = parCount ? parTotal : '—';
  courseDataTotalYards.textContent = yardCount ? yardTotal.toLocaleString() : '—';
  courseDataConfirmed.textContent = `${courseDataConfirmedRows.size} of ${holes.length || 18} holes confirmed`;
}

function updateRoundSetupCourseDetails() {
  const tee = getSelectedTeeForEditor();
  if (!tee) return;
  const holeTotal = calculateHoleYardageTotal();
  const parTotal = calculateCoursePar();
  courseHoles.textContent = selectedHoles.length || '—';
  courseYardage.textContent = tee.yardage != null ? Number(tee.yardage).toLocaleString() : (holeTotal || '—');
  coursePar.textContent = tee.par != null ? tee.par : (parTotal || '—');
}

/* =========================================================
   START ROUND
   ========================================================= */
document
  .getElementById('beginRoundBtn')
  .addEventListener('click', () => {
    showToast('Round Setup saved — Hole screen comes next');
  });
/* =========================================================
   BOTTOM NAVIGATION
   ========================================================= */
document.querySelectorAll('[data-nav]').forEach(button => {
  button.addEventListener('click', () => {
    document
      .querySelectorAll('[data-nav]')
      .forEach(item => {
        item.classList.remove('active');
      });
    button.classList.add('active');
    if (button.dataset.nav === 'home') {
      showHome();
      return;
    }
    showToast(
      `${button.textContent.trim()} — prototype navigation`
    );
  });
});
/* =========================================================
   CLUBHOUSE PROTOTYPE HELPER
   ========================================================= */
window.setClubhouseState = function(state = 'clear') {
  const status =
    document.getElementById('clubhouseStatus');
  const context =
    document.getElementById('clubhouseContext');
  const needsAttention =
    state === 'attention';
  status.classList.toggle(
    'is-clear',
    !needsAttention
  );
  status.classList.toggle(
    'needs-attention',
    needsAttention
  );
  status.textContent =
    needsAttention
      ? '2 details need attention.'
      : 'You’re all caught up.';
  context.textContent =
    needsAttention
      ? 'Meadows GC · Sep 8'
      : 'Review rounds or add follow-up details.';
};
/* =========================================================
   SMALL HTML SAFETY HELPER
   ========================================================= */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
/* Future recreational account configuration */
function configureRoundTypeForAccount() {
  if (ACCOUNT_TYPE !== 'recreational') return;
  roundTypeSelect.innerHTML = `
    <option value="" selected>Select Round Type</option>
    <option value="practice">Practice Round</option>
    <option value="mens-club">Men's Club</option>
    <option value="tournament">Tournament</option>
    <option value="corporate">Corporate Event</option>
    <option value="buddy">Buddy Round</option>
    <option value="other">Other Event</option>
  `;
}
configureRoundTypeForAccount();
