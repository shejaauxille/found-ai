import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

emailjs.init("OCug6QTCHUuWt7iCr");

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
const threshold = 0.6;

async function loadModels() {
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    console.log("AI Models Loaded");
}
loadModels();

/**
 * GEMINI LANDMARK SCAN (Rwanda Optimized)
 */
async function analyzeEnvironment(file) {
    try {
        const base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: file.type, data: base64Data } },
                    { text: "Identify the location in Rwanda. Look for the Kigali Convention Center, Rwandan flag, or specific street signs. Describe the surroundings and the person's status to help their family." }
                ]
            }]
        });
        return result.response.text();
    } catch (e) { return "Could not determine location."; }
}

/**
 * REGISTER PERSON
 */
window.addMissingPerson = async () => {
    const status = document.getElementById('status');
    const name = document.getElementById('name').value;
    const photo = document.getElementById('missing-photo').files[0];

    if (!name || !photo) return alert("Fill all fields");

    status.innerHTML = `<span class="spinner"></span> Extracting face...`;

    const img = await faceapi.bufferToImage(photo);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
        status.innerText = "❌ No face found. Try again.";
        return;
    }

    const person = {
        name,
        email: document.getElementById('email').value,
        descriptor: Array.from(detection.descriptor)
    };

    const db = JSON.parse(localStorage.getItem('rwanda_db') || '[]');
    db.push(person);
    localStorage.setItem('rwanda_db', JSON.stringify(db));
    status.innerText = "✅ Saved to Database";
};

/**
 * SCAN FOUND (Gemini + Face API)
 */
window.checkFoundPerson = async () => {
    const resultDiv = document.getElementById('result');
    const photo = document.getElementById('found-photo').files[0];

    if (!photo) return alert("Upload photo");

    resultDiv.innerHTML = `<span class="spinner"></span> AI Scanning (Face & Landmarks)...`;

    // 1. Run Gemini first (It identifies the Convention Center / Flag)
    const locationReport = await analyzeEnvironment(photo);

    // 2. Try Face Recognition
    try {
        const img = await faceapi.bufferToImage(photo);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        
        const db = JSON.parse(localStorage.getItem('rwanda_db') || '[]');
        let match = null;

        if (detection && db.length > 0) {
            db.forEach(person => {
                // FIXED: Ensure descriptor exists and is valid length
                if (person.descriptor && person.descriptor.length === 128) {
                    const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(person.descriptor));
                    if (dist < threshold) match = person;
                }
            });
        }

        if (match) {
            resultDiv.innerHTML = `<b style="color:var(--green)">✅ MATCH: ${match.name}</b><br><br><b>Location Report:</b> ${locationReport}`;
            // Send Email here...
        } else {
            resultDiv.innerHTML = `<b style="color:orange">🔍 Person not in database, but Gemini identified location:</b><br><br>${locationReport}`;
        }
    } catch (e) {
        resultDiv.innerHTML = `<b>Location Scan:</b> ${locationReport}<br><br><small>Face Scan Error: ${e.message}</small>`;
    }
};
