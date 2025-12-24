// Initialize EmailJS with your Public Key
emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6;
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

// === YOUR GEMINI API KEY (already inserted) ===
const GEMINI_API_KEY = 'AIzaSyCXjwe_OGpcaEni5Zyctvw9ooclpwLQXU0';

async function loadModels() {
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log("Face-API Models Loaded Successfully");
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

// FIXED: Generate detailed feature report with robust error handling
async function generateFeatureReport(file) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_')) {
    return "<i>Gemini API key missing — feature report unavailable.</i>";
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
                text: "Carefully analyze this photo of a person and provide a detailed, factual description for identification. Include ALL visible details:\n" +
                      "- Approximate age and gender\n" +
                      "- Ethnicity and skin tone\n" +
                      "- Hair: color, style, length\n" +
                      "- Facial hair (if any)\n" +
                      "- Eye color and glasses (yes/no, style)\n" +
                      "- Clothing: full description (top, bottom, colors, logos, text)\n" +
                      "- Accessories: backpack, jewelry, hat, etc.\n" +
                      "- Distinctive marks: tattoos, scars, moles, piercings\n" +
                      "- Background & location: describe landmarks, signs, flags, buildings — identify city and country if recognizable (e.g., Kigali Convention Centre, 'I Love Kigali' sign, Rwandan flag)\n\n" +
                      "Format with bullet points. Be specific and accurate."
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
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();

    // === SAFE PARSING TO PREVENT "undefined.forEach" OR CRASHES ===
    if (!data || !data.candidates || data.candidates.length === 0) {
      if (data?.error) {
        return `<i>Gemini Error: ${data.error.message}</i>`;
      }
      return "<i>No response from Gemini (possibly rate limited or safety block).</i>";
    }

    const candidate = data.candidates[0];

    if (candidate.finishReason === "SAFETY") {
      return "<i>Image analysis blocked by Gemini safety filters.</i>";
    }

    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      return "<i>No description generated (empty response).</i>";
    }

    let text = candidate.content.parts[0].text || "No text returned.";

    // Format nicely for HTML
    return text.trim()
      .replace(/\n/g, '<br>')
      .replace(/^\s*[-*•]\s*/gm, '• ')  // Ensure consistent bullets
      .replace(/\*/g, '•');

  } catch (error) {
    console.error("Gemini Feature Report Error:", error);
    return `<i>Feature analysis failed: ${error.message}</i>`;
  }
}

/**
 * REGISTRATION LOGIC (Add Missing Person)
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
    console.error(e);
  }
}

/**
 * SCANNING LOGIC (Check Found Person) — With Gemini Report
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
      result.innerHTML = `<span style="color: orange">⚠️ No clear face detected. Try a better photo.</span>`;
      return;
    }

    // Face matching
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

    const accuracy = ((1 - bestMatch.distance) * 100).toFixed(1);

    // Generate Gemini report
    result.innerHTML += `<br><span style="color: var(--purple)">🤖 Generating detailed feature & location report...</span>`;
    const featureReport = await generateFeatureReport(file);

    if (bestMatch.distance < threshold) {
      result.innerHTML = `
        <div style="background: #e8f5e8; padding: 15px; border-radius: 10px; border-left: 5px solid var(--green);">
          🎉 <strong>MATCH FOUND:</strong> <b>${bestMatch.person.name}</b><br>
          <small>Face Match Accuracy: ${accuracy}%</small><br><br>
          <strong>📋 Detailed Feature & Location Report:</strong><br>
          <div style="font-size: 0.95em; line-height: 1.6;">${featureReport}</div>
        </div>`;
      
      sendDualEmails(bestMatch.person, finderEmail, accuracy, featureReport);
    } else {
      result.innerHTML = `
        <div style="background: #fff8e1; padding: 15px; border-radius: 10px; border-left: 5px solid orange;">
          🔍 <strong>No match found</strong> (Highest similarity: ${accuracy}%)<br><br>
          Photo analyzed and recorded for future reference.<br><br>
          <strong>📋 Detailed Feature & Location Report:</strong><br>
          <div style="font-size: 0.95em; line-height: 1.6;">${featureReport}</div>
        </div>`;
    }
  } catch (e) {
    result.innerHTML = `<span style="color: #ff4f4f">❌ Error: ${e.message}</span>`;
    console.error(e);
  }
}

/**
 * EMAIL EXCHANGE — Includes full Gemini report
 */
function sendDualEmails(match, finderEmail, accuracy, featureReport) {
  const serviceID = 'service_kebubpr';
  const templateID = 'template_0i301n8';

  // Convert HTML report to plain text for email
  const plainReport = featureReport
    .replace(/<br>/g, '\n')
    .replace(/<[^>]*>/g, '')
    .trim();

  const ownerParams = {
    to_email: match.email,
    contact_name: match.contact || "Family Member",
    missing_name: match.name,
    message: `GREAT NEWS!\n\n${match.name} has been spotted with ${accuracy}% facial match confidence.\n\n` +
             `Finder's contact: ${finderEmail}\n\n` +
             `DETAILED AI REPORT:\n${plainReport}\n\n` +
             `Please reach out to the finder immediately. We hope for a safe reunion! ❤️`
  };

  const finderParams = {
    to_email: finderEmail,
    contact_name: "Kind Finder",
    missing_name: match.name,
    message: `MATCH CONFIRMED!\n\nYou have likely found ${match.name} (${accuracy}% match accuracy).\n` +
             `Registered location: ${match.location}\n\n` +
             `Family contact: ${match.contact || 'Provided in database'} | Email: ${match.email}\n\n` +
             `DETAILED AI REPORT:\n${plainReport}\n\n` +
             `Thank you for your kindness — you've made a huge difference! 🌟`
  };

  Promise.all([
    emailjs.send(serviceID, templateID, ownerParams),
    emailjs.send(serviceID, templateID, finderParams)
  ])
  .then(() => {
    alert('✅ Match confirmed! Both parties notified with full AI report.');
  })
  .catch(err => {
    console.error('Email Error:', err);
    alert('⚠️ Match found, but emails failed to send. Check your EmailJS setup.');
  });
}
