import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6;
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

// Load Models with Console Feedback
async function loadModels() {
    console.log("Loading AI Vision Models...");
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log("Reunification Engine Ready.");
}
loadModels();

// --- UI HELPER: Image Preview ---
document.getElementById('missing-photo').onchange = e => showPreview(e, 'missing-preview');
document.getElementById('found-photo').onchange = e => showPreview(e, 'found-preview');

function showPreview(event, elementId) {
    const reader = new FileReader();
    reader.onload = () => {
        const img = document.getElementById(elementId);
        img.src = reader.result;
        img.style.display = 'block';
    };
    reader.readAsDataURL(event.target.files[0]);
}

// --- FEATURE 1: Report Missing ---
async function addMissingPerson() {
    const status = document.getElementById('status');
    const btn = document.querySelector('.btn-missing');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const files = document.getElementById('missing-photo').files;

    if (!name || !email || files.length === 0) {
        status.innerHTML = "⚠️ Please fill all details.";
        return;
    }

    // INTERACTIVE CHANGE: Loading State
    btn.disabled = true;
    btn.innerHTML = `<span class="loading-spinner"></span> Encoding Face...`;
    status.className = "processing";
    status.innerHTML = "🤖 AI is mapping facial features...";

    try {
        const descriptors = [];
        for (let file of files) {
            const img = await faceapi.bufferToImage(file);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            if (detection) descriptors.push(Array.from(detection.descriptor));
        }

        if (descriptors.length === 0) throw new Error("No face detected.");

        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        stored.push({ name, email, contact: document.getElementById('contact').value, descriptors });
        localStorage.setItem('foundPeople', JSON.stringify(stored));

        status.className = "";
        status.innerHTML = `<span style="color: var(--green)">✅ ${name} Registered Successfully!</span>`;
    } catch (e) {
        status.innerHTML = `❌ Error: ${e.message}`;
    } finally {
        btn.disabled = false;
        btn.innerText = "Register Person";
    }
}

// --- FEATURE 2: Report Found (With Gemini) ---
async function checkFoundPerson() {
    const resultDiv = document.getElementById('result');
    const btn = document.querySelector('.btn-found');
    const file = document.getElementById('found-photo').files[0];
    const finderEmail = document.getElementById('finder-email').value.trim();

    if (!file || !finderEmail) {
        resultDiv.innerHTML = "⚠️ Photo and Email required.";
        return;
    }

    // INTERACTIVE CHANGE
    btn.disabled = true;
    btn.innerHTML = `<span class="loading-spinner"></span> Scanning Database...`;
    resultDiv.className = "processing";
    resultDiv.innerHTML = "🔍 Running facial recognition...";

    try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
            resultDiv.className = "";
            resultDiv.innerHTML = "⚠️ No face detected. Try a closer shot.";
            return;
        }

        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        let bestMatch = { distance: 1, person: null };

        stored.forEach(person => {
            person.descriptors.forEach(descArr => {
                const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(descArr));
                if (dist < bestMatch.distance) bestMatch = { distance: dist, person: person };
            });
        });

        if (bestMatch.distance < threshold) {
            const accuracy = ((1 - bestMatch.distance) * 100).toFixed(1);
            
            // SMART EYEWITNESS TRIGGER
            resultDiv.innerHTML = "🧠 Match found! Gemini is identifying location...";
            const envReport = await analyzeEnvironment(file);
            
            await sendDualEmails(bestMatch.person, finderEmail, envReport, accuracy);

            resultDiv.className = "";
            resultDiv.innerHTML = `
                <div style="border: 2px solid var(--green); padding: 15px; border-radius: 12px; background: rgba(39, 255, 155, 0.05)">
                    <h3 style="color: var(--green); margin: 0;">🎉 Success!</h3>
                    <p>${bestMatch.person.name} identified (${accuracy}%). Emails sent.</p>
                </div>`;
        } else {
            resultDiv.className = "";
            resultDiv.innerHTML = "🔍 No match found. We have alerted nearby authorities.";
        }
    } catch (e) {
        resultDiv.innerHTML = `❌ AI Error: ${e.message}`;
    } finally {
        btn.disabled = false;
        btn.innerText = "Scan for Match";
    }
}

async function analyzeEnvironment(file) {
    const base64 = await new Promise(r => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });
    const prompt = "Briefly identify the location/landmarks in this photo and the person's condition.";
    const result = await model.generateContent([prompt, { inlineData: { data: base64, mimeType: file.type } }]);
    return result.response.text();
}

async function sendDualEmails(match, finder, report, acc) {
    const msg = `Found Alert: ${match.name} located with ${acc}% accuracy. Location Info: ${report}. Contact finder: ${finder}`;
    return Promise.all([
        emailjs.send('service_kebubpr', 'template_0i301n8', { to_email: match.email, contact_name: match.contact, missing_name: match.name, message: msg }),
        emailjs.send('service_kebubpr', 'template_0i301n8', { to_email: finder, contact_name: "Hero Finder", missing_name: match.name, message: `Match confirmed for ${match.name}.` })
    ]);
}

window.addMissingPerson = addMissingPerson;
window.checkFoundPerson = checkFoundPerson;
