import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
 * GEMINI SCAN: LANDMARKS & ENVIRONMENT
 */
async function analyzeEnvironment(file) {
    const logDiv = document.getElementById('live-ai-log');
    logDiv.style.display = "block";
    logDiv.innerHTML = "🤖 Gemini is scanning for Rwanda landmarks...";

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
                    { text: "Identify the location in this photo. Look for Kigali landmarks like the Convention Center, Rwandan flag, or street names. Describe the environment and the person's status briefly." }
                ]
            }]
        });

        const responseText = result.response.text();
        logDiv.innerHTML = "✅ Gemini Analysis Complete.";
        return responseText;
    } catch (error) {
        logDiv.innerHTML = "❌ Gemini Scan Error.";
        return "Location details unavailable.";
    }
}

/**
 * REGISTER PERSON
 */
async function addMissingPerson() {
    const status = document.getElementById('status');
    const name = document.getElementById('name').value.trim();
    const photo = document.getElementById('missing-photo').files[0];

    if (!name || !photo) { status.innerText = "⚠️ Name/Photo required."; return; }

    status.innerHTML = `<span class="spinner"></span> Extracting facial features...`;

    try {
        const img = await faceapi.bufferToImage(photo);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) throw new Error("Face not clear enough.");

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

        status.innerHTML = `<span style="color:var(--green)">✅ Registered: ${name}</span>`;
    } catch (e) { status.innerText = `❌ ${e.message}`; }
}

/**
 * SCAN FOUND (LANDMARKS + FACE)
 */
async function checkFoundPerson() {
    const resultDiv = document.getElementById('result');
    const file = document.getElementById('found-photo').files[0];
    const finderEmail = document.getElementById('finder-email').value;

    if (!file || !finderEmail) { resultDiv.innerText = "⚠️ Photo/Email required."; return; }

    resultDiv.innerHTML = `<span class="spinner"></span> Running Multimodal AI Scan...`;

    try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        
        // Start Gemini environmental analysis
        const locationReport = await analyzeEnvironment(file);

        const db = JSON.parse(localStorage.getItem('foundPeople') || '[]');
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
            resultDiv.innerText = "⏳ Sending matching alerts...";
            
            await emailjs.send('service_kebubpr', 'template_0i301n8', {
                to_email: match.email,
                contact_name: match.contact,
                missing_name: match.name,
                message: `URGENT: ${match.name} was found. \n\nLOCATION SCAN: ${locationReport} \n\nCONTACT FINDER: ${finderEmail}`
            });

            resultDiv.innerHTML = `<div style="color:var(--green)"><b>✅ MATCH: ${match.name}</b><br><br><b>Location:</b> ${locationReport}</div>`;
        } else {
            resultDiv.innerHTML = `<div style="color:orange"><b>🔍 No match in database, but Gemini Analysis:</b><br><br>${locationReport}</div>`;
        }
    } catch (e) { resultDiv.innerText = `❌ Error: ${e.message}`; }
}

window.addMissingPerson = addMissingPerson;
window.checkFoundPerson = checkFoundPerson;
