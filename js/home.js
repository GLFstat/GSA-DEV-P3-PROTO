// Diagnostic release marker; no scoring logic changed.
window.STRACKER_HOME_JS_RELEASE = '20261023-6';
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
const roundRecoveryScreen = document.getElementById('roundRecoveryScreen');
const roundSetupScreen = document.getElementById('roundSetupScreen');
const bottomNav = document.getElementById('bottomNav');
const homeDestinationScreen = document.getElementById('homeDestinationScreen');
const setupBackBtn = document.getElementById('setupBackBtn');
// Use the device's local calendar date on the Home welcome strip.
function updateWelcomeDate() {
  const element = document.querySelector('.welcome-strip .today');
  if (!element) return;
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  element.dateTime = `${year}-${month}-${day}`;
  element.textContent = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
updateWelcomeDate();
// Prototype-only active-round state (retained during screen navigation).
let roundInProgress = false;
let editingActiveRoundSetup = false;
let activeHoleNumber = null;
let roundHoleOrder = [];
let roundStartingHole = null;
let turnShownThisRound = false;
let roundCompleteAcknowledged = false;
// Stage 2: temporary, in-memory drafts keyed by actual course hole number.
const holeStatDrafts = new Map();
const savedHoleStats = new Map();
// Shared completion check for Home, Recovery, and the completed scorecard.
function isRoundCompletedForReview() {
  return roundInProgress && roundCompleteAcknowledged &&
    roundHoleOrder.length > 0 && roundHoleOrder.every(hole => savedHoleStats.has(hole));
}
function updateHomeRoundButton() {
  const completed = isRoundCompletedForReview();
  const button = document.querySelector('#homeScreen .start-round');
  const label = button?.querySelector('span:first-child');
  if (label) label.textContent = completed ? 'RETURN TO LAST ROUND ' : roundInProgress ? 'RESUME ROUND ' : 'START A NEW ROUND ';
  button?.classList.toggle('is-completed-round', completed);
  const chevron = button?.querySelector('.double-chevron');
  if (chevron) chevron.textContent = completed ? '»»' : '»';
  const newButton = document.getElementById('homeNewRoundBtn');
  if (newButton) newButton.hidden = !roundInProgress;
}
function showHome() {
  roundRecoveryScreen.hidden = true;
  updateWelcomeDate();
  setScorebarOpen(false);
  scorebarPanel.hidden = true;
  holeStatsScreen.hidden = true;
  courseDataScreen.hidden = true;
  roundSetupScreen.hidden = true;
  homeDestinationScreen.hidden = true;
  homeScreen.hidden = false;
  bottomNav.hidden = false;
  updateHomeRoundButton();
  updateCompletedRoundActions();
  persistActiveRound();
  window.scrollTo({
    top: 0,
    behavior: 'instant'
  });
}
function updateBeginRoundLabel() {
  const label = document.querySelector('#beginRoundBtn .start-round-label');
  if (label) label.textContent = editingActiveRoundSetup && roundInProgress ? 'RESUME ROUND' : 'START ROUND';
}
function showRoundSetup(options = {}) {
  roundRecoveryScreen.hidden = true;
  setScorebarOpen(false);
  scorebarPanel.hidden = true;
  holeStatsScreen.hidden = true;
  courseDataScreen.hidden = true;
  homeScreen.hidden = true;
  homeDestinationScreen.hidden = true;
  roundSetupScreen.hidden = false;
  bottomNav.hidden = true;
  roundSetupScreen.scrollTop = 0;
  updateBeginRoundLabel();
  if (options.restoreCourseDetails) {
    requestAnimationFrame(() => {
      const details = roundSetupScreen.querySelector('.course-data-card');
      if (!details) return;
      const target = details.closest('.setup-section') || details;
      const top = target.getBoundingClientRect().top - roundSetupScreen.getBoundingClientRect().top + roundSetupScreen.scrollTop - 12;
      roundSetupScreen.scrollTop = Math.max(0, top);
    });
  }
  window.scrollTo({
    top: 0,
    behavior: 'instant'
  });
}
setupBackBtn.addEventListener('click', () => {
  if (editingActiveRoundSetup) {
    editingActiveRoundSetup = false;
    showHoleStatsDemo(true);
  } else {
    showHome();
  }
});
/* =========================================================
   HOME CARDS
   ========================================================= */
const startNewRoundBtn = document.querySelector('.start-round');
startNewRoundBtn.addEventListener('click', () => {
  if (roundInProgress) {
    showHoleStatsDemo(true);
  } else {
    setupCompletionScrollDone = false;
    showRoundSetup();
  }
});

const homeDestinations = {
  'last-round': {
    title: 'YOUR LAST ROUND', intro: 'Details from the most recent completed round.',
    section: 'ROUND OVERVIEW', detail: 'This screen will show the course, date, scoring totals, and hole-by-hole results. Live round data is not connected yet.'
  },
  'summary': {
    title: 'LAST ROUND SUMMARY', intro: 'Performance statistics from the most recent completed round.',
    section: 'PERFORMANCE BREAKDOWN', detail: 'FIR, GIR, putts, penalties, and other round statistics will appear here once live scoring is connected.'
  },
  'clubhouse': {
    title: 'CLUBHOUSE', intro: 'Review rounds and complete post-round follow-up details.',
    section: 'ROUND FOLLOW-UP', detail: 'The Clubhouse workflow will be connected after scoring and round persistence are working.'
  },
  'my-game': {
    title: 'MY GAME', intro: 'Personal strokes gained, development insights, and performance trends.',
    section: 'PLAYER INSIGHTS', detail: 'This screen will become the home for personal strokes gained and development charts.'
  },
  'history': {
    title: 'HISTORY', intro: 'Review saved rounds, statistics, trends, and charts.',
    section: 'ROUND HISTORY', detail: 'Saved rounds and historical comparisons will be available here after data persistence is connected.'
  }
};
const performanceViews = [
  { title: 'Round Overview', description: 'Score, course, date, conditions and basic round details', metrics: [['78','SCORE'],['+6','VS PAR'],['18','HOLES']] },
  { title: 'Scoring Statistics', description: 'Fairways, greens, putting and penalties', metrics: [['53%','FIR'],['58%','GIR'],['34','PUTTS']] },
  { title: 'Performance Insights', description: 'Personal Strokes Gained and round-specific observations', metrics: [['—','PSG'],['—','INSIGHTS'],['—','TRENDS']] }
];
let performanceViewIndex = 0;
function renderPerformanceView() {
  const view = performanceViews[performanceViewIndex];
  document.getElementById('performanceCounter').textContent = `VIEW ${performanceViewIndex + 1} OF ${performanceViews.length}`;
  document.getElementById('performanceViewTitle').textContent = view.title;
  document.getElementById('performanceDescription').textContent = view.description;
  document.getElementById('performanceMetrics').innerHTML = view.metrics.map(([value,label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join('');
  document.getElementById('performanceDots').innerHTML = performanceViews.map((_,i) => `<span class="${i===performanceViewIndex?'active':''}"></span>`).join('');
  document.getElementById('performancePrev').disabled = performanceViewIndex === 0;
  document.getElementById('performanceNext').disabled = performanceViewIndex === performanceViews.length-1;
}
document.getElementById('performancePrev').addEventListener('click', () => { performanceViewIndex = Math.max(0,performanceViewIndex-1); renderPerformanceView(); });
document.getElementById('performanceNext').addEventListener('click', () => { performanceViewIndex = Math.min(performanceViews.length-1,performanceViewIndex+1); renderPerformanceView(); });
function showHomeDestination(action) {
  const destination = homeDestinations[action];
  if (!destination) return;
  // Leave the launch-time recovery screen before opening a footer destination.
  // This only changes visibility; the active round and saved holes are preserved.
  roundRecoveryScreen.hidden = true;
  setScorebarOpen(false);
  scorebarPanel.hidden = true;
  holeStatsScreen.hidden = true;
  courseDataScreen.hidden = true;
  roundSetupScreen.hidden = true;
  homeScreen.hidden = true;
  homeDestinationScreen.hidden = false;
  bottomNav.hidden = false;
  const recent = action === 'last-round' || action === 'summary';
  const clubhouse = action === 'clubhouse';
  document.getElementById('destinationPhotoHeader').classList.toggle('is-clubhouse-header', clubhouse);
  document.getElementById('recentPerformanceViews').hidden = !recent;
  document.getElementById('clubhousePreview').hidden = !clubhouse;
  document.getElementById('otherDestinationViews').hidden = recent || clubhouse;
  if (clubhouse) renderClubhousePreview();
  document.getElementById('destinationHeaderKicker').textContent = recent ? 'RECENT PERFORMANCE' : 'YOUR GOLF GAME';
  document.getElementById('destinationHeaderName').textContent = recent ? 'Isaiah Gonzales' : destination.title;
  if (recent) {
    performanceViewIndex = action === 'summary' ? 1 : 0;
    renderPerformanceView();
  } else {
    document.getElementById('destinationTitle').textContent = destination.title;
    document.getElementById('destinationIntro').textContent = destination.intro;
    document.getElementById('destinationSectionTitle').textContent = destination.section;
    document.getElementById('destinationDetail').textContent = destination.detail;
  }
  homeDestinationScreen.scrollTop = 0;
}
// Team-ready boundary: Clubhouse receives only the currently selected player's round context.
function renderClubhousePreview() {
  window.StrackerClubhouse.render({
    selectedCourse, roundInProgress, roundTypeSelect, roundLengthSelect,
    roundHoleOrder, savedHoleStats, holeParForNumber, formatToPar,
    roundCompleted: isRoundCompletedForReview()
  });
}
document.getElementById('clubhouseReturnRound').addEventListener('click', () => {
  if (!roundInProgress) return;
  persistActiveRound();
  showHoleStatsDemo(true);
});
// Keep the app-level menu aligned with the scrolling Clubhouse photo header.
const clubhouseScrollScreen = document.getElementById('homeDestinationScreen');
clubhouseScrollScreen.addEventListener('scroll', () => {
  const clubhouseVisible = !clubhouseScrollScreen.hidden &&
    !document.getElementById('clubhousePreview').hidden;
  document.querySelector('.app').style.setProperty('--clubhouse-scroll',
    `${clubhouseVisible ? Math.min(176, clubhouseScrollScreen.scrollTop) : 0}px`);
}, { passive: true });
document.getElementById('destinationBackBtn').addEventListener('click', showHome);
document.querySelectorAll('#homeScreen [data-action]:not(.start-round)').forEach(button => {
  button.addEventListener('click', () => showHomeDestination(button.dataset.action));
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
// Move to Course Details once, when the five required setup choices are complete.
let setupCompletionScrollDone = false;
function maybeScrollToCourseDetails() {
  const allSelected = Boolean(
    roundTypeSelect.value && selectedCourse && teeSelect.value &&
    roundLengthSelect.value && startingHoleSelect.value
  );
  if (!allSelected) {
    setupCompletionScrollDone = false;
    return;
  }
  if (setupCompletionScrollDone || roundSetupScreen.hidden || editingActiveRoundSetup) return;
  setupCompletionScrollDone = true;
  // Allow the native select menu to dismiss before beginning the gentle scroll.
  setTimeout(() => {
    if (roundSetupScreen.hidden) return;
    const details = roundSetupScreen.querySelector('.course-data-card');
    if (!details) return;
    const target = details.closest('.setup-section') || details;
    const top = target.getBoundingClientRect().top -
      roundSetupScreen.getBoundingClientRect().top + roundSetupScreen.scrollTop - 12;
    roundSetupScreen.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, 220);
}

function updateSelectState(select) {
  const hasValue = Boolean(select.value);
  select.classList.toggle('is-unselected', !hasValue);
  select.classList.toggle('is-selected', hasValue);
  if (!hasValue) select.classList.remove('is-editing');
}

function beginSelectEdit(select) {
  if (select.value && !select.disabled) select.classList.add('is-editing');
}

[roundTypeSelect, roundLengthSelect, teeSelect, startingHoleSelect].forEach(select => {
  select.addEventListener('pointerdown', () => beginSelectEdit(select));
  select.addEventListener('focus', () => beginSelectEdit(select));
  select.addEventListener('change', () => {
    select.classList.remove('is-editing');
    updateSelectState(select);
  });
  select.addEventListener('blur', () => {
    select.classList.remove('is-editing');
    updateSelectState(select);
  });
});
roundTypeSelect.addEventListener('change', () => {
  updateSelectState(roundTypeSelect);
  maybeScrollToCourseDetails();
});
roundLengthSelect.addEventListener('change', () => {
  updateSelectState(roundLengthSelect);
  maybeScrollToCourseDetails();
});
startingHoleSelect.addEventListener('change', () => {
  updateSelectState(startingHoleSelect);
  maybeScrollToCourseDetails();
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
let lastCourseSearchQuery = '';
let lastCourseSearchResults = [];
/* Open the search panel every time the Course card is tapped. */
courseSelectBtn.addEventListener('click', openCourseSearch);
function openCourseSearch() {
  courseSearchPanel.hidden = false;
  courseSearchPanel.classList.toggle('has-selected-course', Boolean(selectedCourse));
  courseSelectBtn.classList.add('is-editing');

  if (lastCourseSearchResults.length) {
    courseSearchInput.value = lastCourseSearchQuery;
    renderCourseResults(lastCourseSearchResults);
  } else {
    courseSearchInput.value = '';
    courseSearchResults.innerHTML = '';
    courseSearchStatus.textContent =
      'Type at least 2 characters to search.';
  }

  // Focus immediately within the user's tap handler so mobile browsers can
  // open the keyboard without requiring a second tap.
  courseSearchInput.focus({ preventScroll: true });
  // Returning to search? Highlight the previous query for quick replacement.
  if (courseSearchInput.value) courseSearchInput.select();
}
courseSearchCloseBtn.addEventListener(
  'click',
  closeCourseSearch
);
function closeCourseSearch() {
  courseSearchPanel.hidden = true;
  courseSelectBtn.classList.remove('is-editing');
}
/* Search as the golfer types, with a short debounce. */
courseSearchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const query = courseSearchInput.value.trim();
  lastCourseSearchQuery = query;
  if (query.length < 2) {
    lastCourseSearchResults = [];
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
    lastCourseSearchQuery = query;
    lastCourseSearchResults = courses;
    renderCourseResults(courses);
    revealCourseSearchResults();
  } catch (error) {
    console.error('OpenGolfAPI course search:', error);
    courseSearchStatus.textContent =
      'Course search is temporarily unavailable.';
    courseSearchResults.innerHTML = '';
  }
}
// On iPhone the keyboard can cover search results. Keep the panel heading
// directly below the sticky header so the first matches are visible.
function revealCourseSearchResults() {
  if (courseSearchPanel.hidden || roundSetupScreen.hidden || !courseSearchInput.matches(':focus')) return;
  const align = () => {
    if (courseSearchPanel.hidden || roundSetupScreen.hidden || !courseSearchInput.matches(':focus')) return;
    const panelTop = courseSearchPanel.getBoundingClientRect().top;
    const screenTop = roundSetupScreen.getBoundingClientRect().top;
    const headerHeight = roundSetupScreen.querySelector('.setup-header')?.getBoundingClientRect().height || 88;
    const target = roundSetupScreen.scrollTop + panelTop - screenTop - headerHeight - 4;
    roundSetupScreen.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  };
  requestAnimationFrame(align);
  // iOS keyboard animation can change the visual viewport after results render.
  setTimeout(align, 250);
}

function revealSelectedCourse() {
  if (roundSetupScreen.hidden) return;
  const courseSection = courseSelectBtn.closest('.setup-section');
  if (!courseSection) return;
  const headerHeight = roundSetupScreen.querySelector('.setup-header')?.getBoundingClientRect().height || 88;
  const target = roundSetupScreen.scrollTop + courseSection.getBoundingClientRect().top -
    roundSetupScreen.getBoundingClientRect().top - headerHeight - 8;
  roundSetupScreen.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
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
    if (selectedCourse && String(course.id) === String(selectedCourse.id)) {
      button.classList.add('is-current-course');
    }
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
  setupCompletionScrollDone = false;
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
  // Confirm the chosen course visibly instead of jumping directly to Tees.
  requestAnimationFrame(revealSelectedCourse);
  await loadCourseData(course.id);
  requestAnimationFrame(revealSelectedCourse);
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
    // Fetch the full course record as well as the focused tee/hole endpoints.
    // OpenGolf's full course response can contain richer scorecard/tee yardage
    // information than the focused endpoints, so keep it as a fallback source.
    const [courseResponse, teesResponse, holesResponse] = await Promise.all([
      fetch(`${API_BASE}/courses/${courseId}`),
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
    const courseData = courseResponse.ok ? await courseResponse.json() : {};
    const teesData = await teesResponse.json();
    const holesData = await holesResponse.json();

    const focusedTees = normalizeArray(teesData);
    const focusedHoles = normalizeArray(holesData);
    const richTees = Array.isArray(courseData.tees) ? courseData.tees : [];
    const richHoles = Array.isArray(courseData.holes)
      ? courseData.holes
      : Array.isArray(courseData.scorecard)
        ? courseData.scorecard
        : [];

    selectedTees = mergeTeeData(focusedTees, richTees);
    selectedHoles = mergeHoleData(focusedHoles, richHoles);
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

function normalizeTeeIdentity(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function teeIdentityCandidates(tee = {}) {
  return [
    tee.id, tee.tee_id, tee.tee_key, tee.key,
    tee.tee_name, tee.name, tee.tee_color, tee.color
  ].filter(Boolean).map(normalizeTeeIdentity);
}

function mergeTeeData(primary, richer) {
  if (!richer.length) return primary;
  return primary.map(tee => {
    const keys = teeIdentityCandidates(tee);
    const match = richer.find(candidate =>
      teeIdentityCandidates(candidate).some(key => keys.includes(key))
    );
    return match ? { ...match, ...tee } : tee;
  });
}

function mergeHoleData(primary, richer) {
  if (!richer.length) return primary;
  return primary.map((hole, index) => {
    const number = Number(hole.hole_number ?? hole.number ?? hole.hole ?? index + 1);
    const match = richer.find((candidate, richIndex) =>
      Number(candidate.hole_number ?? candidate.number ?? candidate.hole ?? richIndex + 1) === number
    );
    if (!match) return hole;
    // Keep focused endpoint values, but retain any richer tee/scorecard fields.
    return { ...match, ...hole };
  });
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

  // Keep the array behind the dropdown in exactly the same order as
  // the options the golfer sees. Otherwise a filtered tee list can
  // point at the wrong tee object when an option is selected.
  selectedTees = usableTees;

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
  maybeScrollToCourseDetails();
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
  maybeScrollToCourseDetails();
});
function getSelectedTee() {
  // An empty selection must not resolve to tee index 0 (Number('') === 0).
  if (teeSelect.value === '') return null;
  const index = Number(teeSelect.value);
  return Number.isInteger(index) && index >= 0
    ? (selectedTees[index] || null)
    : null;
}
/* =========================================================
   COURSE DETAILS
   ========================================================= */
const courseDataStatus =
  document.getElementById('courseDataStatus');

const courseDataLabel =
  document.querySelector('.course-data-label');
const courseDataCard = document.querySelector('.course-data-card');

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
  courseDataStatus.textContent = 'Waiting for course data';
  courseDataStatus.classList.remove(
    'is-complete',
    'is-attention'
  );
  courseDataIndicator.classList.remove('is-complete');
  courseDataIndicator.classList.add('is-attention');
  courseDataStatus.classList.add('is-attention');
  holeDataMessage.textContent =
    'Choose a course and tees to retrieve hole yardages, pars, rating and slope.';
  courseDataCard.classList.remove('is-setup-complete');
}
// Confirmed course name: preserve the phrase beginning with "At" on a new line.
function formatConfirmedCourseName() {
  if (!selectedCourse) return;
  const name = String(selectedCourse.name || selectedCourse.course_name || 'Course data retrieved').trim();
  const match = /\s+at\s+/i.exec(name);
  courseDataStatus.replaceChildren();
  if (match && match.index > 0) {
    const first = document.createElement('span');
    first.className = 'course-status-line';
    first.textContent = name.slice(0, match.index);
    const second = document.createElement('span');
    second.className = 'course-status-line';
    second.textContent = name.slice(match.index).trim();
    courseDataStatus.append(first, second);
  } else {
    courseDataStatus.textContent = name;
  }
}
function setCourseReady() {
  formatConfirmedCourseName();
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
  courseDataLabel.classList.remove('is-attention');
}
function populateCourseDetailsFromCourse() {
  // Course-level hole records may include multiple layouts. Do not treat
  // their combined count or par as the selected round's course details.
  courseHoles.textContent = '—';
  courseYardage.textContent = '—';
  coursePar.textContent = '—';
  courseRatingSlope.textContent = '—';
  holeDataMessage.textContent =
    'Select tees to review the course profile and hole information.';
  if (selectedHoles.length !== 18) {
    console.warn('Stracker: unexpected course hole count', {
      course: selectedCourse?.name || selectedCourse?.course_name,
      count: selectedHoles.length,
      holeNumbers: selectedHoles.map((hole, index) =>
        hole.hole_number ?? hole.number ?? hole.hole ?? index + 1)
    });
  }
}
function populateCourseDetails(tee) {
  const holesCount =
    getCourseHoleRows().length === 18 ? 18 : '—';
  const yardage =
    tee.yardage ??
    tee.yards ??
    null;
  const par =
    tee.par ??
    (getCourseHoleRows().length === 18 ? calculateCoursePar() : null);
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
  const invalidHoleCount = getCourseHoleRows().length !== 18;
  const incompleteProfile = invalidHoleCount || rating == null || slope == null;
  courseDataStatus.textContent = invalidHoleCount
    ? `Review course data — ${selectedHoles.length} hole records returned`
    : rating == null || slope == null
      ? 'Retrieved — rating/slope missing'
      : (selectedCourse?.name || selectedCourse?.course_name || 'Course data retrieved');
  if (!incompleteProfile) formatConfirmedCourseName();
  courseDataStatus.classList.toggle(
    'is-attention',
    incompleteProfile
  );
  courseDataStatus.classList.toggle(
    'is-complete',
    !incompleteProfile
  );
  courseDataIndicator.classList.toggle(
    'is-attention',
    incompleteProfile
  );
  courseDataIndicator.classList.toggle(
    'is-complete',
    !incompleteProfile
  );
  const selectedTeeName =
    tee.tee_name ||
    tee.name ||
    'Selected tees';
  holeDataMessage.textContent = invalidHoleCount
    ? `${selectedTeeName}: ${selectedHoles.length} hole records need review; yardages may be missing.`
    : `${selectedTeeName}: review the 18 hole pars and yardages.`;
  courseDataCard.classList.add('is-setup-complete');
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
const courseDataFloatingBackBtn = document.getElementById('courseDataFloatingBackBtn');
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
let courseDataTargetHole = null;
let courseDataConfirmedRows = new Set();

function getHoleValue(hole, keys) {
  for (const key of keys) {
    if (hole && hole[key] != null && hole[key] !== '') return hole[key];
  }
  return '';
}

// An OpenGolf hole endpoint can contain trailing placeholder records.
// Only resolve an oversized course to 18 holes when the first 18 have
// sequential numbers, their par matches the selected tee, and exactly one
// complete per-hole yardage set totals the selected tee's published yardage.
// This is deliberately data-driven: never equate a generic key (e.g. "web")
// to a tee color or trim a course solely because it has more than 18 records.
function getValidatedCourseHoles() {
  if (!Array.isArray(selectedHoles)) return [];
  if (selectedHoles.length <= 18) return selectedHoles;
  const tee = getSelectedTee();
  if (!tee) return selectedHoles;
  const expectedYards = yardageNumber(tee.yardage ?? tee.yards);
  const expectedPar = Number(tee.par);
  if (expectedYards === '' || !Number.isFinite(expectedPar)) return selectedHoles;
  const first18 = selectedHoles.slice(0, 18);
  if (!first18.every((hole, index) =>
    Number(hole?.hole_number ?? hole?.number ?? hole?.hole) === index + 1 &&
    Number.isFinite(Number(hole?.par))
  )) return selectedHoles;
  if (first18.reduce((sum, hole) => sum + Number(hole.par), 0) !== expectedPar) {
    return selectedHoles;
  }
  const yardages = first18[0]?.yardages;
  if (!yardages || Array.isArray(yardages) || typeof yardages !== 'object') {
    return selectedHoles;
  }
  const matches = Object.keys(yardages).filter(key => {
    const values = first18.map(hole => yardageNumber(hole?.yardages?.[key]));
    return values.every(value => value !== '') &&
      values.reduce((sum, value) => sum + value, 0) === expectedYards;
  });
  return matches.length === 1 ? first18 : selectedHoles;
}

function getCourseHoleRows() {
  return getValidatedCourseHoles();
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

function normalizeTeeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function getSelectedTeeIndex() {
  if (teeSelect.value === '') return -1;
  const index = Number(teeSelect.value);
  return Number.isInteger(index) && index >= 0 ? index : -1;
}

function getSelectedTeeYardageKeys() {
  const tee = getSelectedTeeForEditor() || {};
  return [
    tee.id,
    tee.tee_id,
    tee.tee_key,
    tee.key,
    tee.tee_color,
    tee.color,
    tee.tee_name,
    tee.name,
    tee.label
  ]
    .map(normalizeTeeKey)
    .filter(Boolean);
}

function getHolePar(hole) {
  if (hole && hole.__courseDataDraftPar !== undefined) {
    return hole.__courseDataDraftPar;
  }
  return getHoleValue(hole, ['par', 'hole_par']);
}

function yardageNumber(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'number' || typeof value === 'string') {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : '';
  }
  if (typeof value === 'object') {
    for (const key of ['yardage', 'yards', 'distance', 'value', 'length']) {
      if (value[key] != null && value[key] !== '') {
        const number = Number(value[key]);
        if (Number.isFinite(number) && number > 0) return number;
      }
    }
  }
  return '';
}

function getTeeHoleYardage(tee, hole) {
  if (!tee || !hole) return '';
  const holeNumber = Number(
    getHoleValue(hole, ['hole', 'hole_number', 'number'])
  );
  if (!holeNumber) return '';

  // Some OpenGolf course records keep the 18 distances on the tee record.
  // Support the common array/object shapes without depending on one schema.
  const sources = [
    tee.hole_yardages,
    tee.holeYardages,
    tee.yardages,
    tee.holes,
    tee.scorecard
  ].filter(Boolean);

  for (const source of sources) {
    if (Array.isArray(source)) {
      const item = source.find((entry, index) => {
        if (typeof entry === 'number' || typeof entry === 'string') {
          return index + 1 === holeNumber;
        }
        return Number(entry?.hole_number ?? entry?.hole ?? entry?.number ?? index + 1) === holeNumber;
      });
      const value = yardageNumber(item);
      if (value !== '') return value;
    } else if (typeof source === 'object') {
      const direct = source[holeNumber] ?? source[String(holeNumber)];
      const value = yardageNumber(direct);
      if (value !== '') return value;
    }
  }
  return '';
}

function getCompleteHoleYardageSets() {
  const holes = getCourseHoleRows();
  if (holes.length !== 18) return [];

  const firstYardages = holes[0]?.yardages;
  if (!firstYardages || Array.isArray(firstYardages) || typeof firstYardages !== 'object') {
    return [];
  }

  const sets = [];
  for (const rawKey of Object.keys(firstYardages)) {
    const values = holes.map(hole => yardageNumber(hole?.yardages?.[rawKey]));
    if (values.length === 18 && values.every(value => value !== '')) {
      sets.push({
        key: rawKey,
        values,
        total: values.reduce((sum, value) => sum + Number(value), 0)
      });
    }
  }
  return sets;
}

function getNumericallyMatchedHoleYardage(hole) {
  const tee = getSelectedTeeForEditor();
  if (!tee || !hole) return '';

  const teeTotal = yardageNumber(tee.yardage ?? tee.yards);
  if (teeTotal === '') return '';

  // API tee-profile totals and the sum of the 18 scorecard holes can differ.
  // Match by numbers only and use the uniquely closest complete 18-hole set as
  // Stracker's editable starting yardages. The tee label/name/color is not used.
  const candidates = getCompleteHoleYardageSets()
    .map(set => ({ ...set, difference: Math.abs(set.total - teeTotal) }))
    .sort((a, b) => a.difference - b.difference);

  if (!candidates.length) return '';
  const best = candidates[0];
  const next = candidates[1] || null;
  if (next && next.difference === best.difference) return '';

  const holes = getCourseHoleRows();
  const index = holes.indexOf(hole);
  return index >= 0 ? best.values[index] : '';
}

function getHoleYardage(hole) {
  if (hole && hole.__courseDataDraftYardage !== undefined) {
    return hole.__courseDataDraftYardage;
  }
  if (hole && hole.__courseDataYardage !== undefined) {
    return hole.__courseDataYardage;
  }

  // First choice: the selected tee record itself owns its 18 hole values.
  // Tee names/colors are display labels only and play no role in selection.
  const tee = getSelectedTeeForEditor();
  const teeLevelValue = getTeeHoleYardage(tee, hole);
  if (teeLevelValue !== '') return teeLevelValue;

  // Second choice: if the API separates complete hole-yardage sets from the
  // tee records, use the uniquely closest complete numerical set as editable
  // starting data rather than leaving all 18 holes blank.
  const numericValue = getNumericallyMatchedHoleYardage(hole);
  if (numericValue !== '') return numericValue;

  // Last choice: a genuinely generic per-hole yardage. Never substitute a
  // different tee merely because its label resembles the selected tee label.
  return getHoleValue(hole, ['yardage', 'yards', 'distance', 'hole_yardage']);
}

function openCourseData(returnScreen = 'roundSetup', targetHole = null) {
  courseDataReturnScreen = returnScreen;
  courseDataTargetHole = targetHole;
  courseDataScreen.hidden = false;
  roundSetupScreen.hidden = true;
  homeScreen.hidden = true;
  bottomNav.hidden = true;
  initializeCourseDataConfirmations();
  renderCourseDataEditor();
  courseDataScreen.scrollTop = 0;
  if (courseDataTargetHole !== null) {
    requestAnimationFrame(() => {
      const row = Array.from(courseHoleTable.querySelectorAll('.course-hole-row'))
        .find(item => Number(item.dataset.holeNumber) === courseDataTargetHole);
      if (!row) return;
      const screenRect = courseDataScreen.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const top = courseDataScreen.scrollTop + rowRect.top - screenRect.top - 165;
      courseDataScreen.scrollTop = Math.max(0, top);
    });
  }
  courseDataFloatingBackBtn.classList.remove('is-pulsing');
  courseDataFloatingBackBtn.classList.remove('is-entering');
  void courseDataFloatingBackBtn.offsetWidth;
  courseDataFloatingBackBtn.classList.add('is-entering');
  courseDataFloatingBackBtn.hidden = false;
  requestAnimationFrame(() => positionCourseDataFloatingBack());
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function closeCourseData() {
  courseDataFloatingBackBtn.hidden = true;
  courseDataScreen.hidden = true;
  if (courseDataReturnScreen === 'holeStats') {
    refreshCurrentHoleDataDisplay();
    showHoleStatsDemo(true);
    return;
  }
  if (courseDataReturnScreen === 'home') {
    showHome();
    return;
  }
  showRoundSetup({ restoreCourseDetails: true });
}

courseDataBackBtn.addEventListener('click', closeCourseData);
courseDataFloatingBackBtn.addEventListener('click', closeCourseData);

function positionCourseDataFloatingBack() {
  const parInput = courseHoleTable.querySelector('.course-hole-par');
  if (!parInput) return;
  const rect = parInput.getBoundingClientRect();
  courseDataFloatingBackBtn.style.left = `${rect.left + rect.width / 2}px`;
}

function startCourseDataBackPulse() {
  courseDataFloatingBackBtn.classList.remove('is-entering');
  courseDataFloatingBackBtn.classList.remove('is-pulsing');
  void courseDataFloatingBackBtn.offsetWidth;
  courseDataFloatingBackBtn.classList.add('is-pulsing');
}

window.addEventListener('resize', () => {
  if (!courseDataScreen.hidden) positionCourseDataFloatingBack();
});

document.getElementById('editHoleYardagesBtn').addEventListener('click', () => {
  openCourseData('roundSetup');
});

function renderCourseDataEditor() {
  const course = selectedCourse || {};
  const tee = getSelectedTeeForEditor() || {};
  const holes = getCourseHoleRows();
  courseDataCourseName.textContent = course.name || course.course_name || 'Selected Course';
  courseDataCourseLocation.textContent = [course.city, course.state].filter(Boolean).join(', ') || '—';
  courseDataTeeName.textContent = tee.tee_name || tee.name || 'Not selected';
  const profileYardage = tee.yardage ?? tee.yards ?? calculateHoleYardageTotal();
  courseDataProfileYardage.textContent = profileYardage != null && profileYardage !== '' ? Number(profileYardage).toLocaleString() : '—';
  const profilePar = tee.par ?? (getCourseHoleRows().length === 18 ? calculateCoursePar() : null);
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
      const wasConfirmed = courseDataConfirmedRows.has(holeNumber);
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
      if (!wasConfirmed) startCourseDataBackPulse();
      updateCourseDataTotals();
      updateRoundSetupCourseDetails();
      showToast(`Hole ${holeNumber} saved`);
      persistActiveRound();
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
  courseHoles.textContent = getCourseHoleRows().length === 18 ? 18 : '—';
  courseYardage.textContent = tee.yardage != null ? Number(tee.yardage).toLocaleString() : (holeTotal || '—');
  coursePar.textContent = tee.par != null ? tee.par : (getCourseHoleRows().length === 18 ? (parTotal || '—') : '—');
}

/* =========================================================
   START ROUND
   ========================================================= */
document
  .getElementById('beginRoundBtn')
  .addEventListener('click', () => {
    const returningToRound = editingActiveRoundSetup;
    editingActiveRoundSetup = false;
    roundInProgress = true;
    if (!returningToRound || activeHoleNumber === null) {
      holeStatDrafts.clear();
      savedHoleStats.clear();
      turnShownThisRound = false;
      roundCompleteAcknowledged = false;
      initializeRoundHoleNavigation();
    }
    showHoleStatsDemo(returningToRound);
    persistActiveRound();
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
    if (homeDestinations[button.dataset.nav]) {
      showHomeDestination(button.dataset.nav);
      return;
    }
    showToast(`${button.textContent.trim()} — prototype navigation`);
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

/* =========================================================
   SLIDE-OUT SCORECARD — SAMPLE DATA ONLY
   ========================================================= */
const holeStatsScreen = document.getElementById('holeStatsScreen');
function getCurrentDemoHoleNumber() {
  return activeHoleNumber ?? Number(startingHoleSelect.value) ?? 1;
}
function initializeRoundHoleNavigation() {
  const available = getCourseHoleRows().map((hole, index) =>
    Number(getHoleValue(hole, ['hole', 'hole_number', 'number'])) || index + 1
  ).filter((n, i, all) => n >= 1 && n <= 18 && all.indexOf(n) === i).sort((a,b) => a-b);
  const validHoles = available.length ? available : Array.from({length:18}, (_,i) => i+1);
  const start = Number(startingHoleSelect.value) || 1;
  const startIndex = validHoles.indexOf(start);
  const rotated = startIndex < 0 ? validHoles : [...validHoles.slice(startIndex), ...validHoles.slice(0,startIndex)];
  const length = Number(roundLengthSelect.value) === 9 ? 9 : 18;
  roundHoleOrder = rotated.slice(0, length);
  roundStartingHole = roundHoleOrder[0];
  activeHoleNumber = roundStartingHole;
  returnHoleAfterEdit = null;
}
function refreshCurrentHoleDataDisplay() {
  const holeNumber = getCurrentDemoHoleNumber();
  document.getElementById('holeCurrentNumber').textContent = `Hole ${holeNumber}`;
  const holes = getCourseHoleRows();
  const hole = holes.find((item, index) =>
    (Number(getHoleValue(item, ['hole', 'hole_number', 'number'])) || index + 1) === holeNumber
  );
  const yards = hole ? getHoleYardage(hole) : '';
  const par = hole ? getHolePar(hole) : '';
  document.getElementById('holeCurrentYards').textContent = yards || '—';
  document.getElementById('holeCurrentPar').textContent = par || '—';
  const index = roundHoleOrder.indexOf(holeNumber);
  document.getElementById('previousHoleBtn').disabled = index <= 0;
  document.getElementById('nextHoleBtn').disabled = index < 0 || index >= roundHoleOrder.length-1;
  renderHoleStatDraft();
  updateSaveHoleButton();
}
let returnHoleAfterEdit = null;
function moveRoundHole(delta) {
  const index = roundHoleOrder.indexOf(activeHoleNumber);
  const next = index + delta;
  if (next < 0 || next >= roundHoleOrder.length) return;
  if (delta < 0 && returnHoleAfterEdit === null) returnHoleAfterEdit = activeHoleNumber;
  activeHoleNumber = roundHoleOrder[next];
  if (activeHoleNumber === returnHoleAfterEdit) returnHoleAfterEdit = null;
  refreshCurrentHoleDataDisplay();
  renderSampleScorebar();
  persistActiveRound();
}
/* =========================================================
   STAGE 2 / STEP 1 — INTERACTIVE HOLE STAT DRAFTS
   No database, browser storage, or completed-hole writes.
   ========================================================= */
// Prototype setting. Player Settings will control this in a later stage.
// Change to 'par' to test the optional start-at-par interaction.
const INITIAL_SCORE_MODE = 'zero';
const holeStatGroups = [
  { key: 'fir', selector: '.hole-stat-trio > div:nth-child(1)' },
  { key: 'gir', selector: '.hole-stat-trio > div:nth-child(2)' },
  { key: 'updown', selector: '.hole-stat-trio > div:nth-child(3)' }
];
const holeCounterGroups = [
  { key: 'putts', selector: '.hole-stat-pair > div:nth-child(1)', min: 0 },
  { key: 'penalties', selector: '.hole-stat-pair > div:nth-child(2)', min: 0 },
  { key: 'score', selector: '.hole-score-sample', min: 0 }
];
function currentHoleDraft() {
  const hole = getCurrentDemoHoleNumber();
  if (!holeStatDrafts.has(hole)) {
    holeStatDrafts.set(hole, {fir:null, gir:null, updown:null, putts:null, penalties:null, score:null});
  }
  return holeStatDrafts.get(hole);
}
function renderHoleStatDraft() {
  const draft = currentHoleDraft();
  for (const {key, selector} of holeStatGroups) {
    const group = holeStatsScreen.querySelector(selector);
    if (!group) continue;
    group.querySelectorAll('.hole-choice').forEach(button => {
      const selected = draft[key] === button.textContent.trim().toUpperCase();
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  for (const {key, selector} of holeCounterGroups) {
    const group = holeStatsScreen.querySelector(selector);
    if (!group) continue;
    const count = group.querySelector('.hole-count');
    if (count) {
      count.textContent = draft[key] === null ? '0' : String(draft[key]);
      count.setAttribute('aria-pressed', String(draft[key] !== null));
      count.classList.toggle('is-confirmed', draft[key] !== null && draft[key] > 0);
    }
    const decrease = group.querySelector('.hole-adjust');
    if (decrease) decrease.disabled = draft[key] === null || draft[key] <= 0;
  }
  updateSaveHoleButton();
}
holeStatsScreen.addEventListener('click', event => {
  if (!roundInProgress) return;
  const choice = event.target.closest('.hole-choice');
  if (choice) {
    const group = holeStatGroups.find(item => choice.closest(item.selector));
    if (!group) return;
    const draft = currentHoleDraft();
    const value = choice.textContent.trim().toUpperCase();
    // A second tap clears an accidental choice back to gray.
    draft[group.key] = draft[group.key] === value ? null : value;
    renderHoleStatDraft();
    persistActiveRound();
    return;
  }
  // Tapping the center value explicitly activates an untouched counter.
  // A displayed 0 is never counted as entered until the player touches it.
  const valueButton = event.target.closest('button.hole-count');
  if (valueButton) {
    const group = holeCounterGroups.find(item => valueButton.closest(item.selector));
    if (!group) return;
    const draft = currentHoleDraft();
    if (draft[group.key] === null) {
      draft[group.key] = group.key === 'score' && INITIAL_SCORE_MODE === 'par'
        ? getCurrentHoleParForDraft() : 0;
      renderHoleStatDraft();
      persistActiveRound();
    }
    return;
  }
  const adjust = event.target.closest('.hole-adjust');
  if (!adjust) return;
  const group = holeCounterGroups.find(item => adjust.closest(item.selector));
  if (!group) return;
  const draft = currentHoleDraft();
  const increment = adjust.getAttribute('aria-label')?.toLowerCase().startsWith('increase');
  const current = draft[group.key];
  const base = current === null ? (group.key === 'score' && INITIAL_SCORE_MODE === 'par' ? getCurrentHoleParForDraft() : 0) : current;
  draft[group.key] = Math.max(group.min, base + (increment ? 1 : -1));
  renderHoleStatDraft();
  persistActiveRound();
});
function getCurrentHoleParForDraft() {
  const par = Number(document.getElementById('holeCurrentPar').textContent);
  return Number.isFinite(par) && par > 0 ? par : 4;
}

document.getElementById('previousHoleBtn').addEventListener('click', () => moveRoundHole(-1));
document.getElementById('nextHoleBtn').addEventListener('click', () => moveRoundHole(1));
// In-round shortcut: use the same editor and return route as the existing link.
document.getElementById('editHoleDataInlineBtn').addEventListener('click', () => {
  if (!roundInProgress) return;
  setScorebarOpen(false);
  scorebarPanel.hidden = true;
  openCourseData('holeStats', getCurrentDemoHoleNumber());
});

document.getElementById('editActiveRoundSetupBtn').addEventListener('click', () => {
  if (!roundInProgress) return;
  editingActiveRoundSetup = true;
  showRoundSetup();
});
const scorebarPanel = document.getElementById('scorebarPanel');
const scorebarTab = document.getElementById('scorebarTab');
const scorebarShade = document.getElementById('scorebarShade');
function holeParForNumber(holeNumber) {
  const holes = getCourseHoleRows();
  const hole = holes.find((item, index) =>
    (Number(getHoleValue(item, ['hole', 'hole_number', 'number'])) || index + 1) === holeNumber
  );
  const par = hole ? Number(getHolePar(hole)) : NaN;
  return Number.isFinite(par) && par > 0 ? par : null;
}
function formatToPar(value) {
  return value === 0 ? 'E' : value > 0 ? `+${value}` : String(value);
}
function updateSaveHoleButton() {
  const button = document.querySelector('.hole-demo-save');
  if (!button) return;
  const draft = currentHoleDraft();
  const par = holeParForNumber(getCurrentDemoHoleNumber());
  button.disabled = !Number.isInteger(draft.score) || draft.score < 1;
  const saved = savedHoleStats.get(getCurrentDemoHoleNumber());
  button.textContent = saved ? 'UPDATE HOLE' : 'SAVE HOLE';
}
function getSavedRoundTotals() {
  const totals = {holes:0, strokes:0, toPar:0, parHoles:0, firYes:0, firCount:0,
    girYes:0, girCount:0, putts:0, puttsCount:0, penalties:0, penaltiesCount:0};
  for (const hole of roundHoleOrder) {
    const entry = savedHoleStats.get(hole);
    const par = holeParForNumber(hole);
    if (!entry) continue;
    totals.holes++;
    totals.strokes += entry.score;
    if (par !== null) { totals.toPar += entry.score - par; totals.parHoles++; }
    if (par !== null && par !== 3 && (entry.fir === 'Y' || entry.fir === 'N')) {
      totals.firCount++;
      if (entry.fir === 'Y') totals.firYes++;
    }
    if (entry.gir === 'Y' || entry.gir === 'N') {
      totals.girCount++;
      if (entry.gir === 'Y') totals.girYes++;
    }
    if (entry.putts !== null) { totals.putts += entry.putts; totals.puttsCount++; }
    if (entry.penalties !== null) { totals.penalties += entry.penalties; totals.penaltiesCount++; }
  }
  return totals;
}
function renderSampleScorebar() {
  const photoHole = document.getElementById('scorebarPhotoHole');
  if (photoHole) photoHole.textContent = `HOLE ${activeHoleNumber ?? roundStartingHole ?? 1}`;
  // Derive the running score only from saved holes with known pars.
  // This works for shotgun starts and for edits to previously saved holes.
  const totals = getSavedRoundTotals();
  // Report the last hole completed consecutively in playing order.
  // The order supports shotgun starts and avoids claiming progress past gaps.
  let throughHole = null;
  for (const hole of roundHoleOrder) {
    if (!savedHoleStats.has(hole)) break;
    throughHole = hole;
  }
  const throughLabel = document.getElementById('scorebarThrough');
  if (throughLabel) throughLabel.textContent = throughHole === null
    ? '(NOT STARTED)' : `(THRU ${throughHole})`;
  const runningScore = document.getElementById('scorebarRunningTotal');
  if (runningScore) {
    runningScore.firstChild.textContent = totals.parHoles ? formatToPar(totals.toPar) : 'E';
    runningScore.classList.toggle('under', totals.parHoles > 0 && totals.toPar < 0);
    runningScore.classList.toggle('over', totals.parHoles > 0 && totals.toPar > 0);
    runningScore.classList.toggle('even', !totals.parHoles || totals.toPar === 0);
    runningScore.setAttribute('aria-label',
      `${totals.parHoles} scored holes with known par; ${formatToPar(totals.toPar)} relative to par`);
  }
  const rows = document.getElementById('scorebarRows');
  rows.replaceChildren();
  for (const hole of roundHoleOrder) {
    const entry = savedHoleStats.get(hole);
    const row = document.createElement('div');
    row.className = 'scorebar-row' + (hole === activeHoleNumber ? ' active-hole' : entry ? ' is-saved' : ' future');
    const number = document.createElement('span');
    number.className = 'scorebar-number';
    number.textContent = hole;
    const result = document.createElement('span');
    result.className = 'scorebar-result';
    const par = holeParForNumber(hole);
    const relative = entry && par !== null ? entry.score - par : null;
    result.textContent = entry ? (relative === null ? '—' : formatToPar(relative)) : (hole === activeHoleNumber ? '●' : '—');
    if (relative !== null) result.classList.add(relative < 0 ? 'under' : relative > 0 ? 'over' : 'even');
    row.append(number, result);
    rows.appendChild(row);
  }
}
// Reusable local-save acknowledgement; never indicates cloud synchronization.
let holeSavedTimer;
function showHoleSavedConfirmation(hole) {
  let overlay = document.getElementById('holeSavedConfirmation');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'holeSavedConfirmation';
    overlay.className = 'hole-saved-confirmation';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<div class="hole-saved-confirmation-card"><span>HOLE</span><span>SAVED</span></div>';
    document.querySelector('.app').appendChild(overlay);
  }
  clearTimeout(holeSavedTimer);
  overlay.classList.remove('is-visible');
  // Restart the animation for consecutive saves without delaying navigation.
  void overlay.offsetWidth;
  overlay.setAttribute('aria-label', `Hole ${hole} saved on this device`);
  overlay.classList.add('is-visible');
  holeSavedTimer = setTimeout(() => overlay.classList.remove('is-visible'), 660);
}
document.querySelector('.hole-demo-save').addEventListener('click', () => {
  const hole = getCurrentDemoHoleNumber();
  const draft = currentHoleDraft();
  const par = holeParForNumber(hole);
  if (!Number.isInteger(draft.score) || draft.score < 1) {
    showToast('Enter a valid hole score first');
    return;
  }
  // Refuse to score from a stale tab BEFORE changing memory or navigating.
  // The other tab's completed hole is authoritative until this tab reloads.
  if (!canSaveHoleFromThisTab(hole)) {
    return;
  }
  const wasSaved = savedHoleStats.has(hole);
  const previousStat = savedHoleStats.get(hole);
  savedHoleStats.set(hole, {...draft});
  // A scored hole must reach durable storage BEFORE advancing the interface.
  if (!persistActiveRound()) {
    if (wasSaved) savedHoleStats.set(hole, previousStat);
    else savedHoleStats.delete(hole);
    showToast('Hole not saved — check other open tabs');
    return;
  }
  const currentIndex = roundHoleOrder.indexOf(hole);
  const returnIndex = roundHoleOrder.indexOf(returnHoleAfterEdit);
  const destinationIndex = wasSaved && returnIndex > currentIndex
    ? returnIndex : currentIndex + 1;
  if (destinationIndex >= 0 && destinationIndex < roundHoleOrder.length) {
    activeHoleNumber = roundHoleOrder[destinationIndex];
    returnHoleAfterEdit = null;
    refreshCurrentHoleDataDisplay();
  } else {
    updateSaveHoleButton();
    showToast(`Hole ${hole} saved — last hole in round`);
  }
  renderSampleScorebar();
  // Progress metadata is secondary: the scored hole is already safely stored.
  persistActiveRound();
  // The Round Complete billboard provides its own save confirmation.
  // Keep HOLE SAVED for interim holes and later edits to an acknowledged completed round.
  if (!isScoringComplete() || roundCompleteAcknowledged) showHoleSavedConfirmation(hole);
  maybeShowAtTurn();
  maybeShowRoundComplete();
});

function setScorebarOpen(open) {
  // Freeze the hole page at its current scroll position while the scorecard is open.
  holeStatsScreen.classList.toggle('scorecard-scroll-locked', open);
  scorebarPanel.classList.toggle('is-open', open);
  scorebarShade.hidden = !open;
  scorebarPanel.setAttribute('aria-hidden', String(!open));
  scorebarTab.setAttribute('aria-expanded', String(open));
  scorebarTab.setAttribute('aria-label', open ? 'Close scorecard' : 'Open scorecard');
  // The score strip is the active layer while expanded: the navigation menu
  // must not overlap it or capture taps until the strip is dismissed.
  if (open) closeGlobalMenu();
  syncGlobalMenuVisibility();
}
// Wrap course names at natural phrase boundaries without leaving a lone final word.
function renderCourseNameHeading(courseName) {
  const el = document.getElementById('holeCourseName');
  if (!el) return;
  const words = String(courseName || 'ROUND IN PROGRESS').trim().toUpperCase().split(/\s+/).filter(Boolean);
  const preferred = new Set(['AT', 'ON', 'BY', 'NEAR', 'OF']);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const style = getComputedStyle(el);
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const maxWidth = el.clientWidth || el.parentElement?.clientWidth || 330;
  const width = value => ctx.measureText(value).width;
  let lines = [words.join(' ')];
  if (words.length > 2 && width(lines[0]) > maxWidth) {
    const candidates = [];
    for (let i = 1; i < words.length - 1; i++) {
      const first = words.slice(0, i).join(' ');
      const second = words.slice(i).join(' ');
      const fits = width(first) <= maxWidth && width(second) <= maxWidth;
      const preferredBreak = preferred.has(words[i]);
      candidates.push({ i, first, second, fits, preferredBreak,
        balance: Math.abs(width(first) - width(second)) });
    }
    const preferredFits = candidates.filter(item => item.preferredBreak && item.fits);
    const fitting = candidates.filter(item => item.fits);
    // Prefer AT above all other connector words when a clean two-line split fits.
    const atFits = preferredFits.filter(item => words[item.i] === 'AT');
    const pool = atFits.length ? atFits : preferredFits.length ? preferredFits : fitting;
    if (pool.length) {
      pool.sort((a,b) => a.balance - b.balance);
      lines = [pool[0].first, pool[0].second];
    } else {
      // Very long names may need three lines. Preserve the last two words together.
      const preferredIndex = words.findIndex((word, i) => i > 0 && i < words.length - 1 && word === 'AT');
      if (preferredIndex > 0) lines = [words.slice(0, preferredIndex).join(' '), words.slice(preferredIndex).join(' ')];
      else lines = [words.join(' ')];
    }
  }
  el.replaceChildren();
  lines.forEach((line, index) => {
    if (index) el.appendChild(document.createElement('br'));
    const span = document.createElement('span');
    // Keep the final two words together if a long phrase needs additional wrapping.
    span.textContent = line.replace(/ (\S+)$/, '\u00a0$1');
    el.appendChild(span);
  });
}
function showHoleStatsDemo(resume = false) {
  roundRecoveryScreen.hidden = true;
  homeScreen.hidden = true;
  roundSetupScreen.hidden = true;
  courseDataScreen.hidden = true;
  bottomNav.hidden = true;
  homeDestinationScreen.hidden = true;
  holeStatsScreen.hidden = false;
  scorebarPanel.hidden = false;
  updateCompletedRoundActions();
  if (!resume) holeStatsScreen.scrollTop = 0;
  const name = selectedCourse?.name || selectedCourse?.course_name || 'ROUND IN PROGRESS';
  renderCourseNameHeading(name);
  if (!roundHoleOrder.length) initializeRoundHoleNavigation();
  refreshCurrentHoleDataDisplay();
  renderSampleScorebar();
  setScorebarOpen(false);
  persistActiveRound();
  window.scrollTo({top:0,behavior:'instant'});
}
// When a scoring control is tapped, align the course bar at the top.
// Repeatable: if the player scrolls back to the photo, another tap restores the view.
holeStatsScreen.addEventListener('click', event => {
  const control = event.target.closest('.hole-choice, .hole-adjust');
  if (!control) return;
  const courseBar = holeStatsScreen.querySelector('.hole-course-strip');
  if (!courseBar) return;
  const destination = holeStatsScreen.scrollTop +
    courseBar.getBoundingClientRect().top - holeStatsScreen.getBoundingClientRect().top;
  // Ignore taps while already aligned; never force an unwanted jump.
  if (Math.abs(destination - holeStatsScreen.scrollTop) < 3) return;
  holeStatsScreen.scrollTo({
    top: Math.max(0, destination),
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
  });
});
scorebarTab.addEventListener('click', () => setScorebarOpen(!scorebarPanel.classList.contains('is-open')));
scorebarShade.addEventListener('click', () => setScorebarOpen(false));
// iOS can rubber-band the page even when the scrolling element has overflow hidden.
// While the scorecard is open, prevent vertical touch movement from reaching the
// background; allow the scorecard's own list to scroll within its bounds.
let scorecardTouchY = null;
document.addEventListener('touchstart', event => {
  if (!scorebarPanel.classList.contains('is-open')) return;
  scorecardTouchY = event.touches.length === 1 ? event.touches[0].clientY : null;
}, { passive: true, capture: true });
document.addEventListener('touchmove', event => {
  if (!scorebarPanel.classList.contains('is-open') || !event.cancelable) return;
  const inner = event.target.closest?.('.scorebar-inner');
  if (!inner || scorecardTouchY === null || event.touches.length !== 1) {
    event.preventDefault();
    return;
  }
  const nextY = event.touches[0].clientY;
  const deltaY = nextY - scorecardTouchY;
  scorecardTouchY = nextY;
  const canScroll = inner.scrollHeight > inner.clientHeight + 1;
  const atTop = inner.scrollTop <= 0;
  const atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 1;
  if (!canScroll || (deltaY > 0 && atTop) || (deltaY < 0 && atBottom)) {
    event.preventDefault();
  }
}, { passive: false, capture: true });

let swipeStart = null;
holeStatsScreen.addEventListener('touchstart', event => {
  if (event.touches.length !== 1) return;
  const touch = event.touches[0];
  swipeStart = {x:touch.clientX,y:touch.clientY};
}, {passive:true});
holeStatsScreen.addEventListener('touchend', event => {
  if (!swipeStart || event.changedTouches.length !== 1) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - swipeStart.x;
  const dy = touch.clientY - swipeStart.y;
  const startX = swipeStart.x;
  swipeStart = null;
  if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
  if (dx < 0 && startX > window.innerWidth - 110) setScorebarOpen(true);
  if (dx > 0 && scorebarPanel.classList.contains('is-open')) setScorebarOpen(false);
}, {passive:true});

window.addEventListener('resize', () => {
  if (!holeStatsScreen.hidden && selectedCourse) renderCourseNameHeading(selectedCourse.name || selectedCourse.course_name);
});

/* Stage 2 contextual help: no navigation or changes to hole data. */
const statHelpCopy = {
  fir: ['FAIRWAYS IN REGULATION (FIR)', 'On a par 4 or par 5, did the tee shot finish in the fairway? FIR does not apply to par 3 holes.'],
  gir: ['GREENS IN REGULATION (GIR)', 'Did the ball reach the putting green in no more than par minus two strokes? For example, one stroke on a par 3 or two on a par 4.'],
  updown: ['UP & DOWN', 'After missing the green in regulation, did you get the ball into the hole in two strokes or fewer from around the green? A chip-in also counts.'],
  putts: ['PUTTS', 'Count strokes played from the putting green, including strokes made with a club other than a putter. A putt from the fringe normally does not count.'],
  penalties: ['PENALTY STROKES', 'Enter the number of penalty strokes added to this hole, not the number of incidents. Penalty strokes are included in the hole score you enter separately.'],
  score: ['SCORE', 'Enter the actual total strokes for this hole, including penalty strokes. Tap the center value to activate it, then use + or −. Changing other stats will not change your score.']
};
const statHelpOverlay = document.getElementById('statHelpOverlay');
let statHelpLastTrigger = null;
document.querySelectorAll('[data-stat-help]').forEach(button => {
  button.addEventListener('click', () => {
    const help = statHelpCopy[button.dataset.statHelp];
    if (!help) return;
    statHelpLastTrigger = button;
    document.getElementById('statHelpTitle').textContent = help[0];
    document.getElementById('statHelpText').textContent = help[1];
    statHelpOverlay.hidden = false;
    document.getElementById('statHelpClose').focus();
  });
});
function closeStatHelp() {
  statHelpOverlay.hidden = true;
  if (statHelpLastTrigger) statHelpLastTrigger.focus({preventScroll:true});
}
document.getElementById('statHelpClose').addEventListener('click', closeStatHelp);
statHelpOverlay.addEventListener('click', event => { if (event.target === statHelpOverlay) closeStatHelp(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !statHelpOverlay.hidden) closeStatHelp(); });

/* Dedicated launch-time recovery choice; nothing is discarded on the first tap. */
const recoveryResumeBtn = document.getElementById('resumeActiveRoundBtn');
const recoveryNewBtn = document.getElementById('newRoundRecoveryBtn');
let recoveryNewPending = false;
function resetRecoveryNewButton() {
  recoveryNewPending = false;
  recoveryNewBtn.classList.remove('is-confirming');
  recoveryNewBtn.textContent = 'START A NEW ROUND »»';
}
function showRoundRecovery() {
  resetRecoveryNewButton();
  const courseName = selectedCourse?.name || selectedCourse?.course_name || 'Selected Course';
  document.getElementById('recoveryCourse').textContent = courseName.toUpperCase();
  const types = {practice:'Practice Round','jr-pga':'Jr PGA Tournament',ajga:'AJGA Tournament','high-school':'High School Tournament',other:'Other Event'};
  document.getElementById('recoveryRoundType').textContent = (types[roundTypeSelect.value] || 'Round in Progress') + ' · ' + (roundLengthSelect.value || roundHoleOrder.length) + ' holes';
  let total = 0, parTotal = 0;
  for (const [hole, stats] of savedHoleStats) {
    if (!Number.isFinite(stats?.score)) continue;
    total += stats.score;
    parTotal += holeParForNumber(hole) ?? 0;
  }
  const delta = total - parTotal;
  const relative = delta === 0 ? 'E' : delta > 0 ? '+' + delta : String(delta);
  // Presentation only: keep stroke counts neutral and color only the to-par value.
  const recoveryProgress = document.getElementById('recoveryProgress');
  const progressText = document.createTextNode(savedHoleStats.size + ' holes completed' + (savedHoleStats.size ? ' · ' + total + ' strokes (' : ''));
  recoveryProgress.replaceChildren(progressText);
  if (savedHoleStats.size) {
    const relativeValue = document.createElement('span');
    relativeValue.className = 'recovery-to-par-value ' + (delta < 0 ? 'is-under-par' : delta > 0 ? 'is-over-par' : 'is-even-par');
    relativeValue.textContent = relative;
    recoveryProgress.append(relativeValue, document.createTextNode(')'));
  }
  const completed = isRoundCompletedForReview();
  const recoveryTitle = roundRecoveryScreen.querySelector('.setup-title');
  if (recoveryTitle) recoveryTitle.textContent = completed ? 'Your Completed Round' : 'Your Active Round';
  const recoveryAlert = roundRecoveryScreen.querySelector('.recovery-alert');
  if (recoveryAlert) {
    const secondLine = completed ? 'your completed round!' : 'your round in progress!';
    const firstLine = document.createElement('span');
    firstLine.className = 'recovery-alert-first';
    firstLine.textContent = 'We found';
    const animatedLine = document.createElement('span');
    animatedLine.className = 'recovery-alert-second';
    Array.from(secondLine).forEach((character, index, characters) => {
      const letter = document.createElement('span');
      letter.className = character === ' ' ? 'recovery-letter recovery-space' : 'recovery-letter';
      letter.textContent = character === ' ' ? '\u00a0' : character;
      const fraction = characters.length > 1 ? index / (characters.length - 1) : 1;
      const offset = 1650 * (2 * fraction - fraction * fraction);
      letter.style.setProperty('--recovery-letter-delay', `${Math.round(650 + offset)}ms`);
      letter.setAttribute('aria-hidden', 'true');
      animatedLine.appendChild(letter);
    });
    recoveryAlert.setAttribute('aria-label', `We found ${secondLine}`);
    recoveryAlert.replaceChildren(firstLine, animatedLine);
  }
  document.getElementById('recoveryCurrentHole').textContent = completed
    ? 'Your scores are saved. Return to review the round or visit the Clubhouse.'
    : 'Ready to resume Hole ' + activeHoleNumber;
  recoveryResumeBtn.textContent = completed ? 'RETURN TO ROUND »»' : 'RESUME ACTIVE ROUND »»';
  homeScreen.hidden = true;
  homeDestinationScreen.hidden = true;
  roundSetupScreen.hidden = true;
  courseDataScreen.hidden = true;
  holeStatsScreen.hidden = true;
  scorebarPanel.hidden = true;
  bottomNav.hidden = true;
  roundRecoveryScreen.hidden = false;
  roundRecoveryScreen.scrollTop = 0;
}
recoveryResumeBtn.addEventListener('click', () => {
  resetRecoveryNewButton();
  showHoleStatsDemo(true);
});
recoveryNewBtn.addEventListener('click', () => {
  if (!recoveryNewPending) {
    recoveryNewPending = true;
    recoveryNewBtn.classList.add('is-confirming');
    recoveryNewBtn.replaceChildren(document.createTextNode('ARE YOU SURE?'), document.createElement('br'), document.createTextNode('START NEW ROUND »»'));
    return;
  }
  clearActiveRoundAndStartSetup();
});

function clearActiveRoundAndStartSetup() {
  // Confirmed: clear local round and all active-round state before setup.
  try {
    const existing = localStorage.getItem(LOCAL_ROUND_KEY);
    if (existing !== lastKnownRoundRaw) {
      warnRoundStorageConflict();
      return;
    }
    if (existing) localStorage.setItem(LOCAL_ROUND_BACKUP_KEY, existing);
    localStorage.removeItem(LOCAL_ROUND_KEY);
    lastKnownRoundRaw = null;
  }
  catch (error) { console.error('Unable to clear saved round:', error); showToast('Unable to clear saved round'); return; }
  roundInProgress = false;
  editingActiveRoundSetup = false;
  activeHoleNumber = null;
  roundHoleOrder = [];
  roundStartingHole = null;
  roundCompleteAcknowledged = false;
  updateCompletedRoundActions();
  updateHomeRoundButton();
  turnShownThisRound = false;
  returnHoleAfterEdit = null;
  holeStatDrafts.clear();
  savedHoleStats.clear();
  courseDataConfirmedRows.clear();
  selectedCourse = null;
  selectedTees = [];
  selectedHoles = [];
  roundTypeSelect.value = '';
  roundLengthSelect.value = '';
  startingHoleSelect.value = '';
  teeSelect.innerHTML = '<option value="">Select Tees</option>';
  teeSelect.disabled = true;
  teeSection.hidden = true;
  [roundTypeSelect, roundLengthSelect, startingHoleSelect, teeSelect].forEach(updateSelectState);
  courseSelectBtn.innerHTML = '<div><div class="setup-card-primary">Select Course</div><div class="setup-card-secondary">Search by course name and location</div></div><span class="setup-chevron">»</span>';
  courseSelectBtn.classList.remove('is-selected');
  courseSelectBtn.classList.add('needs-selection');
  resetCourseDetails();
  resetRecoveryNewButton();
  showRoundSetup();
}

/* =========================================================
   STAGE 3A — DEVICE-LOCAL ACTIVE ROUND RECOVERY
   Stored synchronously after each scoring interaction. No network calls.
   ========================================================= */
/* =========================================================
   AT THE TURN — nine sequentially completed holes, one time
   ========================================================= */
const TURN_SETTING_KEY = 'stracker:p3:at-turn-enabled:v1';
const atTurnOverlay = document.getElementById('atTurnOverlay');
const turnSettingsOverlay = document.getElementById('turnSettingsOverlay');
const turnEnabledInput = document.getElementById('turnEnabled');
let turnEnabled = true;
try { turnEnabled = localStorage.getItem(TURN_SETTING_KEY) !== 'false'; } catch (_) {}
turnEnabledInput.checked = turnEnabled;
turnEnabledInput.addEventListener('change', () => {
  turnEnabled = turnEnabledInput.checked;
  try { localStorage.setItem(TURN_SETTING_KEY, String(turnEnabled)); } catch (_) {}
});
document.getElementById('turnSettingsOpen').addEventListener('click', () => { turnSettingsOverlay.hidden = false; });
document.getElementById('turnSettingsClose').addEventListener('click', () => { turnSettingsOverlay.hidden = true; });
function maybeShowAtTurn() {
  if (turnShownThisRound || !turnEnabled || Number(roundLengthSelect.value) !== 18 || roundHoleOrder.length !== 18) return;
  const firstNine = roundHoleOrder.slice(0, 9);
  if (!firstNine.every(hole => savedHoleStats.has(hole))) return;
  // Do not show retroactively after a later hole has already been completed.
  if (roundHoleOrder.slice(9).some(hole => savedHoleStats.has(hole))) return;
  turnShownThisRound = true;
  const entries = firstNine.map(hole => ({hole, stats:savedHoleStats.get(hole), par:holeParForNumber(hole)}));
  const score = entries.reduce((sum, item) => sum + item.stats.score, 0);
  const parKnown = entries.every(item => item.par !== null);
  const toPar = parKnown ? entries.reduce((sum, item) => sum + item.stats.score - item.par, 0) : null;
  const turnScoreEl = document.getElementById('turnScore');
  turnScoreEl.textContent = toPar === null ? String(score) + ' STROKES' : formatToPar(toPar);
  applyParScoreColor(turnScoreEl, toPar);
  const gir = entries.filter(item => item.stats.gir === 'Y').length;
  const puttEntries = entries.filter(item => Number.isInteger(item.stats.putts));
  const avgPutts = puttEntries.length === 9 ? (puttEntries.reduce((sum, item) => sum + item.stats.putts, 0) / 9) : null;
  const penalties = entries.filter(item => Number.isInteger(item.stats.penalties)).reduce((sum, item) => sum + item.stats.penalties, 0);
  const headline = document.getElementById('turnHeadline');
  const observation = document.getElementById('turnObservation');
  const encouragement = document.getElementById('turnEncouragement');
  if (toPar !== null && toPar <= 1) {
    headline.textContent = toPar < 0 ? 'Outstanding first nine!' : "That's a strong start!";
    encouragement.textContent = 'Keep the confidence. Play your game!';
  } else if (toPar !== null && toPar >= 7) {
    headline.textContent = 'Fresh nine. Fresh start.';
    encouragement.textContent = 'One hole at a time. You’ve got this!';
  } else {
    headline.textContent = 'Nine down. Keep it going!';
    encouragement.textContent = 'A new nine, a new opportunity!';
  }
  if (avgPutts !== null && avgPutts <= 1.7) {
    observation.textContent = `Your putting is a bright spot: ${avgPutts.toFixed(1)} putts per hole so far.`;
  } else if (gir >= 5) {
    observation.textContent = `You found ${gir} greens in regulation on the first nine. Nice ball-striking!`;
  } else if (penalties >= 2) {
    observation.textContent = 'A few cleaner holes could make a difference on the next nine.';
  } else if (avgPutts !== null && avgPutts >= 2.3) {
    observation.textContent = 'There may be opportunities to pick up strokes with steady putting on the back nine.';
  } else {
    observation.textContent = `You've completed the first nine in ${score} strokes. Stay focused on the next shot.`;
  }
  // Full-course rating is contextual only; never imply it is a nine-hole rating.
  const context = document.getElementById('turnCourseContext');
  const tee = typeof getSelectedTee === 'function' ? getSelectedTee() : null;
  const rating = tee ? Number(tee.rating ?? tee.course_rating ?? tee.courseRating) : NaN;
  const strong = toPar !== null && toPar <= 1;
  context.hidden = !(strong && Number.isFinite(rating) && rating >= 70);
  context.textContent = context.hidden ? '' : `Especially on a course with an 18-hole rating of ${rating.toFixed(1)}!`;
  persistActiveRound();
  setScorebarOpen(false);
  bottomNav.hidden = false;
  bottomNav.inert = true;
  atTurnOverlay.hidden = false;
  atTurnOverlay.classList.remove('turn-visible');
  requestAnimationFrame(() => requestAnimationFrame(() => atTurnOverlay.classList.add('turn-visible')));
}
document.getElementById('turnContinue').addEventListener('click', () => {
  atTurnOverlay.classList.remove('turn-visible');
  atTurnOverlay.hidden = true;
  bottomNav.inert = false;
  bottomNav.hidden = true;
  persistActiveRound();
});

// Shared scoring color rule: under par red, even green, over par charcoal.
function applyParScoreColor(element, toPar) {
  element.classList.toggle('score-under-par', toPar !== null && toPar < 0);
  element.classList.toggle('score-even-par', toPar === 0);
  element.classList.toggle('score-over-par', toPar !== null && toPar > 0);
}
// A completed scorecard remains editable, with an obvious route to Clubhouse.
function updateCompletedRoundActions() {
  const completed = isRoundCompletedForReview();
  for (const id of ['completedRoundClubhouseBtn', 'homeCompletedClubhouseBtn']) {
    const button = document.getElementById(id);
    if (button) button.hidden = !completed;
  }
  document.getElementById('holeCourseStrip')?.classList.toggle('is-round-complete', completed);
  const subline = document.getElementById('holeCourseSubline');
  if (subline) subline.hidden = completed;
}
for (const id of ['completedRoundClubhouseBtn', 'homeCompletedClubhouseBtn']) {
  document.getElementById(id)?.addEventListener('click', () => {
    persistActiveRound();
    showHomeDestination('clubhouse');
  });
}
const roundCompleteOverlay = document.getElementById('roundCompleteOverlay');
function isScoringComplete() {
  return roundInProgress && roundHoleOrder.length > 0 &&
    roundHoleOrder.every(hole => savedHoleStats.has(hole));
}
function maybeShowRoundComplete() {
  if (roundCompleteAcknowledged || !isScoringComplete()) return;
  if (!persistActiveRound()) {
    showToast('Round not safely stored — check other open tabs');
    return;
  }
  roundCompleteAcknowledged = true;
  updateCompletedRoundActions();
  updateHomeRoundButton();
  const score = roundHoleOrder.reduce((sum, hole) => sum + Number(savedHoleStats.get(hole).score || 0), 0);
  const pars = roundHoleOrder.map(hole => holeParForNumber(hole));
  const toPar = pars.every(par => par !== null) ? score - pars.reduce((sum, par) => sum + par, 0) : null;
  // Identify the configured round length on the completion billboard.
  const roundLengthLabel = roundCompleteOverlay.querySelector('.turn-card .turn-eyebrow');
  if (roundLengthLabel) {
    roundLengthLabel.textContent = roundHoleOrder.length === 9
      ? 'YOUR NINE-HOLE ROUND'
      : roundHoleOrder.length === 18
        ? 'YOUR EIGHTEEN-HOLE ROUND'
        : `YOUR ${roundHoleOrder.length}-HOLE ROUND`;
  }
  const completeScoreEl = document.getElementById('roundCompleteScore');
  completeScoreEl.textContent = toPar === null ? `${score} STROKES` : `${score} · ${formatToPar(toPar)}`;
  applyParScoreColor(completeScoreEl, toPar);
  if (!persistActiveRound()) {
    roundCompleteAcknowledged = false;
    updateCompletedRoundActions();
    updateHomeRoundButton();
    showToast('Round not safely stored — check other open tabs');
    return;
  }
  setScorebarOpen(false);
  bottomNav.hidden = false;
  bottomNav.inert = true;
  roundCompleteOverlay.hidden = false;
  roundCompleteOverlay.classList.remove('turn-visible');
  requestAnimationFrame(() => requestAnimationFrame(() => roundCompleteOverlay.classList.add('turn-visible')));
}
function dismissRoundComplete() {
  roundCompleteOverlay.classList.remove('turn-visible');
  roundCompleteOverlay.hidden = true;
  bottomNav.inert = false;
  persistActiveRound();
}
document.getElementById('roundCompleteClubhouse').addEventListener('click', () => {
  dismissRoundComplete();
  showHomeDestination('clubhouse');
});
document.getElementById('roundCompleteLater').addEventListener('click', () => {
  dismissRoundComplete();
  showHome();
});

const LOCAL_ROUND_KEY = 'stracker:p3:active-round:v1';
const LOCAL_ROUND_BACKUP_KEY = 'stracker:p3:active-round:backup:v1';
const LOCAL_ROUND_PREVIOUS_KEY = 'stracker:p3:active-round:previous:v1';
// This tab may write only while the stored record is the one it last read/wrote.
// Prevent an older tab's visibility/pagehide handler from replacing newer scores.
let lastKnownRoundRaw = null;
let roundStorageConflictShown = false;
let restoringLocalRound = false;
function warnRoundStorageConflict() {
  if (roundStorageConflictShown) return;
  roundStorageConflictShown = true;
  console.error('Circle-1: another tab changed the saved round. This tab will not overwrite it.');
  // A transient toast is too easy to miss when a scoring update is refused.
  // Build a self-contained dialog so no HTML/CSS changes are required.
  let dialog = document.getElementById('roundStorageConflictDialog');
  if (!dialog) {
    dialog = document.createElement('div');
    dialog.id = 'roundStorageConflictDialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'roundStorageConflictTitle');
    dialog.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:20px;';
    const panel = document.createElement('div');
    panel.style.cssText = 'width:min(100%,420px);background:#fff;color:#17241b;border-radius:16px;padding:24px;font:16px/1.45 Arial,sans-serif;box-shadow:0 12px 48px rgba(0,0,0,.35);';
    const title = document.createElement('h2');
    title.id = 'roundStorageConflictTitle';
    title.textContent = 'Round updated in another tab';
    title.style.cssText = 'font-size:22px;line-height:1.2;margin:0 0 14px;';
    const explanation = document.createElement('p');
    explanation.textContent = 'This tab is out of date. Your changes in this tab were NOT saved. To protect the latest saved scores, Stracker has stopped this tab from saving.';
    explanation.style.cssText = 'margin:0 0 12px;';
    const instruction = document.createElement('p');
    instruction.textContent = 'Reload the latest saved round to continue. Any unsaved changes shown in this tab will be discarded.';
    instruction.style.cssText = 'margin:0 0 20px;';
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = 'RELOAD SAVED ROUND »»';
    reload.style.cssText = 'width:100%;padding:14px 12px;background:#00a249;color:#fff;border:0;border-radius:9px;font:700 15px Arial,sans-serif;cursor:pointer;';
    reload.addEventListener('click', () => window.location.reload());
    panel.append(title, explanation, instruction, reload);
    dialog.appendChild(panel);
    document.body.appendChild(dialog);
  }
  dialog.hidden = false;
  dialog.style.display = 'flex';
  dialog.querySelector('button')?.focus();
}
function roundSavedSignature(snapshot) {
  return JSON.stringify(snapshot.saved || []);
}

function canSaveHoleFromThisTab(hole) {
  try {
    // Every write must be based on the exact snapshot this tab last saved/read.
    // No score-based exceptions: those allowed a stale tab to replace a score.
    if (localStorage.getItem(LOCAL_ROUND_KEY) !== lastKnownRoundRaw) {
      warnRoundStorageConflict();
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Circle-1: could not verify the saved hole:', error);
    showToast('Cannot verify round storage — save blocked');
    return false;
  }
}

function persistActiveRound() {
  if (restoringLocalRound || !roundInProgress) return false;
  try {
    const snapshot = {
      version: 1, savedAt: Date.now(),
      course: selectedCourse, tees: selectedTees, holes: selectedHoles,
      setup: { roundType: roundTypeSelect.value, tee: teeSelect.value,
        length: roundLengthSelect.value, start: startingHoleSelect.value },
      order: roundHoleOrder, startingHole: roundStartingHole,
      currentHole: activeHoleNumber, returnHole: returnHoleAfterEdit,
      turnShown: turnShownThisRound, completeAcknowledged: roundCompleteAcknowledged,
      drafts: [...holeStatDrafts.entries()], saved: [...savedHoleStats.entries()],
      confirmedRows: [...courseDataConfirmedRows],
      view: !holeStatsScreen.hidden ? 'holeStats' : !courseDataScreen.hidden ? 'courseData' :
        !roundSetupScreen.hidden ? 'setup' : 'home'
    };
    const currentRaw = localStorage.getItem(LOCAL_ROUND_KEY);
    // Strict optimistic concurrency: never merge stale snapshots automatically.
    // In particular, a stale tab must not overwrite an already-scored hole.
    if (currentRaw !== lastKnownRoundRaw) {
      warnRoundStorageConflict();
      return false;
    }
    const newRaw = JSON.stringify(snapshot);
    if (currentRaw) {
      const previous = JSON.parse(currentRaw);
      // Preserve the last distinct scored-hole state before overwriting it.
      // The backup is written FIRST; if that fails, do not risk the only copy.
      if (roundSavedSignature(previous) !== roundSavedSignature(snapshot)) {
        const oldBackup = localStorage.getItem(LOCAL_ROUND_BACKUP_KEY);
        if (oldBackup) localStorage.setItem(LOCAL_ROUND_PREVIOUS_KEY, oldBackup);
        localStorage.setItem(LOCAL_ROUND_BACKUP_KEY, currentRaw);
      }
    }
    localStorage.setItem(LOCAL_ROUND_KEY, newRaw);
    lastKnownRoundRaw = newRaw;
    roundStorageConflictShown = false;
    return true;
  } catch (error) {
    console.warn('Stracker local round save unavailable:', error);
    showToast('Device storage unavailable — round not backed up');
    return false;
  }
}
function recoverActiveRound() {
  let snapshot;
  try {
    const raw = localStorage.getItem(LOCAL_ROUND_KEY);
    lastKnownRoundRaw = raw;
    if (!raw) return;
    snapshot = JSON.parse(raw);
    if (snapshot.version !== 1 || !Array.isArray(snapshot.order) || !snapshot.order.length ||
        !Array.isArray(snapshot.holes) || !Array.isArray(snapshot.tees) ||
        !Array.isArray(snapshot.drafts) || !Array.isArray(snapshot.saved)) return;
  } catch (error) {
    console.warn('Stracker local recovery unavailable:', error);
    return;
  }
  restoringLocalRound = true;
  try {
    selectedCourse = snapshot.course;
    selectedTees = snapshot.tees;
    selectedHoles = snapshot.holes;
    const courseName = selectedCourse?.name || selectedCourse?.course_name || 'Selected Course';
    const location = [selectedCourse?.city, selectedCourse?.state].filter(Boolean).join(', ');
    courseSelectBtn.innerHTML = `<div><div class="setup-card-primary">${escapeHtml(courseName)}</div>` +
      `<div class="setup-card-secondary">${escapeHtml(location || 'Course selected')}</div></div>` +
      '<span class="setup-chevron">»</span>';
    courseSelectBtn.classList.remove('needs-selection');
    courseSelectBtn.classList.add('is-selected');
    teeSection.hidden = false;
    populateTeeSelect(selectedTees);
    const setup = snapshot.setup || {};
    roundTypeSelect.value = setup.roundType || '';
    roundLengthSelect.value = setup.length || '';
    startingHoleSelect.value = setup.start || '';
    teeSelect.value = setup.tee ?? '';
    [roundTypeSelect, roundLengthSelect, startingHoleSelect, teeSelect].forEach(updateSelectState);
    teeSection.classList.toggle('needs-selection', !teeSelect.value);
    startingHoleSection.classList.toggle('needs-selection', !startingHoleSelect.value);
    if (getSelectedTee()) populateCourseDetails(getSelectedTee());
    courseDataConfirmedRows = new Set(snapshot.confirmedRows || []);
    holeStatDrafts.clear();
    snapshot.drafts.forEach(([hole, entry]) => holeStatDrafts.set(Number(hole), entry));
    savedHoleStats.clear();
    snapshot.saved.forEach(([hole, entry]) => savedHoleStats.set(Number(hole), entry));
    roundHoleOrder = snapshot.order;
    roundStartingHole = snapshot.startingHole;
    activeHoleNumber = roundHoleOrder.includes(snapshot.currentHole) ? snapshot.currentHole : roundHoleOrder[0];
    returnHoleAfterEdit = snapshot.returnHole ?? null;
    turnShownThisRound = Boolean(snapshot.turnShown);
    roundCompleteAcknowledged = Boolean(snapshot.completeAcknowledged);
    roundInProgress = true;
    editingActiveRoundSetup = false;
    updateCompletedRoundActions();
    updateHomeRoundButton();
    // Present a choice on a fresh launch; never interrupt normal navigation.
    showRoundRecovery();
  } catch (error) {
    console.error('Stracker active-round recovery failed:', error);
    roundInProgress = false;
    showHome();
  } finally {
    restoringLocalRound = false;
  }
}
// Capture navigation/setup changes and course-data edits as well as scoring.
// Deferred snapshot captures the state after existing event handlers finish.
document.addEventListener('change', () => {
  if (roundInProgress) queueMicrotask(persistActiveRound);
});
window.addEventListener('pagehide', persistActiveRound);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persistActiveRound();
});
recoverActiveRound();

/* GLOBAL NAVIGATION — added without changing scoring or recovery internals. */
const globalMenuBtn = document.getElementById('globalMenuBtn');
const globalMenuPanel = document.getElementById('globalMenuPanel');
const newRoundConfirm = document.getElementById('newRoundConfirm');
function closeGlobalMenu() { globalMenuPanel.hidden = true; globalMenuBtn.setAttribute('aria-expanded','false'); }
globalMenuBtn.addEventListener('click', () => {
  globalMenuPanel.hidden = !globalMenuPanel.hidden;
  globalMenuBtn.setAttribute('aria-expanded', String(!globalMenuPanel.hidden));
  document.querySelectorAll('[data-global-dest="hole"],[data-global-dest="course"]').forEach(b => b.disabled = !roundInProgress);
});
document.getElementById('globalMenuClose').addEventListener('click', closeGlobalMenu);
// Dismiss the navigation card when tapping anywhere outside it.
document.addEventListener('pointerdown', (event) => {
  if (globalMenuPanel.hidden) return;
  if (globalMenuPanel.contains(event.target) || globalMenuBtn.contains(event.target)) return;
  closeGlobalMenu();
});
function openNewRoundConfirmation() {
  closeGlobalMenu();
  if (!roundInProgress) { showRoundSetup(); return; }
  document.getElementById('newRoundConfirmMessage').textContent =
    `You have ${savedHoleStats.size} saved hole${savedHoleStats.size === 1 ? '' : 's'} in your active round. Starting a new round will replace it and its saved statistics. This cannot be undone.`;
  newRoundConfirm.hidden = false;
}
document.getElementById('homeNewRoundBtn').addEventListener('click', openNewRoundConfirmation);
document.getElementById('keepCurrentRoundBtn').addEventListener('click', () => { newRoundConfirm.hidden = true; });
document.getElementById('confirmNewRoundBtn').addEventListener('click', () => {
  newRoundConfirm.hidden = true;
  clearActiveRoundAndStartSetup();
  updateHomeRoundButton();
});
globalMenuPanel.querySelectorAll('[data-global-dest]').forEach(button => button.addEventListener('click', () => {
  const dest = button.dataset.globalDest;
  closeGlobalMenu();
  if (dest === 'new') { openNewRoundConfirmation(); return; }
  if (dest === 'home') { showHome(); return; }
  if (dest === 'hole') { if (roundInProgress) showHoleStatsDemo(true); return; }
  if (dest === 'setup') {
    if (roundInProgress) editingActiveRoundSetup = true;
    showRoundSetup(); return;
  }
  if (dest === 'course') { if (roundInProgress) openCourseData('holeStats',activeHoleNumber); return; }
  if (homeDestinations[dest]) showHomeDestination(dest);
}));
// Hide the global control during the modal recovery choice or AT THE TURN.
function syncGlobalMenuVisibility() {
  const hidden = scorebarPanel.classList.contains('is-open') ||
    !roundRecoveryScreen.hidden || !atTurnOverlay.hidden || !roundCompleteOverlay.hidden ||
    !turnSettingsOverlay.hidden || !newRoundConfirm.hidden;
  globalMenuBtn.hidden = hidden;
  if (hidden) closeGlobalMenu();
}
new MutationObserver(syncGlobalMenuVisibility).observe(roundRecoveryScreen,{attributes:true,attributeFilter:['hidden']});
new MutationObserver(syncGlobalMenuVisibility).observe(atTurnOverlay,{attributes:true,attributeFilter:['hidden']});
new MutationObserver(syncGlobalMenuVisibility).observe(roundCompleteOverlay,{attributes:true,attributeFilter:['hidden']});
new MutationObserver(syncGlobalMenuVisibility).observe(turnSettingsOverlay,{attributes:true,attributeFilter:['hidden']});
new MutationObserver(syncGlobalMenuVisibility).observe(newRoundConfirm,{attributes:true,attributeFilter:['hidden']});
syncGlobalMenuVisibility();
