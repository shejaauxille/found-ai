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
    console.log("AI Ready");
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
    status.innerHTML = `<span style="color: #ff4f4f">⚠️ Please fill all fields and select photos.</span>`;
    return;
  }

  status.innerHTML = `<span style="color: var(--purple)">🤖 Scanning and extracting facial features...</span>`;

  try {
    const descriptors = [];
    for (let file of files) {
      const reader = new FileReader();
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
 * SCANNING LOGIC (FOUND PERSON)
 */
async function checkFoundPerson() {
  const result = document.getElementById('result');
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];

  if (!finderEmail || !file) {
    result.innerHTML = `<span style="color: #ff4f4f">⚠️ Email and photo are required.</span>`;
    return;
  }

  result.innerHTML = `<span style="color: var(--blue)">🤖 AI is searching database. Please wait...</span>`;

  try {
    const img = await faceapi.bufferToImage(file);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      result.innerHTML = `<span style="color: orange">⚠️ No face found in this photo. Try again.</span>`;
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
      // Calculate Accuracy: 1.0 (no match) to 0.0 (identical)
      const accuracy = ((1 - bestMatch.distance) * 100).toFixed(1);
      
      result.innerHTML = `
        <div style="color: var(--green)">
          🎉 Match Found: <b>${bestMatch.person.name}</b><br>
          <small>Accuracy: ${accuracy}% - Sending alerts now...</small>
        </div>`;
      
      sendDualEmails(bestMatch.person, finderEmail, accuracy);
    } else {
      result.innerHTML = `<span style="color: var(--muted)">🔍 No match found. We will keep this on record.</span>`;
    }
  } catch (e) {
    result.innerHTML = `<span style="color: #ff4f4f">❌ Scan Error: ${e.message}</span>`;
  }
}

/**
 * EMAIL EXCHANGE
 */
function sendDualEmails(match, finderEmail, accuracy) {
  const serviceID = 'service_kebubpr';
  const templateID = 'template_0i301n8';

  // Email to Family
  const ownerParams = {
    to_email: match.email,
    contact_name: match.contact,
    missing_name: match.name,
    message: `GREAT NEWS: ${match.name} was spotted with ${accuracy}% accuracy. Please contact the finder at: ${finderEmail}`
  };

  // Email to Finder
  const finderParams = {
    to_email: finderEmail,
    contact_name: "Hero Finder",
    missing_name: match.name,
    message: `MATCH CONFIRMED: You found ${match.name} (${accuracy}% accuracy). This person is from ${match.location}. Please contact the family (${match.contact}) at: ${match.email}`
  };

  Promise.all([
    emailjs.send(serviceID, templateID, ownerParams),
    emailjs.send(serviceID, templateID, finderParams)
  ]).then(() => {
    alert('Match confirmed! Contact details have been exchanged via email.');
  }).catch(err => {
    console.error('Email Error:', err);
  });
}
