import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6;
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

async function loadModels() {
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        console.log("AI Models Loaded");
    } catch (e) { console.error("Models failed:", e); }
}
loadModels();

/**
 * FIXED GEMINI ANALYSIS
 */
async function analyzeEnvironment(file) {
    try {
        const base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });

        // Gemini 1.5 expects parts containing text and inlineData
        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: file.type, data: base64Data } },
                    { text: "Identify the location, street names, landmarks, or shop signs in this photo. Describe the surroundings to help find this person. Keep it under 50 words." }
                ]
            }]
        });

        return result.response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Environmental scan failed. Please check the photo manually.";
    }
}

/**
 * REGISTRATION
 */
async function addMissingPerson() {
    const status = document.getElementById('status');
    const name = document.getElementById('name').value.trim();
    const photoInput = document.getElementById('missing-photo');

    if (!name || !photoInput.files[0]) {
        status.innerText = "⚠️ Missing name or photo.";
        return;
    }

    status.innerHTML = `<span class="spinner"></span> Encoding Face...`;

    try {
        const img = await faceapi.bufferToImage(photoInput.files[0]);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        
        if (!detection) throw new Error("Face not detected.");

        const person = {
            name,
            email: document.getElementById('email').value,
            contact: document.getElementById('contact').value,
            location: document.getElementById('location').value,
            descriptor: Array.from(detection.descriptor)
        };

        const db = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        db.push(person);
        localStorage.setItem('foundPeople', JSON.stringify(db));

        status.innerText = `✅ Registered: ${name}`;
    } catch (e) { status.innerText = `❌ Error: ${e.message}`; }
}

/**
 * SCAN & MATCH
 */
async function checkFoundPerson() {
    const resultDiv = document.getElementById('result');
    const file = document.getElementById('found-photo').files[0];
    const finderEmail = document.getElementById('finder-email').value;

    if (!file || !finderEmail) {
        resultDiv.innerText = "⚠️ Photo and email required.";
        return;
    }

    resultDiv.innerHTML = `<span class="spinner"></span> Scanning & Analyzing Location...`;

    try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        // Even if no face, we still run Gemini to provide the family/system info
        const locationReport = await analyzeEnvironment(file);

        if (!detection) {
            resultDiv.innerHTML = `<div style="color:orange">⚠️ Face not found, but scan says: ${locationReport}</div>`;
            return;
        }

        const db = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        let match = null;

        db.forEach(person => {
            const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(person.descriptor));
            if (dist < threshold) match = person;
        });

        if (match) {
            resultDiv.innerHTML = `<span class="spinner"></span> Match! Sending Alert...`;
            
            await emailjs.send('service_kebubpr', 'template_0i301n8', {
                to_email: match.email,
                contact_name: match.contact,
                missing_name: match.name,
                message: `ALERT: Match found! Location info: ${locationReport}. Contact Finder: ${finderEmail}`
            });

            resultDiv.innerHTML = `<div style="color:var(--green)">✅ Match: ${match.name}<br>Location: ${locationReport}</div>`;
        } else {
            resultDiv.innerHTML = `<div style="color:var(--muted)">❌ No match, but Gemini suggests: ${locationReport}</div>`;
        }
    } catch (e) { resultDiv.innerText = `❌ Error: ${e.message}`; }
}

window.addMissingPerson = addMissingPerson;
window.checkFoundPerson = checkFoundPerson;
