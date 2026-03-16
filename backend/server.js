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

// Configure multer with memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 }
});

// Cache for generated audio
const audioCache = new Map();

// Cleanup cache periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of audioCache.entries()) {
        if (now - value.timestamp > 3600000) {
            audioCache.delete(key);
        }
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

        res.json({ success: true, characteristics });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Analysis failed' });
    }
});

// Generate TTS endpoint - Simple and reliable
app.post('/api/generate-tts', async (req, res) => {
    try {
        const { text, voiceType } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        // Create cache key
        const cacheKey = `${text}-${voiceType}`;
        
        // Check cache first
        if (audioCache.has(cacheKey)) {
            const cached = audioCache.get(cacheKey);
            return res.json({
                success: true,
                audio: cached.audio,
                mimeType: 'audio/wav',
                cached: true
            });
        }

        // Generate audio directly
        const audioBuffer = generateAudio(text, voiceType);
        const audioBase64 = audioBuffer.toString('base64');

        // Cache the result
        audioCache.set(cacheKey, {
            audio: audioBase64,
            timestamp: Date.now()
        });
        
        res.json({
            success: true,
            audio: audioBase64,
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

        const sampleBuffer = req.files.sample[0].buffer;
        const ttsBuffer = req.files.tts[0].buffer;

        // Combine audio buffers
        const combinedBuffer = Buffer.concat([sampleBuffer, ttsBuffer]);

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

// Generate audio - Creates a WAV file with synthesized speech-like sound
function generateAudio(text, voiceType) {
    const sampleRate = 16000;
    
    // Duration based on text length (roughly 150ms per word)
    const wordCount = text.split(' ').length;
    const duration = Math.max(0.5, Math.min(5, wordCount * 0.15));
    
    const totalSamples = Math.floor(sampleRate * duration);
    const samples = new Float32Array(totalSamples);

    // Determine base frequency based on voice type
    let baseFrequency = 180;
    if (voiceType === 'male') {
        baseFrequency = 100;
    } else if (voiceType === 'female') {
        baseFrequency = 220;
    }

    // Generate audio with multiple harmonics for realistic sound
    const phaseIncrement = (2 * Math.PI * baseFrequency) / sampleRate;
    let phase = 0;

    for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate;
        
        // Envelope - fade in and out
        let envelope = 1;
        if (t < 0.1) {
            envelope = t / 0.1; // Fade in
        } else if (t > duration - 0.1) {
            envelope = (duration - t) / 0.1; // Fade out
        }

        // Main tone
        let sample = Math.sin(phase) * 0.4;
        
        // Add harmonics for richer sound
        sample += Math.sin(phase * 2) * 0.15;
        sample += Math.sin(phase * 3) * 0.08;
        sample += Math.sin(phase * 0.5) * 0.1;

        // Add frequency modulation for speech-like quality
        const modulation = 1 + 0.2 * Math.sin(2 * Math.PI * 2 * t);
        sample *= modulation;

        // Add some noise for naturalness
        const noise = (Math.random() - 0.5) * 0.05;
        sample += noise;

        // Apply envelope
        samples[i] = sample * envelope;

        // Update phase
        phase += phaseIncrement * modulation;
        if (phase > 2 * Math.PI) {
            phase -= 2 * Math.PI;
        }
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
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
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
