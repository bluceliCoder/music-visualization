document.addEventListener('DOMContentLoaded', () => {
    const setupScreen = document.getElementById('setup-screen');
    const configForm = document.getElementById('config-form');
    const songTitleInput = document.getElementById('song-title');
    const artistInput = document.getElementById('artist');
    const audioInput = document.getElementById('audio-file');
    const imageInput = document.getElementById('background-image');
    const lyricsInput = document.getElementById('lyrics-file');
    const colorInput = document.getElementById('color-picker');
    const formMessage = document.getElementById('form-message');
    const playerScreen = document.getElementById('player-container');
    const playerTitle = document.getElementById('player-title');
    const playerArtist = document.getElementById('player-artist');
    const audio = document.getElementById('audioElement');
    const playButton = document.getElementById('playButton');
    const seekBar = document.getElementById('seek-bar');
    const currentTime = document.getElementById('currentTime');
    const duration = document.getElementById('duration');
    const canvas = document.getElementById('visualizer');
    const context = canvas.getContext('2d');
    const lyricsContainer = document.querySelector('.lyrics-container');
    const lyricsElement = document.getElementById('lyrics');
    const coverArt = document.getElementById('cover-art');
    const coverPlaceholder = document.getElementById('cover-placeholder');
    const playerMessage = document.getElementById('player-message');

    let audioUrl = '';
    let artworkUrl = '';
    let audioContext;
    let analyser;
    let mediaSource;
    let frequencyData;
    let visualizerLevels = [];
    let lyricLines = [];
    let activeLyricIndex = -1;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let frame = 0;

    function setMessage(element, message) {
        element.textContent = message;
    }

    function formatTime(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
    }

    function updateFileName(input, element, defaultText) {
        element.textContent = input.files[0]?.name || defaultText;
    }

    function parseLrc(content) {
        const lines = [];
        const timestampPattern = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

        content.split(/\r?\n/).forEach((line) => {
            const timestamps = [...line.matchAll(timestampPattern)];
            const text = line.replace(timestampPattern, '').trim();
            if (!text) return;

            timestamps.forEach((timestamp) => {
                const fraction = timestamp[3] || '';
                const fractionalSeconds = fraction ? Number(fraction) / (10 ** fraction.length) : 0;
                const time = Number(timestamp[1]) * 60 + Number(timestamp[2]) + fractionalSeconds;
                lines.push({ time, text });
            });
        });

        return lines.sort((first, second) => first.time - second.time);
    }

    function renderLyrics(lines) {
        lyricsElement.replaceChildren();
        lyricsElement.style.transform = '';
        lyricLines = [];
        activeLyricIndex = -1;

        if (!lines.length) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'lyrics-empty';
            emptyMessage.textContent = '没有找到带时间戳的歌词。';
            lyricsElement.appendChild(emptyMessage);
            return;
        }

        const fragment = document.createDocumentFragment();
        lines.forEach((line) => {
            const paragraph = document.createElement('p');
            paragraph.textContent = line.text;
            fragment.appendChild(paragraph);
            lyricLines.push(paragraph);
        });
        lyricsElement.appendChild(fragment);
    }

    function syncLyrics() {
        if (!lyricLines.length) return;
        const time = audio.currentTime;
        let low = 0;
        let high = lyricLines.length - 1;
        let match = -1;

        while (low <= high) {
            const middle = Math.floor((low + high) / 2);
            if (time >= lyricLines[middle].dataset.time) {
                match = middle;
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }

        if (match === activeLyricIndex) return;
        activeLyricIndex = match;
        lyricLines.forEach((line, index) => line.classList.toggle('active', index === match));
        if (match >= 0) {
            const line = lyricLines[match];
            const offset = lyricsContainer.clientHeight / 2 - (line.offsetTop + line.offsetHeight / 2);
            lyricsElement.style.transform = `translateY(${offset}px)`;
        }
    }

    function setArtwork(file) {
        if (artworkUrl) URL.revokeObjectURL(artworkUrl);
        artworkUrl = URL.createObjectURL(file);
        coverArt.src = artworkUrl;
        coverArt.hidden = false;
        coverPlaceholder.hidden = true;
    }

    function setTheme(color) {
        setupScreen.style.setProperty('--accent', color);
        playerScreen.style.setProperty('--accent', color);
    }

    function resizeCanvas() {
        const bounds = canvas.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvasWidth = bounds.width;
        canvasHeight = bounds.height;
        canvas.width = Math.round(bounds.width * pixelRatio);
        canvas.height = Math.round(bounds.height * pixelRatio);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function drawVisualizer() {
        frame += 1;
        if (canvasWidth && canvasHeight && !playerScreen.hidden) {
            const centerY = canvasHeight / 2;
            const barCount = Math.max(28, Math.min(64, Math.floor(canvasWidth / 7)));
            const gap = 3;
            const barWidth = Math.max(2, (canvasWidth - gap * (barCount - 1)) / barCount);
            const accent = getComputedStyle(playerScreen).getPropertyValue('--accent').trim();
            const isAnalyzing = analyser && frequencyData && !audio.paused && audioContext?.state === 'running';

            if (isAnalyzing) analyser.getByteFrequencyData(frequencyData);
            if (visualizerLevels.length !== barCount) visualizerLevels = new Array(barCount).fill(0);

            context.clearRect(0, 0, canvasWidth, canvasHeight);
            context.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(0, centerY + 0.5);
            context.lineTo(canvasWidth, centerY + 0.5);
            context.stroke();

            for (let index = 0; index < barCount; index += 1) {
                let energy;
                if (isAnalyzing) {
                    const sampleRate = audioContext.sampleRate;
                    const nyquist = sampleRate / 2;
                    const minFrequency = 35;
                    const maxFrequency = Math.min(16000, nyquist);
                    const lowerFrequency = minFrequency * (maxFrequency / minFrequency) ** (index / barCount);
                    const upperFrequency = minFrequency * (maxFrequency / minFrequency) ** ((index + 1) / barCount);
                    const firstBin = Math.max(1, Math.floor(lowerFrequency * analyser.fftSize / sampleRate));
                    const lastBin = Math.min(frequencyData.length - 1, Math.max(firstBin, Math.ceil(upperFrequency * analyser.fftSize / sampleRate)));
                    let peak = 0;
                    for (let bin = firstBin; bin <= lastBin; bin += 1) {
                        peak = Math.max(peak, frequencyData[bin]);
                    }
                    energy = Math.min(1, (peak / 255) * 1.35);
                    visualizerLevels[index] += (energy - visualizerLevels[index]) * (energy > visualizerLevels[index] ? 0.72 : 0.2);
                } else {
                    visualizerLevels[index] *= 0.88;
                }
                const idleMotion = 0.035 + Math.abs(Math.sin(frame * 0.018 + index * 0.31)) * 0.035;
                const barHeight = Math.max(3, (visualizerLevels[index] + (isAnalyzing ? 0 : idleMotion)) * canvasHeight * 0.92);
                const x = index * (barWidth + gap);
                const gradient = context.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
                gradient.addColorStop(0, '#f4f0e4');
                gradient.addColorStop(0.48, accent);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0.36)');
                context.fillStyle = gradient;
                context.globalAlpha = isAnalyzing ? 0.92 : 0.42;
                context.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
            }
            context.globalAlpha = 1;
        }
        window.requestAnimationFrame(drawVisualizer);
    }

    async function loadLyrics(file) {
        if (!file) return;
        try {
            const content = await file.text();
            const lines = parseLrc(content);
            renderLyrics(lines);
            lines.forEach((line, index) => {
                lyricLines[index].dataset.time = String(line.time);
            });
        } catch (error) {
            console.error('读取歌词文件失败:', error);
            setMessage(playerMessage, '歌词文件读取失败，请检查文件后重试。');
        }
    }

    audioInput.addEventListener('change', () => {
        updateFileName(audioInput, document.getElementById('audio-file-name'), 'MP3、M4A、WAV 等格式');
        setMessage(formMessage, '');
    });
    imageInput.addEventListener('change', () => {
        updateFileName(imageInput, document.getElementById('background-file-name'), '添加一张图片');
        setMessage(formMessage, '');
    });
    lyricsInput.addEventListener('change', () => {
        updateFileName(lyricsInput, document.getElementById('lyrics-file-name'), '支持 .lrc 文件');
        setMessage(formMessage, '');
    });
    colorInput.addEventListener('input', () => setTheme(colorInput.value));

    configForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const selectedAudio = audioInput.files[0];
        const selectedImage = imageInput.files[0];
        const selectedLyrics = lyricsInput.files[0];
        if (!selectedAudio && !audioUrl) {
            setMessage(formMessage, '请先添加一首音频，再进入聆听空间。');
            audioInput.focus();
            return;
        }

        setMessage(formMessage, '');
        if (selectedAudio) {
            if (audioUrl) URL.revokeObjectURL(audioUrl);
            audioUrl = URL.createObjectURL(selectedAudio);
            audio.src = audioUrl;
            audio.load();
        }
        if (selectedImage) setArtwork(selectedImage);

        playerTitle.textContent = songTitleInput.value.trim()
            || (selectedAudio ? selectedAudio.name.replace(/\.[^.]+$/, '') : playerTitle.textContent)
            || '未命名曲目';
        playerArtist.textContent = artistInput.value.trim() || '未知演唱者';
        setTheme(colorInput.value);

        if (selectedLyrics) await loadLyrics(selectedLyrics);
        playerScreen.hidden = false;
        setupScreen.hidden = true;
        window.requestAnimationFrame(resizeCanvas);
        setMessage(playerMessage, '');
    });

    document.getElementById('edit-config').addEventListener('click', () => {
        audio.pause();
        playerScreen.hidden = true;
        setupScreen.hidden = false;
        setMessage(playerMessage, '');
        window.requestAnimationFrame(resizeCanvas);
        songTitleInput.focus();
    });

    playButton.addEventListener('click', () => {
        if (audio.paused) {
            audio.play().catch((error) => {
                console.error('音频播放失败:', error);
                setMessage(playerMessage, '无法播放此音频，请尝试其他文件格式。');
            });
        } else {
            audio.pause();
        }
    });

    audio.addEventListener('play', async () => {
        setMessage(playerMessage, '');
        playButton.classList.add('playing');
        playButton.setAttribute('aria-label', '暂停');
        try {
            if (!audioContext) {
                const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextConstructor) throw new Error('此浏览器不支持音频分析');
                audioContext = new AudioContextConstructor();
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 2048;
                analyser.smoothingTimeConstant = 0.74;
                frequencyData = new Uint8Array(analyser.frequencyBinCount);
                mediaSource = audioContext.createMediaElementSource(audio);
                mediaSource.connect(analyser);
                analyser.connect(audioContext.destination);
            }
            if (audioContext.state === 'suspended') await audioContext.resume();
        } catch (error) {
            console.error('初始化音频可视化失败:', error);
            setMessage(playerMessage, '音频可以继续播放，但无法启动可视化。');
        }
    });

    audio.addEventListener('pause', () => {
        playButton.classList.remove('playing');
        playButton.setAttribute('aria-label', '播放');
    });
    audio.addEventListener('ended', () => {
        seekBar.value = '0';
        currentTime.textContent = '0:00';
        audio.currentTime = 0;
    });
    audio.addEventListener('timeupdate', () => {
        const total = audio.duration;
        if (Number.isFinite(total) && total > 0) {
            seekBar.value = String((audio.currentTime / total) * 1000);
            currentTime.textContent = formatTime(audio.currentTime);
        }
        syncLyrics();
    });
    audio.addEventListener('loadedmetadata', () => {
        duration.textContent = formatTime(audio.duration);
    });
    audio.addEventListener('error', () => {
        if (audio.currentSrc) {
            setMessage(playerMessage, '无法读取此音频文件，请尝试 MP3、M4A 或 WAV 格式。');
        }
    });

    seekBar.addEventListener('input', () => {
        const total = audio.duration;
        if (Number.isFinite(total) && total > 0) {
            const time = (Number(seekBar.value) / 1000) * total;
            currentTime.textContent = formatTime(time);
        }
    });
    seekBar.addEventListener('change', () => {
        const total = audio.duration;
        if (Number.isFinite(total) && total > 0) {
            audio.currentTime = (Number(seekBar.value) / 1000) * total;
        }
    });

    window.addEventListener('resize', resizeCanvas);
    setTheme(colorInput.value);
    resizeCanvas();
    drawVisualizer();
});
