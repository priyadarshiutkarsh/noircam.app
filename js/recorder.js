window.NC = window.NC || {};

NC.Recorder = (function () {

  let _mediaRecorder = null;
  let _chunks = [];
  let _startTime = 0;
  let _timerInterval = null;
  let _onStop = null;
  let _onTick = null;

  const MIME_TYPES = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ];

  function getSupportedMime() {
    return MIME_TYPES.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }

  function start(canvasStream, { onStop, onTick } = {}) {
    if (_mediaRecorder) stop();

    _chunks = [];
    _onStop = onStop;
    _onTick = onTick;

    const mimeType = getSupportedMime();
    const options = mimeType ? { mimeType, videoBitsPerSecond: 5_000_000 } : {};

    _mediaRecorder = new MediaRecorder(canvasStream, options);

    _mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) _chunks.push(e.data);
    };

    _mediaRecorder.onstop = () => {
      clearInterval(_timerInterval);
      const duration = Date.now() - _startTime;
      const blob = new Blob(_chunks, { type: mimeType || 'video/webm' });
      _chunks = [];
      if (_onStop) _onStop(blob, duration);
      _mediaRecorder = null;
    };

    _mediaRecorder.start(100);
    _startTime = Date.now();

    if (_onTick) {
      _timerInterval = setInterval(() => _onTick(Date.now() - _startTime), 500);
    }
  }

  function stop() {
    if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
      _mediaRecorder.stop();
    }
    clearInterval(_timerInterval);
  }

  function isRecording() {
    return !!(_mediaRecorder && _mediaRecorder.state === 'recording');
  }

  function isSupported() {
    return typeof MediaRecorder !== 'undefined';
  }

  function elapsed() {
    return _startTime ? Date.now() - _startTime : 0;
  }

  return { start, stop, isRecording, isSupported, elapsed };

})();
