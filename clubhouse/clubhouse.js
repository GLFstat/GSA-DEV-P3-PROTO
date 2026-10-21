/* Clubhouse Stage 1 — isolated presentation only.
   The host provides current player-round state on each render.
   No storage, completion, or archive mutations are permitted here. */
(function () {
  'use strict';
function renderClubhousePreview(context) {
  const { selectedCourse, roundInProgress, roundTypeSelect, roundLengthSelect, roundHoleOrder, savedHoleStats, holeParForNumber, formatToPar } = context;
  const courseName = selectedCourse?.name || selectedCourse?.course_name || 'Selected Course';
  document.getElementById('clubhouseCourseName').textContent = roundInProgress ? courseName : 'No active round';
  const roundType = roundTypeSelect.selectedOptions[0]?.textContent?.trim() || 'Round';
  document.getElementById('clubhouseRoundInfo').textContent = roundInProgress
    ? `${roundType} · ${roundLengthSelect.value || roundHoleOrder.length} holes`
    : 'Start a round to see its live summary here.';
  const saved = [...savedHoleStats.entries()].filter(([hole, stat]) =>
    Number.isInteger(stat?.score) && stat.score > 0);
  const strokes = saved.reduce((sum, [, stat]) => sum + stat.score, 0);
  const withPar = saved.filter(([hole]) => holeParForNumber(hole) !== null);
  const delta = withPar.reduce((sum, [hole, stat]) => sum + stat.score - holeParForNumber(hole), 0);
  document.getElementById('clubhouseHolesSaved').textContent = String(roundInProgress ? saved.length : 0);
  document.getElementById('clubhouseScoreTotal').textContent = roundInProgress && saved.length ? String(strokes) : '—';
  document.getElementById('clubhouseToPar').textContent = roundInProgress && withPar.length
    ? formatToPar(delta) : '—';
  // Only the to-par number is performance-colored; strokes and labels stay neutral.
  const scoreClass = !roundInProgress || !saved.length || !withPar.length
    ? '' : delta < 0 ? 'clubhouse-par-under' : delta > 0 ? 'clubhouse-par-over' : 'clubhouse-par-even';
  ['clubhouseScoreTotal', 'clubhouseToPar'].forEach(id => {
    const metric = document.getElementById(id)?.parentElement;
    if (!metric) return;
    metric.classList.remove('clubhouse-par-under', 'clubhouse-par-even', 'clubhouse-par-over');
    if (id === 'clubhouseToPar' && scoreClass) metric.classList.add(scoreClass);
  });
  const expected = roundHoleOrder.length || Number(roundLengthSelect.value) || 0;
  const validScore = stat => Number.isInteger(stat?.score) && stat.score > 0;
   const missingScores = roundHoleOrder.filter(hole => !validScore(savedHoleStats.get(hole)));
  const missingPars = saved.filter(([hole]) => holeParForNumber(hole) === null);
  const checks = [];
  if (!roundInProgress) checks.push('No active round to review.');
  else {
    checks.push(`${saved.length} of ${expected} holes have saved scores.`);
    if (missingScores.length) checks.push(`Unsaved holes: ${missingScores.join(', ')}.`);
    if (missingPars.length) checks.push(`Par unavailable for ${missingPars.length} saved hole(s).`);
    if (!missingScores.length && !missingPars.length) checks.push('All expected scores and hole pars are present.');
    // Stage 1: identify missing performance information without changing round data.
    // A genuine zero is known; null/undefined are unknown. Par-3 FIR is N/A.
    const details = [];
    for (const hole of roundHoleOrder) {
      const stat = savedHoleStats.get(hole);
      if (!validScore(stat)) continue;
      const par = holeParForNumber(hole);
      const missing = [];
      if (stat.putts == null || !Number.isInteger(stat.putts) || stat.putts < 0) missing.push('Putts');
      if (stat.gir !== 'Y' && stat.gir !== 'N') missing.push('GIR');
      if (par === 4 || par === 5) {
        if (stat.fir !== 'Y' && stat.fir !== 'N') missing.push('FIR');
      }
      // Up-and-down applicability cannot be established reliably from these
      // fields alone, so do not flag it as missing at this stage.
      if (missing.length) details.push(`Hole ${hole}: ${missing.join(', ')}.`);
    }
    if (details.length) {
      checks.push(`Performance details to review on ${details.length} hole${details.length === 1 ? '' : 's'} (optional):`);
      checks.push(...details);
      checks.push('Your scores are preserved. Completing these details can improve your performance insights.');
    } else if (saved.length) {
      checks.push('No missing putts, GIR, or applicable FIR on scored holes.');
    }
  }
  const container = document.getElementById('clubhouseReviewItems');
  container.replaceChildren();
  checks.forEach(message => {
    const item = document.createElement('p');
    item.className = 'clubhouse-review-item';
    item.textContent = message;
    container.appendChild(item);
  });
  const returnButton = document.getElementById('clubhouseReturnRound');
  returnButton.hidden = !roundInProgress;
  returnButton.textContent = context.roundCompleted ? 'RETURN TO ROUND »»' : 'RESUME ROUND »»';
}


  // Presentation-only: no round data or navigation is modified.
  // The shrinking gaps between letter start times create acceleration.
  const LETTER_START_DELAY_MS = 650;
  const LETTER_CASCADE_MS = 1650;
  function setupClubhouseLetterReveal() {
    const screen = document.getElementById('homeDestinationScreen');
    const lead = screen?.querySelector('.clubhouse-lead');
    if (!screen || !lead) return;
    const original = lead.textContent;
    const characters = Array.from(original);
    const fragment = document.createDocumentFragment();
    characters.forEach((char, index) => {
      const span = document.createElement('span');
      span.className = char === ' ' ? 'clubhouse-letter clubhouse-space' : 'clubhouse-letter';
      span.textContent = char === ' ' ? '\u00a0' : char;
      // Quadratic spacing: later letters start closer together.
      const fraction = characters.length > 1 ? index / (characters.length - 1) : 1;
      const offset = LETTER_CASCADE_MS * (2 * fraction - fraction * fraction);
      span.style.setProperty('--clubhouse-letter-delay', `${Math.round(LETTER_START_DELAY_MS + offset)}ms`);
      span.setAttribute('aria-hidden', 'true');
      fragment.appendChild(span);
    });
    // Preserve the full sentence for assistive technology without repeating letters.
    lead.setAttribute('aria-label', original);
    lead.replaceChildren(fragment);

    function restartReveal() {
      if (screen.hidden || lead.closest('[hidden]')) return;
      lead.querySelectorAll('.clubhouse-letter').forEach(letter => {
        letter.style.animation = 'none';
      });
      // Force a style flush so returning to the Clubhouse replays the animation.
      void lead.offsetWidth;
      lead.querySelectorAll('.clubhouse-letter').forEach(letter => {
        letter.style.animation = '';
      });
    }
    const observer = new MutationObserver(() => {
      if (!screen.hidden && !lead.closest('[hidden]')) restartReveal();
    });
    observer.observe(screen, { attributes: true, attributeFilter: ['hidden'] });
    const preview = document.getElementById('clubhousePreview');
    if (preview) observer.observe(preview, { attributes: true, attributeFilter: ['hidden'] });
    if (!screen.hidden && !lead.closest('[hidden]')) restartReveal();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupClubhouseLetterReveal, { once: true });
  } else {
    setupClubhouseLetterReveal();
  }

  window.StrackerClubhouse = Object.freeze({ render: renderClubhousePreview });
})();
