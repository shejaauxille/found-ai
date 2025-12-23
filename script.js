import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. SETUP & INITIALIZATION
const API_KEY = "AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6;
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

async function loadModels() {
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log("AI & Gemini Systems Online");
}
loadModels();

// 2. GEMINI MULTIMODAL FEATURE: SMART EYEWITNESS
async function analyzeEnvironment(file) {
    try {
        // Convert image file to base64 for Gemini
        const base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });

        const prompt = `Analyze this photo taken by someone who found a missing person. 
        Describe the environment to help the family find the location. 
        Identify landmarks, store names, street signs, or unique background features. 
        Describe the person's visible condition briefly (e.g., "sitting on a park bench, looks confused"). 
        Keep it concise and empathetic.`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType: file.type } }
        ]);
        
        return result.response.text();
    } catch (error) {
        console.error("Gemini Analysis Error:", error);
        return "Environmental analysis currently unavailable.";
    }
}

// 3. MATCHING LOGIC (Modified to include Gemini)
async function checkFoundPerson() {
    const resultDiv = document.getElementById('result');
    const finderEmail = document.getElementById('finder-email').value.trim();
    const file = document.getElementById('found-photo').files[0];

    if (!finderEmail || !file) {
        resultDiv.innerHTML = '<span style="color: #ff4f4f">⚠️ Provide email and photo.</span>';
        return;
    }

    resultDiv.innerHTML = '<span style="color: var(--blue)">🤖 AI is identifying person and surroundings...</span>';

    try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
            resultDiv.innerHTML = '<span style="color: orange">⚠️ No face found in photo.</span>';
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
            
            // ACTIVATE SMART EYEWITNESS
            resultDiv.innerHTML = '<span style="color: var(--purple)">🧠 Gemini is analyzing the scene...</span>';
            const envDescription = await analyzeEnvironment(file);
            
            const messageForEmails = `A match was found with ${accuracy}% accuracy. 
            EYEWITNESS REPORT: ${envDescription} 
            Please contact the finder immediately at: ${finderEmail}`;

            await sendDualEmails(bestMatch.person, finderEmail, messageForEmails);
            
            resultDiv.innerHTML = `
                <div style="background: rgba(39, 255, 155, 0.1); padding: 15px; border-radius: 10px; border: 1px solid var(--green);">
                    <h4 style="margin:0; color: var(--green);">Match Confirmed!</h4>
                    <p style="font-size: 0.9rem; margin: 10px 0 0;">Intelligent report and contact details sent to both parties.</p>
                </div>`;
        } else {
            resultDiv.innerHTML = '<span style="color: var(--muted)">🔍 No match found in database.</span>';
        }
    } catch (e) { resultDiv.innerHTML = "❌ Error: " + e.message; }
}

// 4. EMAIL LOGIC
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
        message: `System confirmed a match for ${match.name}. The family has been notified. Family Contact: ${match.email}`
    };

    return Promise.all([
        emailjs.send(serviceID, templateID, ownerParams),
        emailjs.send(serviceID, templateID, finderParams)
    ]);
}

// Attach the function to your global scope if needed
window.checkFoundPerson = checkFoundPerson;
