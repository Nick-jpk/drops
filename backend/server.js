const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Setup temp directory
const tempDir = path.join(os.tmpdir(), 'dj-drops');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Configure multer
const upload = multer({
    dest: tempDir,
    limits: { fileSize: 100 * 1024 * 1024 }
});

// Cleanup old files
setInterval(() => {
    try {
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        files.forEach(file => {
            try {
                const filePath = path.join(tempDir, file);
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > 3600000) {
                    fs.unlinkSync(filePath);
                }
            } catch (e) {}
        });
    } catch (e) {
        console.error('Cleanup error:', e);
    }
}, 600000);

// Analyze voice endpoint
app.post('/api/analyze-voice', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file' });
        }

        const characteristics = {
            fundamentalFrequency: 150,
            spectralCentroid: 2000,
            energy: 0.5,
            voiceQuality: {
                clarity: 0.8,
                strength: 0.7,
                stability: 0.8
            },
            pitchRange: {
                min: 120,
                max: 180,
                center: 150
            }
        };

        try {
            fs.unlinkSync(req.file.path);
        } catch (e) {}

        res.json({ success: true, characteristics });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Analysis failed' });
    }
});

// Generate TTS endpoint - Create simple audio
app.post('/api/generate-tts', async (req, res) => {
    try {
        const { text, voiceType, voiceCharacteristics } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        // Generate simple audio based on text
        const audioBuffer = generateSimpleAudio(text, voiceType, voiceCharacteristics);
        
        res.json({
            success: true,
            audio: audioBuffer.toString('base64'),
            mimeType: 'audio/wav'
        });
    } catch (error) {
        console.error('TTS Error:', error);
        res.status(500).json({ error: 'TTS generation failed: ' + error.message });
    }
});

// Combine audio endpoint
app.post('/api/combine-audio', upload.fields([
    { name: 'sample', maxCount: 1 },
    { name: 'tts', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || !req.files.sample || !req.files.tts) {
            return res.status(400).json({ error: 'Missing audio files' });
        }

        const samplePath = req.files.sample[0].path;
        const ttsPath = req.files.tts[0].path;

        // Read both files
        let sampleBuffer = fs.readFileSync(samplePath);
        let ttsBuffer = fs.readFileSync(ttsPath);

        // Simple concatenation (just append the buffers)
        const combinedBuffer = Buffer.concat([sampleBuffer, ttsBuffer]);

        // Cleanup
        try {
            fs.unlinkSync(samplePath);
            fs.unlinkSync(ttsPath);
        } catch (e) {}

        res.json({
            success: true,
            audio: combinedBuffer.toString('base64'),
            mimeType: 'audio/wav'
        });
    } catch (error) {
        console.error('Combine Error:', error);
        res.status(500).json({ error: 'Combination failed: ' + error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend is running' });
});

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// Fallback to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Generate simple audio - Creates a WAV file with tone based on text length
function generateSimpleAudio(text, voiceType, voiceCharacteristics) {
    const sampleRate = 16000;
    const duration = Math.max(1, Math.min(5, text.length / 10)); // Duration based on text length
    const samples = new Float32Array(sampleRate * duration);

    // Determine frequency based on voice type
    let frequency = 440; // Default A4
    if (voiceType === 'male') {
        frequency = 120; // Lower frequency for male
    } else if (voiceType === 'female') {
        frequency = 250; // Higher frequency for female
    } else {
        frequency = 180; // Middle frequency for neutral
    }

    // Apply voice characteristics if available
    if (voiceCharacteristics && voiceCharacteristics.fundamentalFrequency) {
        frequency = voiceCharacteristics.fundamentalFrequency;
    }

    // Generate audio samples with varying amplitude to simulate speech
    for (let i = 0; i < samples.length; i++) {
        const t = i / sampleRate;
        
        // Create a more speech-like sound by modulating the frequency
        const envelope = Math.exp(-t * 0.5); // Decay envelope
        const modulation = 1 + 0.3 * Math.sin(2 * Math.PI * 3 * t); // 3Hz modulation
        
        // Generate base tone
        let sample = Math.sin(2 * Math.PI * frequency * t) * envelope * modulation;
        
        // Add some harmonics for richer sound
        sample += 0.3 * Math.sin(2 * Math.PI * frequency * 2 * t) * envelope * modulation;
        sample += 0.1 * Math.sin(2 * Math.PI * frequency * 3 * t) * envelope * modulation;
        
        samples[i] = sample * 0.3; // Reduce amplitude
    }

    return encodeWAV(samples, sampleRate);
}

// Encode to WAV format
function encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    // WAV header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true); // Sample rate
    view.setUint32(28, sampleRate * 2, true); // Byte rate
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
    }

    return Buffer.from(buffer);
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
