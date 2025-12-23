import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. SETUP & INITIALIZATION
const API_KEY = "AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6;
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

async function loadModels() {
    console.log("Loading AI Models...");
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log("AI & Gemini Systems Online");
}
loadModels();

/**
 * 2. REGISTRATION WITH UI FEEDBACK
 */
async function addMissingPerson() {
    const status = document.getElementById('status');
    const btn = document.querySelector("button[onclick='addMissingPerson()']");
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const files = document.getElementById('missing-photo').files;

    if (!name || !email || files.length === 0) {
        status.innerHTML = `<b style="color: #ff4f4f">⚠️ Fill all fields & add photo!</b>`;
        return;
    }

    // INTERFACE CHANGE: Disable button and show loading
    btn.disabled = true;
    btn.innerText = "⌛ Detecting Face...";
    status.innerHTML = `<span style="color: #3498db">🔵 Extracting facial features...</span>`;

    try {
        const descriptors = [];
        for (let file of files) {
            const img = await faceapi.bufferToImage(file);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            if (detection) descriptors.push(Array.from(detection.descriptor));
        }

        if (descriptors.length === 0) {
            throw new Error("No face found in photo.");
        }

        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        stored.push({ name, email, descriptors });
        localStorage.setItem('foundPeople', JSON.stringify(stored));

        // SUCCESS FEEDBACK
        status.innerHTML = `<b style="color: #27ae60">✅ Registered Successfully!</b>`;
        document.getElementById('name').value = '';
    } catch (e) {
        status.innerHTML = `<b style="color: #e74c3c">❌ Error: ${e.message}</b>`;
    } finally {
        btn.disabled = false;
        btn.innerText = "Register Person";
    }
}

/**
 * 3. GEMINI ANALYSIS (SMART EYEWITNESS)
 */
async function analyzeEnvironment(file) {
    const base64Data = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });

    const prompt = `Identify the specific location/landmarks in this photo and the person's condition to help a search team.`;
    const result = await model.generateContent([prompt, { inlineData: { data: base64Data, mimeType: file.type } }]);
    return result.response.text();
}

/**
 * 4. SEARCHING WITH MULTIPLE UI CHANGES
 */
async function checkFoundPerson() {
    const resultDiv = document.getElementById('result');
    const btn = document.querySelector("button[onclick='checkFoundPerson()']");
    const file = document.getElementById('found-photo').files[0];
    const finderEmail = document.getElementById('finder-email').value.trim();

    if (!file || !finderEmail) {
        resultDiv.innerHTML = `<b style="color: #e74c3c">⚠️ Photo and Email required!</b>`;
        return;
    }

    // INTERFACE CHANGE: Loading State
    btn.disabled = true;
    btn.innerText = "🔍 Scanning...";
    resultDiv.innerHTML = `<div class="ai-loader">🤖 Identifying Person...</div>`;

    try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
            resultDiv.innerHTML = `<b style="color: orange">⚠️ No face detected. Try a clearer photo.</b>`;
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
            // INTERFACE CHANGE: Show Gemini is working
            resultDiv.innerHTML = `<div style="color: #8e44ad">🧠 Match Found! Gemini is identifying location...</div>`;
            
            const envReport = await analyzeEnvironment(file);
            await sendDualEmails(bestMatch.person, finderEmail, envReport);

            // FINAL INTERFACE CHANGE: Success Card
            resultDiv.innerHTML = `
                <div style="border: 2px solid #2ecc71; background: #eafaf1; padding: 20px; border-radius: 12px; animation: slideUp 0.5s;">
                    <h3 style="color: #27ae60; margin: 0;">🎉 Success!</h3>
                    <p><b>${bestMatch.person.name}</b> identified. Emails sent to family and you.</p>
                </div>`;
        } else {
            resultDiv.innerHTML = `<b style="color: #7f8c8d">🔍 No match found in the system.</b>`;
        }
    } catch (e) {
        resultDiv.innerHTML = `<b style="color: #e74c3c">❌ Error: ${e.message}</b>`;
    } finally {
        btn.disabled = false;
        btn.innerText = "Check Person";
    }
}

// 5. EMAIL SYSTEM
async function sendDualEmails(match, finderEmail, report) {
    const msg = `Match confirmed! Location Report: ${report}. Contact finder: ${finderEmail}`;
    return Promise.all([
        emailjs.send('service_kebubpr', 'template_0i301n8', { to_email: match.email, message: msg }),
        emailjs.send('service_kebubpr', 'template_0i301n8', { to_email: finderEmail, message: `Match found for ${match.name}.` })
    ]);
}

window.addMissingPerson = addMissingPerson;
window.checkFoundPerson = checkFoundPerson;
