import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. CONFIG
const API_KEY = "AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

emailjs.init("OCug6QTCHUuWt7iCr");

// Hosted models to ensure they load on Vercel
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
const threshold = 0.6;

// 2. INITIALIZE MODELS
async function initSystem() {
    const status = document.getElementById('status');
    try {
        console.log("Loading models...");
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        status.innerHTML = "✅ System ready for registration...";
        status.style.color = "var(--green)";
    } catch (err) {
        console.error("Model load failed:", err);
        status.innerHTML = "❌ AI initialization failed. Refresh page.";
    }
}
initSystem();

// 3. REGISTER FUNCTION
async function addMissingPerson() {
    const status = document.getElementById('status');
    const btn = document.querySelector('.btn-missing');
    const name = document.getElementById('name').value.trim();
    const photoInput = document.getElementById('missing-photo');

    if (!name || photoInput.files.length === 0) {
        alert("Please provide a name and a clear photo.");
        return;
    }

    // UI Feedback
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Registering...`;
    status.innerHTML = "🔍 Scanning face features...";

    try {
        const img = await faceapi.bufferToImage(photoInput.files[0]);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) throw new Error("Face not detected. Try a clearer photo.");

        const personData = {
            name,
            email: document.getElementById('email').value,
            contact: document.getElementById('contact').value,
            descriptor: Array.from(detection.descriptor)
        };

        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        stored.push(personData);
        localStorage.setItem('foundPeople', JSON.stringify(stored));

        status.innerHTML = `✅ ${name} registered successfully!`;
        btn.innerHTML = "Register Database";
    } catch (e) {
        alert(e.message);
        status.innerHTML = `❌ Error: ${e.message}`;
    } finally {
        btn.disabled = false;
    }
}

// 4. CHECK FUNCTION
async function checkFoundPerson() {
    const resultDiv = document.getElementById('result');
    const btn = document.querySelector('.btn-found');
    const file = document.getElementById('found-photo').files[0];

    if (!file) {
        alert("Please upload a photo of the person found.");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Scanning...`;
    resultDiv.innerHTML = "🔍 Matching face...";

    try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) throw new Error("Face not detected.");

        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        let match = null;

        for (let person of stored) {
            const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(person.descriptor));
            if (dist < threshold) { match = person; break; }
        }

        if (match) {
            resultDiv.innerHTML = "🧠 Match found! Analyzing location...";
            const report = await analyzeEnvironment(file);
            resultDiv.innerHTML = `<div style="color:var(--green)">✅ Match: ${match.name}! Location: ${report}</div>`;
        } else {
            resultDiv.innerHTML = "❌ No match found.";
        }
    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = "Scan for Match";
    }
}

// --- GEMINI & EMAIL HELPERS ---
async function analyzeEnvironment(file) {
    const base64 = await new Promise(r => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });
    const result = await model.generateContent(["Describe the location/landmarks in this photo.", { inlineData: { data: base64, mimeType: file.type } }]);
    return result.response.text();
}

// CRITICAL FIX: Attach functions to window so buttons work
window.addMissingPerson = addMissingPerson;
window.checkFoundPerson = checkFoundPerson;
