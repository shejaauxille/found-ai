import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. SETUP & INITIALIZATION
const API_KEY = "AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6;
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

// Load AI Models
async function loadModels() {
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        console.log("AI & Gemini Systems Online");
    } catch (err) {
        console.error("Model Loading Error:", err);
    }
}
loadModels();

/**
 * 2. REGISTRATION LOGIC (The missing function!)
 * This saves the person's face data into the browser's memory.
 */
async function addMissingPerson() {
    const status = document.getElementById('status');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const contact = document.getElementById('contact').value.trim();
    const files = document.getElementById('missing-photo').files;

    if (!name || !email || files.length === 0) {
        status.innerHTML = `<span style="color: #ff4f4f">⚠️ Please fill all fields and select a photo.</span>`;
        return;
    }

    status.innerHTML = `<span style="color: var(--purple)">🤖 Processing face data...</span>`;

    try {
        const descriptors = [];
        for (let file of files) {
            const img = await faceapi.bufferToImage(file);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            if (detection) {
                descriptors.push(Array.from(detection.descriptor));
            }
        }

        if (descriptors.length === 0) {
            status.innerHTML = `<span style="color: #ff4f4f">❌ No face detected. Use a clearer photo.</span>`;
            return;
        }

        // Save to LocalStorage
        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        stored.push({ name, email, contact, descriptors });
        localStorage.setItem('foundPeople', JSON.stringify(stored));

        status.innerHTML = `<span style="color: var(--green)">✅ Registered Successfully!</span>`;
        document.getElementById('name').value = ''; // Clear fields
    } catch (e) {
        status.innerHTML = `<span style="color: #ff4f4f">❌ Error: ${e.message}</span>`;
    }
}

/**
 * 3. GEMINI MULTIMODAL FEATURE: SMART EYEWITNESS
 */
async function analyzeEnvironment(file) {
    try {
        const base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });

        const prompt = `Analyze this photo taken by someone who found a missing person. 
        Describe the environment to help the family find the location. 
        Identify landmarks, store names, street signs, or unique background features. 
        Describe the person's condition briefly. Keep it concise.`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType: file.type } }
        ]);
        
        return result.response.text();
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Environmental analysis unavailable.";
    }
}

/**
 * 4. SEARCHING & MATCHING LOGIC
 */
async function checkFoundPerson() {
    const resultDiv = document.getElementById('result');
    const finderEmail = document.getElementById('finder-email').value.trim();
    const file = document.getElementById('found-photo').files[0];

    if (!finderEmail || !file) {
        resultDiv.innerHTML = '<span style="color: #ff4f4f">⚠️ Provide your email and the found photo.</span>';
        return;
    }

    resultDiv.innerHTML = '<span style="color: var(--blue)">🤖 AI is searching for matches...</span>';

    try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
            resultDiv.innerHTML = '<span style="color: orange">⚠️ No face found in this photo.</span>';
            return;
        }

        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        let bestMatch = { distance: 1, person: null };

        stored.forEach(person => {
            person.descriptors.forEach(descArr => {
                const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(descArr));
                if (dist < bestMatch.distance) {
                    bestMatch = { distance: dist, person: person };
                }
            });
        });

        if (bestMatch.distance < threshold) {
            const accuracy = ((1 - bestMatch.distance) * 100).toFixed(1);
            
            resultDiv.innerHTML = '<span style="color: var(--purple)">🧠 Identifying location with Gemini AI...</span>';
            const envDescription = await analyzeEnvironment(file);
            
            const messageForEmails = `A match was found with ${accuracy}% accuracy.\n\nEYEWITNESS REPORT: ${envDescription}\n\nPlease contact the finder immediately at: ${finderEmail}`;

            await sendDualEmails(bestMatch.person, finderEmail, messageForEmails);
            
            resultDiv.innerHTML = `
                <div style="background: rgba(39, 255, 155, 0.1); padding: 15px; border-radius: 10px; border: 2px solid var(--green);">
                    <h4 style="margin:0; color: var(--green);">🎉 Match Confirmed!</h4>
                    <p style="font-size: 0.9rem; margin: 10px 0 0;">An AI-generated report and contact details have been sent to the family.</p>
                </div>`;
        } else {
            resultDiv.innerHTML = '<span style="color: var(--muted)">🔍 No match found in our records.</span>';
        }
    } catch (e) { 
        resultDiv.innerHTML = "❌ Error: " + e.message; 
    }
}

/**
 * 5. EMAIL LOGIC
 */
async function sendDualEmails(match, finderEmail, finalMessage) {
    const serviceID = 'service_kebubpr';
    const templateID = 'template_0i301n8';

    const ownerParams = {
        to_email: match.email,
        contact_name: match.contact,
        missing_name: match.name,
        message: finalMessage
    };

    const finderParams = {
        to_email: finderEmail,
        contact_name: "Hero Finder",
        missing_name: match.name,
        message: `System matched ${match.name}. The family has been notified. Contact the family at: ${match.email}`
    };

    return Promise.all([
        emailjs.send(serviceID, templateID, ownerParams),
        emailjs.send(serviceID, templateID, finderParams)
    ]);
}

// 6. EXPOSE FUNCTIONS TO BUTTONS
window.addMissingPerson = addMissingPerson;
window.checkFoundPerson = checkFoundPerson;
