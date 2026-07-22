// ==================== 开箱音效模块 (Web Audio API 程序化生成) ====================
// 无外部依赖，纯代码生成所有音效
// 关键优化：预生成共享噪声缓冲，动画期间零 buffer 创建，避免 GC 导致掉帧

let _audioCtx = null;
// 预生成缓冲（懒初始化，只创建一次）
let _noiseBufFlat = null;   // 100ms 平坦白噪声（光球飞出复用）
let _noiseBufTick = null;   // 20ms 衰减噪声（球滚动 tick）
let _noiseBufClick = null;  // 8ms 衰减噪声（球定格敲击）

/** 获取或创建 AudioContext（懒初始化） */
function getCtx() {
    if (!_audioCtx) {
        try {
            _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API 不可用');
            return null;
        }
    }
    if (_audioCtx.state === 'suspended') {
        _audioCtx.resume().catch(() => {});
    }
    return _audioCtx;
}

/** 预生成所有共享噪声缓冲（首次调用时执行，后续零开销） */
function _ensureBuffers() {
    if (_noiseBufFlat) return;
    const ctx = getCtx();
    if (!ctx) return;

    // 100ms 平坦白噪声 — 光球"唰/噗"声共用
    const flatLen = Math.floor(ctx.sampleRate * 0.1);
    _noiseBufFlat = ctx.createBuffer(1, flatLen, ctx.sampleRate);
    const fd = _noiseBufFlat.getChannelData(0);
    for (let i = 0; i < flatLen; i++) fd[i] = Math.random() * 2 - 1;

    // 20ms 指数衰减噪声 — 球滚动 tick
    const tickLen = Math.floor(ctx.sampleRate * 0.02);
    _noiseBufTick = ctx.createBuffer(1, tickLen, ctx.sampleRate);
    const td = _noiseBufTick.getChannelData(0);
    for (let i = 0; i < tickLen; i++) td[i] = (Math.random() * 2 - 1) * Math.exp(-i / (tickLen * 0.2));

    // 8ms 指数衰减噪声 — 球定格高频敲击
    const clickLen = Math.floor(ctx.sampleRate * 0.008);
    _noiseBufClick = ctx.createBuffer(1, clickLen, ctx.sampleRate);
    const cd = _noiseBufClick.getChannelData(0);
    for (let i = 0; i < clickLen; i++) cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (clickLen * 0.15));
}

// ── 音效开关 ──
const SOUND_KEY = 'YJWJ_lootbox_sound_enabled';
let _soundEnabled = true;

(function _initSoundState() {
    try {
        const saved = localStorage.getItem(SOUND_KEY);
        if (saved !== null) _soundEnabled = saved === 'true';
    } catch (e) { /* ignore */ }
})();

function toggleSound() {
    _soundEnabled = !_soundEnabled;
    try { localStorage.setItem(SOUND_KEY, String(_soundEnabled)); } catch (e) { /* ignore */ }
    if (!_soundEnabled) { stopBoxShake(); stopBallRoll(); }
    _updateToggleButton();
    return _soundEnabled;
}

function isSoundEnabled() { return _soundEnabled; }

function _updateToggleButton() {
    const btn = document.getElementById('lootbox-sound-toggle');
    if (btn) btn.textContent = _soundEnabled ? '🔊' : '🔇';
}

/** 主音量 */
const MG = 0.7;

// ==================== 1. 宝箱摇晃 ====================

let _shakeNodes = null;

