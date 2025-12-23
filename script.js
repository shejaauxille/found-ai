import { GoogleGenerativeAI } from "@google/generative-ai";

// API KEY & CONFIG
const API_KEY = "AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash",
    // OVERRIDE SAFETY: Prevents the AI from blocking photos with faces
    safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ]
});

emailjs.init("OCug6QTCHUuWt7iCr");

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
const threshold = 0.6;

async function loadModels() {
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        console.log("AI Models Ready");
    } catch (e) { console.error("Face-API Error:", e); }
}
loadModels();

/**
 * GEMINI SCAN: LANDMARKS & ENVIRONMENT (STRICT FIX)
 */
async function analyzeEnvironment(file) {
    try {
        // CLEAN BASE64: We must strip the header (data:image/...) or Gemini will fail
        const base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });

        const prompt = "MANDATORY: Identify the landmarks in this photo. Specifically check for the Kigali Convention Center, BK Arena, or Rwandan flags. Describe the street and the surroundings in Kigali, Rwanda to help a family find this person.";

        const result = await model.generateContent({
            contents: [{
                role: 'user',
                parts: [
                    { inlineData: { mimeType: file.type, data: base64Data } },
                    { text: prompt }
                ]
            }]
        });

        return result.response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Environmental scan failed. Please check landmarks manually.";
    }
}

/**
 * REGISTER PERSON
 */
async function addMissingPerson() {
    const status = document.getElementById('status');
    const name = document.getElementById('name').value.trim();
    const photo = document.getElementById('missing-photo').files[0];

    if (!name || !photo) { status.innerText = "⚠️ Provide name and photo."; return; }

    status.innerHTML = `<span class="spinner"></span> Encoding Face...`;

    try {
        const img = await faceapi.bufferToImage(photo);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) throw new Error("No face detected.");

        const person = {
            name,
            email: document.getElementById('email').value,
            contact: document.getElementById('contact').value,
            descriptor: Array.from(detection.descriptor)
        };

        const db = JSON.parse(localStorage.getItem('rwanda_db') || '[]');
        db.push(person);
        localStorage.setItem('rwanda_db', JSON.stringify(db));

        status.innerHTML = `<span style="color:var(--green)">✅ Registered: ${name}</span>`;
    } catch (e) { status.innerText = `❌ ${e.message}`; }
}

/**
 * SCAN FOUND (FACE + GEMINI LOCATION)
 */
async function checkFoundPerson() {
    const resultDiv = document.getElementById('result');
    const file = document.getElementById('found-photo').files[0];
    const finderEmail = document.getElementById('finder-email').value;

    if (!file || !finderEmail) { resultDiv.innerText = "⚠️ Missing info."; return; }

    resultDiv.innerHTML = `<span class="spinner"></span> Gemini is scanning landmarks...`;

    try {
        // 1. Run Gemini Location Analysis
        const locationReport = await analyzeEnvironment(file);
        
        // 2. Run Face Matching
        resultDiv.innerHTML = `<span class="spinner"></span> Searching Face Database...`;
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        
        const db = JSON.parse(localStorage.getItem('rwanda_db') || '[]');
        let match = null;

        if (detection && db.length > 0) {
            db.forEach(person => {
                if (person.descriptor && person.descriptor.length === detection.descriptor.length) {
                    const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(person.descriptor));
                    if (dist < threshold) match = person;
                }
            });
        }

        if (match) {
            resultDiv.innerText = "⏳ Match Found! Sending Email...";
            
            await emailjs.send('service_kebubpr', 'template_0i301n8', {
                to_email: match.email,
                contact_name: match.contact,
                missing_name: match.name,
                message: `URGENT: ${match.name} found near: ${locationReport}. Contact: ${finderEmail}`
            });

            resultDiv.innerHTML = `<div style="color:var(--green)"><b>✅ MATCH: ${match.name}</b><br><br><b>Location Analysis:</b> ${locationReport}</div>`;
        } else {
            resultDiv.innerHTML = `<div style="color:orange"><b>🔍 No match, but Gemini suggests:</b><br><br>${locationReport}</div>`;
        }
    } catch (e) { resultDiv.innerText = `❌ Error: ${e.message}`; }
}

// Global scope attachment
window.addMissingPerson = addMissingPerson;
window.checkFoundPerson = checkFoundPerson;
