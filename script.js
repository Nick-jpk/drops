// Get API base URL based on environment
const getAPIBaseURL = () => {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isDev ? 'http://localhost:3001/api' : '/api';
};

const API_BASE_URL = getAPIBaseURL();

let uploadedFile = null;
let voiceCharacteristics = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupUploadBox();
    setupGenerateButton();
    setupContactForm();
});

// Setup upload box
function setupUploadBox() {
    const uploadBox = document.getElementById('uploadBox');
    const audioInput = document.getElementById('audioInput');

    uploadBox.addEventListener('click', () => audioInput.click());

    uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.style.backgroundColor = 'rgba(233, 69, 96, 0.2)';
    });

    uploadBox.addEventListener('dragleave', () => {
        uploadBox.style.backgroundColor = 'rgba(233, 69, 96, 0.05)';
    });

    uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.style.backgroundColor = 'rgba(233, 69, 96, 0.05)';
        handleFileUpload(e.dataTransfer.files[0]);
    });

    audioInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
        }
    });
}

// Handle file upload
function handleFileUpload(file) {
    if (!file.type.startsWith('audio/')) {
        alert('Please upload an audio file');
        return;
    }

    uploadedFile = file;
    const uploadBox = document.getElementById('uploadBox');
    const uploadStatus = document.getElementById('uploadStatus');
    const fileName = document.getElementById('fileName');
    const audioPreview = document.getElementById('audioPreview');

    fileName.textContent = file.name;
    uploadBox.style.display = 'none';
    uploadStatus.style.display = 'block';

    const reader = new FileReader();
    reader.onload = (e) => {
        audioPreview.src = e.target.result;
    };
    reader.readAsDataURL(file);

    // Analyze voice characteristics
    analyzeVoice(file);

    // Enable generate button
    updateGenerateButtonState();
}

// Analyze voice characteristics
async function analyzeVoice(file) {
    try {
        const formData = new FormData();
        formData.append('audio', file);

        const response = await fetch(`${API_BASE_URL}/analyze-voice`, {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            voiceCharacteristics = data.characteristics;
            console.log('Voice analyzed:', voiceCharacteristics);
        }
    } catch (error) {
        console.error('Error analyzing voice:', error);
    }
}

// Setup generate button
function setupGenerateButton() {
    const generateBtn = document.getElementById('generateBtn');
    generateBtn.addEventListener('click', generateDrop);
}

// Update generate button state
function updateGenerateButtonState() {
    const generateBtn = document.getElementById('generateBtn');
    const textInput = document.getElementById('textInput');
    const hasFile = uploadedFile !== null;
    const hasText = textInput.value.trim().length > 0;

    generateBtn.disabled = !(hasFile && hasText);
}

// Listen to text input changes
document.getElementById('textInput').addEventListener('input', updateGenerateButtonState);

// Generate DJ drop
async function generateDrop() {
    const textInput = document.getElementById('textInput');
    const voiceType = document.getElementById('voiceType');
    const generateBtn = document.getElementById('generateBtn');
    const loadingStatus = document.getElementById('loadingStatus');
    const resultStatus = document.getElementById('resultStatus');

    if (!uploadedFile || !textInput.value.trim()) {
        alert('Please upload a file and enter text');
        return;
    }

    // Show loading
    generateBtn.disabled = true;
    loadingStatus.style.display = 'block';
    resultStatus.style.display = 'none';

    try {
        // Step 1: Generate TTS
        const ttsResponse = await fetch(`${API_BASE_URL}/generate-tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: textInput.value,
                voiceType: voiceType.value,
                voiceCharacteristics: voiceCharacteristics
            })
        });

        if (!ttsResponse.ok) throw new Error('TTS generation failed');
        const ttsData = await ttsResponse.json();

        // Step 2: Combine audio
        const formData = new FormData();
        formData.append('sample', uploadedFile);
        formData.append('tts', base64ToBlob(ttsData.audio, 'audio/wav'));

        const combineResponse = await fetch(`${API_BASE_URL}/combine-audio`, {
            method: 'POST',
            body: formData
        });

        if (!combineResponse.ok) throw new Error('Audio combination failed');
        const combineData = await combineResponse.json();

        // Display result
        const resultAudio = document.getElementById('resultAudio');
        resultAudio.src = 'data:audio/wav;base64,' + combineData.audio;

        loadingStatus.style.display = 'none';
        resultStatus.style.display = 'block';

        // Setup download button
        document.getElementById('downloadBtn').addEventListener('click', () => {
            const link = document.createElement('a');
            link.href = 'data:audio/wav;base64,' + combineData.audio;
            link.download = `dj-drop-${Date.now()}.wav`;
            link.click();
        });

    } catch (error) {
        console.error('Error:', error);
        alert('Error generating drop: ' + error.message);
        loadingStatus.style.display = 'none';
    } finally {
        generateBtn.disabled = false;
    }
}

// Convert base64 to blob
function base64ToBlob(base64, mimeType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
}

// Setup contact form
function setupContactForm() {
    const form = document.getElementById('contactForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            alert('Thank you! We will get back to you soon.');
            form.reset();
        });
    }
}
