const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// ElevenLabs API Configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_98f68a2a4538384ad19fab4b417c46668297f4ab4668cac1';
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Voice IDs for ElevenLabs
const VOICE_IDS = {
    'male': '21m00Tcm4TlvDq8ikWAM', // Adam - Male voice
    'female': 'EXAVITQu4vr4xnSDxMaL', // Bella - Female voice
    'neutral': 'pNInz6obpgDQGcFmaJgB' // Callum - Neutral voice
};

// Setup temp directory
const tempDir = path.join(os.tmpdir(), 'dj-drops');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

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

// Generate TTS using ElevenLabs
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

        // Get voice ID
        const voiceId = VOICE_IDS[voiceType] || VOICE_IDS['neutral'];

        // Call ElevenLabs API
        const audioBuffer = await callElevenLabsAPI(text, voiceId);
        
        if (!audioBuffer) {
            throw new Error('Failed to generate audio from ElevenLabs');
        }

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

// Call ElevenLabs API
function callElevenLabsAPI(text, voiceId) {
    return new Promise((resolve, reject) => {
        try {
            const url = `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`;
            
            const options = {
                method: 'POST',
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                }
            };

            const data = JSON.stringify({
                text: text,
                model_id: 'eleven_monolingual_v1',
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.75
                }
            });

            const req = https.request(url, options, (res) => {
                let audioData = Buffer.alloc(0);

                res.on('data', (chunk) => {
                    audioData = Buffer.concat([audioData, chunk]);
                });

                res.on('end', () => {
                    if (res.statusCode === 200) {
                        resolve(audioData);
                    } else {
                        console.error('ElevenLabs API Error:', res.statusCode, audioData.toString());
                        reject(new Error(`ElevenLabs API returned status ${res.statusCode}`));
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Request error:', error);
                reject(error);
            });

            req.write(data);
            req.end();
        } catch (error) {
            reject(error);
        }
    });
}

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

        // Fast concatenation
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
    res.json({ 
        status: 'ok', 
        message: 'Backend is running',
        elevenLabsConfigured: ELEVENLABS_API_KEY !== 'sk_free_demo_key'
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// Fallback to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error: ' + err.message });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`ElevenLabs API Key configured: ${ELEVENLABS_API_KEY !== 'sk_free_demo_key'}`);
});

module.exports = app;
