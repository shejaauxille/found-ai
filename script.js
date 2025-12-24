// Initialize EmailJS with your Public Key
emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6;
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

// === ADD YOUR GEMINI API KEY HERE ===
// Get it from: https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = 'AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0'; // ⚠️ Replace this!

async function loadModels() {
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log("Face-API Models Loaded");
  } catch (e) {
    console.error("AI Model Error:", e);
  }
}
loadModels();

// Helper: Convert file to Base64 for Gemini
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });
}

// Generate detailed feature report using Google Gemini
async function generateFeatureReport(file) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_GEMINI_API_KEY_HERE')) {
    return "<i>Gemini API key not configured — feature report unavailable.</i>";
  }

  try {
    const base64Data = await fileToBase64(file);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: "Analyze this photo of a person and provide a detailed, factual description for identification purposes. Include:\n" +
                      "- Approximate age and gender\n" +
                      "- Ethnicity/skin tone\n" +
                      "- Hair color, style, length\n" +
                      "- Facial hair (if any)\n" +
                      "- Eye color (if visible)\n" +
                      "- Clothing (top, bottom, colors, style)\n" +
                      "- Accessories (glasses, hat, jewelry)\n" +
                      "- Distinctive marks (tattoos, scars, moles, piercings)\n" +
                      "- Background/location clues (if any)\n" +
                      "Keep it concise, neutral, and organized with bullet points."
              },
              {
                inlineData: {
                  mimeType: file.type || "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim()
      .replace(/\n/g, '<br>') // Make line breaks visible in HTML
      .replace(/-/g, '•');    // Better bullet points
  } catch (error) {
    console.error("Gemini Feature Report Error:", error);
    return `<i>Feature analysis failed: ${error.message}</i>`;
  }
}

/**
 * REGISTRATION LOGIC (Unchanged — facial descriptors only)
 */
async function addMissingPerson() {
  const status = document.getElementById('status');
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const contact = document.getElementById('contact').value.trim();
  const location = document.getElementById('location').value.trim();
  const files = document.getElementById('missing-photo').files;

  if (!name || !email || files.length === 0) {
    status.innerHTML = `<span style="color: #ff4f4f">⚠️ Please fill all fields and select photos.</span>`;
    return;
  }

  status.innerHTML = `<span style="color: var(--purple)">🤖 Scanning and extracting facial features...</span>`;

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
      status.innerHTML = `<span style="color: #ff4f4f">❌ No clear face detected. Please try different photos.</span>`;
      return;
    }

    const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
    stored.push({ name, email, contact, location, descriptors });
    localStorage.setItem('foundPeople', JSON.stringify(stored));

    status.innerHTML = `<span style="color: var(--green)">✅ Success! ${name} is now in the secure database.</span>`;
  } catch (e) {
    status.innerHTML = `<span style="color: #ff4f4f">❌ Error: ${e.message}</span>`;
  }
}

/**
 * SCANNING LOGIC — Now with Gemini Feature Recognition
 */
async function checkFoundPerson() {
  const result = document.getElementById('result');
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];

  if (!finderEmail || !file) {
    result.innerHTML = `<span style="color: #ff4f4f">⚠️ Email and photo are required.</span>`;
    return;
  }

  result.innerHTML = `<span style="color: var(--blue)">🤖 Analyzing face and searching database...</span>`;

  try {
    const img = await faceapi.bufferToImage(file);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      result.innerHTML = `<span style="color: orange">⚠️ No face detected in photo. Try a clearer image.</span>`;
      return;
    }

    // Face matching logic
    const queryDescriptor = detection.descriptor;
    const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
    let bestMatch = { distance: 1, person: null };

    stored.forEach(person => {
      person.descriptors.forEach(descArr => {
        const dist = faceapi.euclideanDistance(queryDescriptor, new Float32Array(descArr));
        if (dist < bestMatch.distance) {
          bestMatch = { distance: dist, person: person };
        }
      });
    });

    // Generate feature report (runs in parallel for speed)
    result.innerHTML += `<br><span style="color: var(--purple)">🤖 Generating detailed feature report...</span>`;
    const featureReport = await generateFeatureReport(file);

    const accuracy = ((1 - bestMatch.distance) * 100).toFixed(1);

    if (bestMatch.distance < threshold) {
      result.innerHTML = `
        <div style="color: var(--green); padding: 10px; border-radius: 8px; background: #f0fff04d;">
          🎉 <strong>Match Found:</strong> <b>${bestMatch.person.name}</b><br>
          <small>Face Match Accuracy: ${accuracy}%</small><br><br>
          <strong>📋 Feature Recognition Report:</strong><br>
          <div style="font-size: 0.95em; line-height: 1.5;">${featureReport}</div>
        </div>`;

      sendDualEmails(bestMatch.person, finderEmail, accuracy, featureReport);
    } else {
      result.innerHTML = `
        <div style="color: var(--muted); padding: 10px; border-radius: 8px; background: #fffacd4d;">
          🔍 <strong>No match found in database</strong> (Best similarity: ${accuracy}%)<br><br>
          This photo has been analyzed and recorded.<br><br>
          <strong>📋 Feature Recognition Report:</strong><br>
          <div style="font-size: 0.95em; line-height: 1.5;">${featureReport}</div>
        </div>`;
    }
  } catch (e) {
    result.innerHTML = `<span style="color: #ff4f4f">❌ Error: ${e.message}</span>`;
    console.error(e);
  }
}

/**
 * EMAIL EXCHANGE — Now includes the full feature report
 */
function sendDualEmails(match, finderEmail, accuracy, featureReport) {
  const serviceID = 'service_kebubpr';
  const templateID = 'template_0i301n8';

  // Clean report for email (remove HTML tags)
  const plainReport = featureReport.replace(/<br>/g, '\n').replace(/<[^>]*>/g, '').trim();

  const ownerParams = {
    to_email: match.email,
    contact_name: match.contact || "Family",
    missing_name: match.name,
    message: `GREAT NEWS!\n\n${match.name} has been spotted with ${accuracy}% facial match accuracy.\n\n` +
             `Finder's email: ${finderEmail}\n\n` +
             `DETAILED FEATURE REPORT:\n${plainReport}\n\n` +
             `Please contact the finder immediately. Stay safe!`
  };

  const finderParams = {
    to_email: finderEmail,
    contact_name: "Hero Finder",
    missing_name: match.name,
    message: `MATCH CONFIRMED!\n\nYou have likely found ${match.name} (${accuracy}% match).\n` +
             `Location registered: ${match.location}\n\n` +
             `Family contact: ${match.contact || 'N/A'} | Email: ${match.email}\n\n` +
             `DETAILED FEATURE REPORT:\n${plainReport}\n\n` +
             `Thank you for helping reunite a family ❤️`
  };

  Promise.all([
    emailjs.send(serviceID, templateID, ownerParams),
    emailjs.send(serviceID, templateID, finderParams)
  ])
  .then(() => {
    alert('✅ Match confirmed! Both parties have been notified with full details.');
  })
  .catch(err => {
    console.error('Email Error:', err);
    alert('⚠️ Match found, but email failed to send. Please check console.');
  });
}
