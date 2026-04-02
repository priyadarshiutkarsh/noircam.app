(function () {
  const splash   = document.getElementById('splash');
  const appWrap  = document.getElementById('appWrap');
  const progress = document.querySelector('.splash-progress');
  const hint     = document.querySelector('.splash-hint');

  const DURATION = 2400;
  let dismissed  = false;

  document.body.style.overflow = 'hidden';

  function playChime(audioCtx) {
    function tone(freq, startAt, duration, gainVal) {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + startAt);
      gain.gain.setValueAtTime(0, audioCtx.currentTime + startAt);
      gain.gain.linearRampToValueAtTime(gainVal, audioCtx.currentTime + startAt + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + startAt + duration);
      osc.start(audioCtx.currentTime + startAt);
      osc.stop(audioCtx.currentTime + startAt + duration);
    }
    tone(329.63, 0.0,  0.7, 0.18);
    tone(415.30, 0.18, 0.7, 0.14);
    tone(493.88, 0.36, 1.1, 0.12);
    tone(987.77, 0.36, 0.9, 0.05);
  }

  function tryPlayChime() {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // browsers suspend AudioContext until a user gesture — resume first
      audioCtx.resume().then(() => {
        if (audioCtx.state === 'running') playChime(audioCtx);
      });
    } catch (_) {}
  }

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    document.body.style.overflow = '';
    splash.classList.add('hide');
    appWrap.classList.add('visible');
  }

  function animateProgress() {
    const start = performance.now();
    function step(now) {
      const pct = Math.min(((now - start) / DURATION) * 100, 100);
      progress.style.width = pct + '%';
      if (pct >= 80 && hint) hint.style.opacity = '1';
      if (pct < 100 && !dismissed) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // tap to play sound and skip in early
  splash.addEventListener('click', () => {
    tryPlayChime();
    setTimeout(dismiss, 400);
  }, { once: true });

  setTimeout(animateProgress, 80);
  setTimeout(() => setTimeout(dismiss, 600), DURATION);

})();
