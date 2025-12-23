// Initialize EmailJS with your Public Key
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
    console.log("AI Ready - Image Feature Removed");
  } catch (e) {
    console.error("AI Model Error:", e);
  }
}
loadModels();

/**
 * REGISTRATION LOGIC
 */
async function addMissingPerson() {
  const status = document.getElementById('status');
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const contact = document.getElementById('contact').value.trim();
  const location = document.getElementById('location').value.trim();
  const files = document.getElementById('missing-photo').files;

  if (!name || !email || files.length === 0) {
    status.innerHTML = `<span style="color: #ff4f4f">⚠️ Fill all fields and select photos.</span>`;
    return;
  }

  status.innerHTML = `<span style="color: var(--purple)">🤖 Scanning and saving data...</span>`;

  try {
    const descriptors = [];
    for (let file of files) {
      const img = await faceapi.bufferToImage(file);
      const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
      if (detection) descriptors.push(Array.from(detection.descriptor));
    }

    if (descriptors.length === 0) {
      status.innerHTML = `<span style="color: #ff4f4f">❌ No face detected. Try a clearer photo.</span>`;
      return;
    }

    const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
    stored.push({ name, email, contact, location, descriptors });
    localStorage.setItem('foundPeople', JSON.stringify(stored));

    status.innerHTML = `<span style="color: var(--green)">✅ Registered Successfully!</span>`;
  } catch (e) {
    status.innerHTML = `<span style="color: #ff4f4f">❌ Error: ${e.message}</span>`;
  }
}

/**
 * SCANNING LOGIC
 */
async function checkFoundPerson() {
  const result = document.getElementById('result');
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];

  if (!finderEmail || !file) {
    result.innerHTML = `<span style="color: #ff4f4f">⚠️ Email and photo are required.</span>`;
    return;
  }

  result.innerHTML = `<span style="color: var(--blue)">🤖 Searching database...</span>`;

  try {
    const img = await faceapi.bufferToImage(file);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      result.innerHTML = `<span style="color: orange">⚠️ No face found in this photo.</span>`;
      return;
    }

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

    if (bestMatch.distance < threshold) {
      const accuracy = ((1 - bestMatch.distance) * 100).toFixed(1);
      
      result.innerHTML = `<span style="color: var(--green)">🎉 Match: ${bestMatch.person.name} (${accuracy}%)</span><br><small>Sending text alerts...</small>`;
      
      await sendDualEmails(bestMatch.person, finderEmail, accuracy);
      
      // Success Message
      result.innerHTML = `
        <div style="background: rgba(39, 255, 155, 0.1); padding: 15px; border-radius: 10px; border: 1px solid var(--green);">
            <h4 style="margin:0; color: var(--green);">Match Successful!</h4>
            <p style="font-size: 0.9rem; margin: 10px 0 0;">Contact details have been sent to both parties. Check your inbox.</p>
        </div>`;
    } else {
      result.innerHTML = `<span style="color: var(--muted)">🔍 No match found.</span>`;
    }
  } catch (e) {
    result.innerHTML = `<span style="color: #ff4f4f">❌ Error: ${e.message}</span>`;
  }
}

/**
 * EMAIL EXCHANGE (Text Only - Instant)
 */
async function sendDualEmails(match, finderEmail, accuracy) {
  const serviceID = 'service_kebubpr';
  const templateID = 'template_0i301n8';

  const ownerParams = {
    to_email: match.email,
    contact_name: match.contact,
    missing_name: match.name,
    message: `Match confirmed (${accuracy}% accuracy). ${match.name} was found! Contact the finder at: ${finderEmail}`
  };

  const finderParams = {
    to_email: finderEmail,
    contact_name: "Hero Finder",
    missing_name: match.name,
    message: `Match confirmed (${accuracy}% accuracy). You found ${match.name}! Contact the family (${match.contact}) at: ${match.email}`
  };

  return Promise.all([
    emailjs.send(serviceID, templateID, ownerParams),
    emailjs.send(serviceID, templateID, finderParams)
  ]);
}
