import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. INITIALIZATION
const API_KEY = "AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6; 
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

async function loadModels() {
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log("AI & Gemini Systems Ready");
  } catch (e) {
    console.error("AI Model Error:", e);
  }
}
loadModels();

// 2. GEMINI VISION FEATURE
async function analyzeEnvironment(file) {
    try {
        const base64Data = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(file);
        });

        const prompt = `You are a search and rescue assistant. This is a photo of a found missing person. 
        Identify the environment, landmarks, street signs, or shop names in the background. 
        Describe the person's condition briefly. 
        Keep the report under 60 words for a family notification.`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType: file.type } }
        ]);
        
        return result.response.text();
    } catch (error) {
        console.error("Gemini Scan Error:", error);
        return "Environmental scan unavailable. Check GPS/Photo manually.";
    }
}

// 3. REGISTRATION LOGIC
async function addMissingPerson() {
  const status = document.getElementById('status');
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const contact = document.getElementById('contact').value.trim();
  const location = document.getElementById('location').value.trim();
  const files = document.getElementById('missing-photo').files;

  if (!name || !email || files.length === 0) {
    status.innerHTML = `<span style="color: #ff4f4f">⚠️ Please fill all fields.</span>`;
    return;
  }

  status.innerHTML = `<span style="color: var(--purple)">🤖 Mapping facial geometry...</span>`;

  try {
    const descriptors = [];
    for (let file of files) {
      const img = await faceapi.bufferToImage(file);
      const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
      if (detection) descriptors.push(Array.from(detection.descriptor));
    }

    if (descriptors.length === 0) {
      status.innerHTML = `<span style="color: #ff4f4f">❌ No face detected.</span>`;
      return;
    }

    const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
    stored.push({ name, email, contact, location, descriptors });
    localStorage.setItem('foundPeople', JSON.stringify(stored));

    status.innerHTML = `<span style="color: var(--green)">✅ Registered: ${name}</span>`;
  } catch (e) {
    status.innerHTML = `<span style="color: #ff4f4f">❌ Error: ${e.message}</span>`;
  }
}

// 4. SCANNING LOGIC (FOUND PERSON)
async function checkFoundPerson() {
  const resultDiv = document.getElementById('result');
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];

  if (!finderEmail || !file) {
    resultDiv.innerHTML = `<span style="color: #ff4f4f">⚠️ Photo and email required.</span>`;
    return;
  }

  resultDiv.innerHTML = `<span style="color: var(--blue)">🤖 AI Searching & Analyzing Scene...</span>`;

  try {
    const img = await faceapi.bufferToImage(file);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      resultDiv.innerHTML = `<span style="color: orange">⚠️ No face found in photo.</span>`;
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
      
      // TRIGGER GEMINI LOCATION SCAN
      resultDiv.innerHTML = `<span style="color: var(--purple)">🧠 Gemini identifying location...</span>`;
      const environmentReport = await analyzeEnvironment(file);
      
      resultDiv.innerHTML = `
        <div style="color: var(--green)">
          🎉 Match Found: <b>${bestMatch.person.name}</b><br>
          <small>Scene: ${environmentReport}</small>
        </div>`;
      
      sendDualEmails(bestMatch.person, finderEmail, accuracy, environmentReport);
    } else {
      resultDiv.innerHTML = `<span style="color: var(--muted)">🔍 No match found.</span>`;
    }
  } catch (e) {
    resultDiv.innerHTML = `<span style="color: #ff4f4f">❌ Scan Error: ${e.message}</span>`;
  }
}

// 5. EMAIL EXCHANGE
function sendDualEmails(match, finderEmail, accuracy, locationReport) {
  const serviceID = 'service_kebubpr';
  const templateID = 'template_0i301n8';

  const ownerParams = {
    to_email: match.email,
    contact_name: match.contact,
    missing_name: match.name,
    message: `ALERT: ${match.name} was found with ${accuracy}% accuracy.\n\nGEMINI LOCATION REPORT: ${locationReport}\n\nContact finder at: ${finderEmail}`
  };

  const finderParams = {
    to_email: finderEmail,
    contact_name: "Hero Finder",
    missing_name: match.name,
    message: `SUCCESS: Match confirmed for ${match.name}. Family (${match.contact}) is notified. Home location: ${match.location}`
  };

  Promise.all([
    emailjs.send(serviceID, templateID, ownerParams),
    emailjs.send(serviceID, templateID, finderParams)
  ]).then(() => {
    alert('Match confirmed! Location and contact details exchanged.');
  }).catch(err => console.error('Email Error:', err));
}

// CRITICAL: Attach functions to window so they work with onclick="..."
window.addMissingPerson = addMissingPerson;
window.checkFoundPerson = checkFoundPerson;
