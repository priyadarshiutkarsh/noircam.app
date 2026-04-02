(function () {
  const splash   = document.getElementById('splash');
  const appWrap  = document.getElementById('appWrap');
  const progress = document.querySelector('.splash-progress');

  const DURATION = 2200; // total splash time in ms

  function playChime() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      function tone(freq, startAt, duration, gainVal) {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt);

        gain.gain.setValueAtTime(0, ctx.currentTime + startAt);
        gain.gain.linearRampToValueAtTime(gainVal, ctx.currentTime + startAt + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startAt + duration);

        osc.start(ctx.currentTime + startAt);
        osc.stop(ctx.currentTime + startAt + duration);
      }

      // Three-note ascending chime: E4 → G#4 → B4
      tone(329.63, 0.0,  0.7, 0.18);
      tone(415.30, 0.18, 0.7, 0.14);
      tone(493.88, 0.36, 1.1, 0.12);

      // Subtle shimmer overtone
      tone(987.77, 0.36, 0.9, 0.05);

    } catch (_) {
      // Audio not supported — skip silently
    }
  }

  function animateProgress() {
    const start = performance.now();
    function step(now) {
      const pct = Math.min(((now - start) / DURATION) * 100, 100);
      progress.style.width = pct + '%';
      if (pct < 100) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function dismiss() {
    splash.classList.add('hide');
    appWrap.classList.add('visible');
  }

  // Small delay so the page is fully painted before the chime fires
  setTimeout(() => {
    playChime();
    animateProgress();
    setTimeout(dismiss, DURATION);
  }, 120);

})();