function startBoxShake() {
    if (!_soundEnabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    stopBoxShake();

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noiseNode = ctx.createBufferSource();
    noiseNode.buffer = buffer;
    noiseNode.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 350; filter.Q.value = 1.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.3;

    const lfo = ctx.createOscillator();
    lfo.type = 'sine'; lfo.frequency.value = 8;

    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.15;

    const masterGain = ctx.createGain();
    masterGain.gain.value = MG * 0.11;  // 降至原来的一半

    noiseNode.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    lfo.connect(lfoGain);
    lfoGain.connect(noiseGain.gain);

    noiseNode.start();
    lfo.start();
    _shakeNodes = { noiseNode, filter, noiseGain, lfo, lfoGain, masterGain };
}

function stopBoxShake() {
    if (!_shakeNodes) return;
    const { noiseNode, lfo, masterGain } = _shakeNodes;
    _shakeNodes = null;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    masterGain.gain.setValueAtTime(masterGain.gain.value, now);
    masterGain.gain.linearRampToValueAtTime(0, now + 0.06);
    noiseNode.stop(now + 0.08);
    lfo.stop(now + 0.08);
}

// ==================== 2. 光球飞出（预生成缓冲 + 滤波器差异化） ====================

/** 快捷：播放一段预生成噪声 → 带通滤波 → 增益包络 */
function _playNoiseWhoosh(ctx, t, outGain, freq, q, gainVal, dur) {
    _ensureBuffers();
    const src = ctx.createBufferSource();
    src.buffer = _noiseBufFlat;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(outGain);
    src.start(t);
    src.stop(t + dur + 0.01);
}

/** 快捷：一个振荡器音 */
function _playTone(ctx, t, outGain, freq, type, gainVal, dur, freqEnd) {
    const osc = ctx.createOscillator();
    osc.type = type; osc.frequency.value = freq;
    if (freqEnd) {
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.linearRampToValueAtTime(freqEnd, t + dur * 0.7);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gainVal, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env); env.connect(outGain);
    osc.start(t); osc.stop(t + dur + 0.01);
}

function playOrbEmerge(quality) {
    if (!_soundEnabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const outGain = ctx.createGain();
    outGain.gain.value = MG * 0.35;
    outGain.connect(ctx.destination);

    switch (quality) {
        case 'red':
            _playNoiseWhoosh(ctx, now, outGain, 2200, 1.0, 0.4, 0.09);
            [660, 880, 1100, 1320].forEach((f, i) =>
                _playTone(ctx, now + 0.01 + i * 0.03, outGain, f, 'triangle', 0.08, 0.12));
            break;
        case 'gold':
            _playNoiseWhoosh(ctx, now, outGain, 1800, 0.8, 0.38, 0.08);
            [880, 1100].forEach((f, i) =>
                _playTone(ctx, now + 0.015 + i * 0.025, outGain, f, 'sine', 0.09, 0.11));
            break;
        case 'orange':
            _playNoiseWhoosh(ctx, now, outGain, 1200, 0.7, 0.42, 0.07);
            [600, 800].forEach((f, i) =>
                _playTone(ctx, now + 0.01 + i * 0.035, outGain, f, 'triangle', 0.08, 0.09));
            break;
        case 'purple':
            _playNoiseWhoosh(ctx, now, outGain, 900, 0.6, 0.48, 0.06);
            _playTone(ctx, now, outGain, 500, 'sine', 0.06, 0.05, 750);
            break;
        default: // blue
            _playNoiseWhoosh(ctx, now, outGain, 600, 0.5, 0.42, 0.05);
            break;
    }
}

// ==================== 3. 揭示音效（纯振荡器，无 buffer 创建） ====================

function playReveal(quality) {
    if (!_soundEnabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const outGain = ctx.createGain();
    outGain.gain.value = MG * 0.3;  // 降至原来的一半
    outGain.connect(ctx.destination);

    switch (quality) {
        case 'red':    _revealRed(ctx, now, outGain); break;
        case 'gold':   _revealGold(ctx, now, outGain); break;
        case 'orange': _revealOrange(ctx, now, outGain); break;
        case 'purple': _revealPurple(ctx, now, outGain); break;
        default:       _revealBlue(ctx, now, outGain); break;
    }
}

function _revealBlue(ctx, t, out) {
    _playTone(ctx, t, out, 880, 'sine', 0.35, 0.1);
}
function _revealPurple(ctx, t, out) {
    [660, 880].forEach((f, i) => _playTone(ctx, t + i * 0.08, out, f, 'triangle', 0.28, 0.12));
}
function _revealOrange(ctx, t, out) {
    [523.25, 659.25, 783.99].forEach((f, i) => _playTone(ctx, t + i * 0.07, out, f, 'triangle', 0.24, 0.11));
}
function _revealGold(ctx, t, out) {
    [{f:523.25,g:0.16},{f:659.25,g:0.13},{f:783.99,g:0.10,t:'triangle'},{f:1046.5,g:0.06}]
        .forEach(h => _playTone(ctx, t, out, h.f, h.t || 'sine', h.g, 0.38));
    _playTone(ctx, t + 0.1, out, 2637, 'sine', 0.03, 0.25);
}
function _revealRed(ctx, t, out) {
    [523.25,587.33,659.25,783.99,1046.5].forEach((f,i) => _playTone(ctx, t+i*0.035, out, f, 'triangle', 0.18, 0.06));
    const cs = t + 0.22;
    [{f:523.25,g:0.10},{f:659.25,g:0.09},{f:783.99,g:0.07,t:'triangle'},{f:1046.5,g:0.05,t:'triangle'}]
        .forEach(h => _playTone(ctx, cs, out, h.f, h.t || 'sine', h.g, 0.55));
    _playTone(ctx, cs, out, 130.81, 'sine', 0.12, 0.35);
}

// ==================== 4. 球滚动（预生成缓冲，零分配） ====================

let _rollTimer = null;
let _rollInterval = 60;
let _rolling = false;

function startBallRoll() {
    if (!_soundEnabled) return;
    if (!getCtx() || _rolling) return;
    _ensureBuffers();
    _rolling = true;
    _rollInterval = 40;
    _scheduleRollTick();
}

function stopBallRoll() {
    _rolling = false;
    if (_rollTimer) { clearTimeout(_rollTimer); _rollTimer = null; }
}

function updateBallRollSpeed(speed) {
    if (speed <= 0.01) { stopBallRoll(); return; }
    if (!_rolling) { _rolling = true; _scheduleRollTick(); }
    _rollInterval = 30 + (1 - speed) * (1 - speed) * 500;
}

function _playRollTick() {
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = _noiseBufTick;  // 复用预生成缓冲
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1200 + Math.random() * 800; f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = MG * 0.09;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(now); src.stop(now + 0.022);
}

function _scheduleRollTick() {
    if (!_rolling) return;
    _playRollTick();
    _rollTimer = setTimeout(_scheduleRollTick, _rollInterval * (0.85 + Math.random() * 0.3));
}

// ==================== 5. 球定格 ====================

function playBallStop() {
    if (!_soundEnabled) return;
    const ctx = getCtx();
    if (!ctx) return;
    _ensureBuffers();
    const now = ctx.currentTime;
    const outGain = ctx.createGain();
    outGain.gain.value = MG * 0.55;
    outGain.connect(ctx.destination);

    // 低频"咚"
    _playTone(ctx, now, outGain, 120, 'sine', 0.38, 0.09);

    // 高频敲击（复用预生成缓冲）
    const src = ctx.createBufferSource();
    src.buffer = _noiseBufClick;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 3000;
    const g = ctx.createGain();
    g.gain.value = 0.25;
    src.connect(f); f.connect(g); g.connect(outGain);
    src.start(now); src.stop(now + 0.01);

    // 中频谐振
    _playTone(ctx, now, outGain, 800, 'triangle', 0.08, 0.04);
}

// ==================== 6. 清理 ====================

function dispose() {
    stopBoxShake();
    stopBallRoll();
    if (_audioCtx && _audioCtx.state !== 'closed') {
        _audioCtx.close().catch(() => {});
    }
    _audioCtx = null;
    _shakeNodes = null;
    _noiseBufFlat = null;
    _noiseBufTick = null;
    _noiseBufClick = null;
}

// 页面卸载时自动释放 AudioContext
window.addEventListener('beforeunload', dispose);

// ==================== 挂载 ====================
window.LootboxSoundModule = {
    toggleSound, isSoundEnabled,
    startBoxShake, stopBoxShake,
    playOrbEmerge,
    playReveal,
    startBallRoll, stopBallRoll, updateBallRollSpeed, playBallStop,
    dispose,
};
