import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. SETUP
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
  } catch (e) { console.error("Model Error:", e); }
}
loadModels();

/**
 * GEMINI SCAN: LANDMARKS & ENVIRONMENT
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
          { text: "Identify the location in this photo. Be specific about Rwanda landmarks like Kigali Convention Center or street signs. Describe the surroundings and the person's status. Keep it brief." }
        ]
      }]
    });
    return result.response.text();
  } catch (error) {
    console.error("Gemini Scan Error:", error);
    return "Environmental details currently unavailable.";
  }
}

/**
 * REGISTER PERSON
 */
async function addMissingPerson() {
  const status = document.getElementById('status');
  const btn = document.querySelector('.btn-missing');
  const name = document.getElementById('name').value.trim();
  const file = document.getElementById('missing-photo').files[0];

  if (!name || !file) {
    status.innerHTML = "⚠️ Please provide a name and photo.";
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Processing Face...`;

  try {
    const img = await faceapi.bufferToImage(file);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) throw new Error("Face not clear enough. Try another photo.");

    const person = {
      name,
      email: document.getElementById('email').value,
      contact: document.getElementById('contact').value,
      location: document.getElementById('location').value,
      descriptor: Array.from(detection.descriptor) // Ensure 128-float array
    };

    const db = JSON.parse(localStorage.getItem('foundPeople') || '[]');
    db.push(person);
    localStorage.setItem('foundPeople', JSON.stringify(db));

    status.innerHTML = `<span style="color:var(--green)">✅ Registered: ${name}</span>`;
  } catch (e) {
    status.innerHTML = `<span style="color:red">❌ ${e.message}</span>`;
  } finally {
    btn.disabled = false;
    btn.innerText = "Register Person";
  }
}

/**
 * SCAN FOUND PERSON (LANDMARKS + FACE)
 */
async function checkFoundPerson() {
  const resultDiv = document.getElementById('result');
  const btn = document.querySelector('.btn-found');
  const file = document.getElementById('found-photo').files[0];
  const finderEmail = document.getElementById('finder-email').value;

  if (!file || !finderEmail) {
    resultDiv.innerText = "⚠️ Finder email and photo required.";
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Analyzing Image...`;

  try {
    const img = await faceapi.bufferToImage(file);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
    
    // Always trigger Gemini for the location/landmark report
    const locationReport = await analyzeEnvironment(file);

    const db = JSON.parse(localStorage.getItem('foundPeople') || '[]');
    let match = null;

    if (detection && db.length > 0) {
      db.forEach(person => {
        // LENGTH CHECK FIX: Prevents the euclideanDistance crash
        if (person.descriptor && person.descriptor.length === detection.descriptor.length) {
          const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(person.descriptor));
          if (dist < threshold) match = person;
        }
      });
    }

    if (match) {
      resultDiv.innerHTML = `⏳ Sending Alert to family...`;
      
      const msg = `MATCH FOUND: ${match.name}. Location Report: ${locationReport}. Contact Finder: ${finderEmail}`;
      await emailjs.send('service_kebubpr', 'template_0i301n8', {
        to_email: match.email,
        contact_name: match.contact,
        missing_name: match.name,
        message: msg
      });

      resultDiv.innerHTML = `<div style="text-align:left; color:var(--green)">
        <b>✅ MATCH FOUND: ${match.name}</b><br><br>
        <b>Landmark Analysis:</b> ${locationReport}
      </div>`;
    } else {
      resultDiv.innerHTML = `<div style="text-align:left; color:var(--muted)">
        <b>🔍 No Face Match in Database</b><br><br>
        <b>But Gemini scanned the scene:</b><br>${locationReport}
      </div>`;
    }
  } catch (e) {
    resultDiv.innerHTML = `❌ Scan Error: ${e.message}`;
  } finally {
    btn.disabled = false;
    btn.innerText = "Start AI Recognition";
  }
}

// Global scope attachment
window.addMissingPerson = addMissingPerson;
window.checkFoundPerson = checkFoundPerson;
