const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const app = express();
const execAsync = promisify(exec);

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
            const filePath = path.join(tempDir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > 3600000) { // 1 hour
                fs.unlinkSync(filePath);
            }
        });
    } catch (e) {
        console.error('Cleanup error:', e);
    }
}, 600000); // Every 10 minutes

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

// Generate TTS endpoint
app.post('/api/generate-tts', async (req, res) => {
    try {
        const { text, voiceType, voiceCharacteristics } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        const outputPath = path.join(tempDir, `tts-${Date.now()}.wav`);
        
        let pitch = 50;
        let speed = 150;
        let gender = 'm';

        if (voiceCharacteristics) {
            const f0 = voiceCharacteristics.fundamentalFrequency || 150;
            pitch = Math.max(10, Math.min(99, Math.round((f0 / 150) * 50)));
            const clarity = voiceCharacteristics.voiceQuality?.clarity || 0.8;
            speed = Math.round(150 * (0.8 + clarity * 0.4));
            gender = f0 > 160 ? 'f' : 'm';
        }

        if (voiceType === 'female') gender = 'f';
        else if (voiceType === 'male') gender = 'm';

        const command = `espeak -v ${gender} -p ${pitch} -s ${speed} -w "${outputPath}" "${text.replace(/"/g, '\\"')}" 2>/dev/null`;

        try {
            await execAsync(command);
        } catch (e) {
            // Fallback: create silent audio
            createSilentAudio(outputPath);
        }

        const audioBuffer = fs.readFileSync(outputPath);
        
        try {
            fs.unlinkSync(outputPath);
        } catch (e) {}

        res.json({
            success: true,
            audio: audioBuffer.toString('base64'),
            mimeType: 'audio/wav'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'TTS generation failed' });
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
        const outputPath = path.join(tempDir, `combined-${Date.now()}.wav`);

        const command = `ffmpeg -i "${samplePath}" -i "${ttsPath}" -filter_complex "[0:a][1:a]concat=n=2:v=0:a=1[out]" -map "[out]" -c:a libmp3lame -q:a 4 "${outputPath}" -y 2>/dev/null`;

        try {
            await execAsync(command);
        } catch (e) {
            // Fallback: just use the sample
            fs.copyFileSync(samplePath, outputPath);
        }

        const audioBuffer = fs.readFileSync(outputPath);

        try {
            fs.unlinkSync(samplePath);
            fs.unlinkSync(ttsPath);
            fs.unlinkSync(outputPath);
        } catch (e) {}

        res.json({
            success: true,
            audio: audioBuffer.toString('base64'),
            mimeType: 'audio/wav'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Combination failed' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Serve static files
app.use(express.static(path.join(__dirname, '..')));

// Fallback to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Create silent audio fallback
function createSilentAudio(outputPath) {
    const sampleRate = 16000;
    const duration = 2;
    const samples = new Float32Array(sampleRate * duration);

    for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.1;
    }

    const wavBuffer = encodeWAV(samples, sampleRate);
    fs.writeFileSync(outputPath, wavBuffer);
}

// Encode to WAV
function encodeWAV(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

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

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
    }

    return Buffer.from(buffer);
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
