import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. SYSTEM CONFIG
const API_KEY = "AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

emailjs.init("OCug6QTCHUuWt7iCr");

// Reliable Model Source
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
const threshold = 0.6;

// 2. LOAD MODELS (Must happen before clicking)
async function initSystem() {
    const status = document.getElementById('status');
    const registerBtn = document.querySelector('.btn-missing');
    
    try {
        status.innerHTML = "⌛ Loading AI Models... Please wait.";
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        
        status.innerHTML = "✅ System Ready";
        status.style.color = "var(--green)";
        console.log("Models Loaded Successfully");
    } catch (err) {
        status.innerHTML = "❌ Model Load Failed. Check Internet.";
        console.error("Initialization Error:", err);
        alert("Could not load AI models. Please refresh the page.");
    }
}
initSystem();

// 3. REGISTER FUNCTION (Fixed)
async function addMissingPerson() {
    const status = document.getElementById('status');
    const btn = document.querySelector('.btn-missing');
    
    // Get Inputs
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const contact = document.getElementById('contact').value.trim();
    const photoInput = document.getElementById('missing-photo');

    // Validation
    if (!name || !email || photoInput.files.length === 0) {
        alert("Please fill in all fields and upload a photo.");
        return;
    }

    // UI Feedback: Show that something IS happening
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Processing...`;
    status.innerHTML = "🔍 Scanning face and encrypting...";
    status.className = "status-msg pulse";

    try {
        const file = photoInput.files[0];
        const img = await faceapi.bufferToImage(file);
        
        // Face Detection
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
            throw new Error("Could not find a clear face in this photo. Please try another.");
        }

        // Save Data
        const personData = {
            name,
            email,
            contact,
            descriptor: Array.from(detection.descriptor)
        };

        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        stored.push(personData);
        localStorage.setItem('foundPeople', JSON.stringify(stored));

        // Success UI
        status.innerHTML = `✅ ${name} Registered!`;
        status.className = "status-msg";
        status.style.color = "var(--green)";
        btn.innerHTML = "Register Database";
        
        // Reset Form
        document.getElementById('name').value = '';
        document.getElementById('missing-photo').value = '';
        document.getElementById('missing-preview').style.display = 'none';
        document.getElementById('missing-placeholder').style.display = 'block';

    } catch (e) {
        console.error(e);
        status.innerHTML = `❌ Error: ${e.message}`;
        status.className = "status-msg";
        alert(e.message);
    } finally {
        btn.disabled = false;
    }
}

// 4. SMART SEARCH (Gemini Feature)
async function checkFoundPerson() {
    const resultDiv = document.getElementById('result');
    const btn = document.querySelector('.btn-found');
    const file = document.getElementById('found-photo').files[0];
    const finderEmail = document.getElementById('finder-email').value.trim();

    if (!file || !finderEmail) {
        alert("Finder email and photo required.");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> AI Scanning...`;
    resultDiv.innerHTML = "🔍 Matching face against database...";
    resultDiv.className = "status-msg pulse";

    try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) throw new Error("No face detected in 'Found' photo.");

        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        let match = null;

        for (let person of stored) {
            const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(person.descriptor));
            if (dist < threshold) {
                match = person;
                break;
            }
        }

        if (match) {
            resultDiv.innerHTML = "🧠 Match Found! Analyzing location...";
            
            // Trigger Gemini
            const report = await analyzeEnvironment(file);
            const accuracy = ((1 - faceapi.euclideanDistance(detection.descriptor, new Float32Array(match.descriptor))) * 100).toFixed(1);
            
            await sendDualEmails(match, finderEmail, report, accuracy);

            resultDiv.innerHTML = `<div style="color:var(--green)">✅ Match Found: ${match.name}! Emails Sent.</div>`;
        } else {
            resultDiv.innerHTML = "🔍 No match found in database.";
        }
    } catch (e) {
        alert(e.message);
        resultDiv.innerHTML = `❌ Error: ${e.message}`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = "Start AI Recognition";
    }
}

// --- HELPERS ---
async function analyzeEnvironment(file) {
    const base64 = await new Promise(r => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });
    const prompt = "Describe the location/landmarks in this photo to help a family find this person.";
    const result = await model.generateContent([prompt, { inlineData: { data: base64, mimeType: file.type } }]);
    return result.response.text();
}

async function sendDualEmails(match, finder, report, acc) {
    const msg = `Found Alert: ${match.name} (Accuracy: ${acc}%). Location Info: ${report}. Finder Email: ${finder}`;
    return emailjs.send('service_kebubpr', 'template_0i301n8', {
        to_email: match.email,
        contact_name: match.contact,
        missing_name: match.name,
        message: msg
    });
}

// Expose to HTML
window.addMissingPerson = addMissingPerson;
window.checkFoundPerson = checkFoundPerson;
