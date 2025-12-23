import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

emailjs.init("OCug6QTCHUuWt7iCr");

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
const threshold = 0.6;

async function loadModels() {
  await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  console.log("AI Models Loaded");
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
          { text: "Identify the location in this Rwanda photo. Look for Kigali landmarks like the Convention Center or flags. Describe the environment briefly for the family." }
        ]
      }]
    });
    return result.response.text();
  } catch (e) { return "Location details unavailable."; }
}

/**
 * REGISTER PERSON
 */
async function addMissingPerson() {
  const status = document.getElementById('status');
  const name = document.getElementById('name').value;
  const file = document.getElementById('missing-photo').files[0];

  if (!name || !file) return alert("All fields required");

  status.innerHTML = `<span class="spinner"></span> Encoding face...`;

  try {
    const img = await faceapi.bufferToImage(file);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) throw new Error("No face detected.");

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
  } catch (e) { status.innerText = "❌ Error: " + e.message; }
}

/**
 * SCAN FOUND (LANDMARKS + FACE)
 */
async function checkFoundPerson() {
  const resultDiv = document.getElementById('result');
  const file = document.getElementById('found-photo').files[0];
  const finderEmail = document.getElementById('finder-email').value;

  if (!file || !finderEmail) return alert("Email and photo required");

  resultDiv.innerHTML = `<span class="spinner"></span> Analyzing Location & Face...`;

  try {
    const img = await faceapi.bufferToImage(file);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
    
    // Trigger Gemini Environmental Scan
    const locationReport = await analyzeEnvironment(file);

    const db = JSON.parse(localStorage.getItem('foundPeople') || '[]');
    let match = null;

    if (detection && db.length > 0) {
      db.forEach(person => {
        // Safe length check to prevent the euclideanDistance crash
        if (person.descriptor && person.descriptor.length === detection.descriptor.length) {
          const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(person.descriptor));
          if (dist < threshold) match = person;
        }
      });
    }

    if (match) {
      resultDiv.innerHTML = `⏳ Match found! Notifying family...`;
      
      const msg = `URGENT: ${match.name} was found. \nLocation Analysis: ${locationReport} \nContact Finder: ${finderEmail}`;
      await emailjs.send('service_kebubpr', 'template_0i301n8', {
        to_email: match.email,
        contact_name: match.contact,
        missing_name: match.name,
        message: msg
      });

      resultDiv.innerHTML = `<div style="color:var(--green)"><b>✅ MATCH: ${match.name}</b><br><br><b>Location Scan:</b> ${locationReport}</div>`;
    } else {
      resultDiv.innerHTML = `<div style="color:orange"><b>🔍 No face match, but Gemini Location Scan:</b><br><br>${locationReport}</div>`;
    }
  } catch (e) { resultDiv.innerText = "❌ Error: " + e.message; }
}

// Attach to window so buttons can find them
window.addMissingPerson = addMissingPerson;
window.checkFoundPerson = checkFoundPerson;
