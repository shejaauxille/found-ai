// Initialize EmailJS with your Public Key
emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6; 
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

/**
 * 1. Load AI Models
 */
async function loadModels() {
  try {
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    console.log("AI Readiness: Confirmed");
  } catch (e) {
    console.error("AI Model Load Error:", e);
  }
}
loadModels();

/**
 * 2. Register Missing Person
 */
async function addMissingPerson() {
  const status = document.getElementById('status');
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const contact = document.getElementById('contact').value.trim();
  const location = document.getElementById('location').value.trim();
  const files = document.getElementById('missing-photo').files;

  if (!name || !email || files.length === 0) {
    status.innerHTML = '<span style="color: #ff4f4f">❌ Missing required fields.</span>';
    return;
  }

  status.innerHTML = '<span style="color: var(--purple)">🤖 Encoding face data...</span>';

  try {
    const descriptors = [];
    for (let file of files) {
      const img = await faceapi.bufferToImage(file);
      const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
      if (detection) descriptors.push(Array.from(detection.descriptor));
    }

    if (descriptors.length === 0) {
      status.innerHTML = '<span style="color: #ff4f4f">❌ No face detected. Try a clearer photo.</span>';
      return;
    }

    const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
    stored.push({ name, email, contact, location, descriptors });
    localStorage.setItem('foundPeople', JSON.stringify(stored));
    
    status.innerHTML = '<span style="color: var(--green)">✅ Registration Complete!</span>';
  } catch (e) {
    status.innerHTML = "❌ Error: " + e.message;
  }
}

/**
 * 3. Match Found Person & Send Emails
 */
async function checkFoundPerson() {
  const result = document.getElementById('result');
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];

  if (!finderEmail || !file) {
    result.innerHTML = '<span style="color: #ff4f4f">❌ Provide email and photo.</span>';
    return;
  }

  result.innerHTML = '<span style="color: var(--purple)">🤖 Scanning for matches...</span>';

  try {
    const img = await faceapi.bufferToImage(file);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
    
    if (!detection) {
      result.innerHTML = '<span style="color: orange">⚠️ No face found in image.</span>';
      return;
    }

    const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
    let bestMatch = { distance: 1, person: null };

    // Calculate Euclidean Distance (Face Geometry)
    stored.forEach(person => {
      person.descriptors.forEach(descArr => {
        const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(descArr));
        if (dist < bestMatch.distance) {
          bestMatch = { distance: dist, person: person };
        }
      });
    });

    if (bestMatch.distance < threshold) {
      // Accuracy Calculation: 1.0 (no match) to 0.0 (identical)
      const accuracy = ((1 - bestMatch.distance) * 100).toFixed(1);
      
      result.innerHTML = `
        <span style="color: var(--green)">🎉 Match Found: ${bestMatch.person.name}</span><br>
        <span style="font-size: 0.8rem; color: var(--muted)">Accuracy: ${accuracy}% - Sending alerts...</span>
      `;
      
      sendMatchEmails(bestMatch.person, finderEmail, accuracy);
    } else {
      result.innerHTML = '<span style="color: var(--muted)">🔍 No match found in our database.</span>';
    }
  } catch (e) {
    resultDiv.innerHTML = "❌ Scan Error.";
  }
}

/**
 * 4. Dual Notification Exchange
 */
function sendMatchEmails(match, finderEmail, accuracy) {
  const serviceID = 'service_kebubpr';
  const templateID = 'template_0i301n8';

  // Email to Family (Owner)
  const familyParams = {
    to_email: match.email,
    contact_name: match.contact,
    missing_name: match.name,
    message: `Match confirmed with ${accuracy}% accuracy. Contact the finder at: ${finderEmail}`
  };

  // Email to Finder
  const finderParams = {
    to_email: finderEmail,
    contact_name: "Finder",
    missing_name: match.name,
    message: `Match confirmed with ${accuracy}% accuracy. Contact the family (${match.contact}) at: ${match.email}`
  };

  Promise.all([
    emailjs.send(serviceID, templateID, familyParams),
    emailjs.send(serviceID, templateID, finderParams)
  ]).then(() => {
    console.log("Exchange Successful");
    alert("Match Found! Contact emails have been exchanged.");
  }).catch(err => {
    console.error("Exchange Failed:", err);
  });
}
