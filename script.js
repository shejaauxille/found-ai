emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6; 
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

async function loadModels() {
  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]);
  console.log("AI Ready");
}
loadModels();

// Registration Logic
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

  status.innerHTML = `<span style="color: var(--purple)">🤖 Encoding face data...</span>`;

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

    status.innerHTML = `<span style="color: var(--green)">✅ Registered Successfully!</span>`;
  } catch (e) { status.innerHTML = `❌ Error: ${e.message}`; }
}

// Matching Logic with Image Attachment
async function checkFoundPerson() {
  const result = document.getElementById('result');
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];

  if (!finderEmail || !file) {
    result.innerHTML = `<span style="color: #ff4f4f">⚠️ Provide email and photo.</span>`;
    return;
  }

  result.innerHTML = `<span style="color: var(--blue)">🤖 Analyzing photo...</span>`;

  try {
    // 1. Convert image to Base64 for the email
    const base64Image = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });

    // 2. Run AI detection
    const img = await faceapi.bufferToImage(file);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      result.innerHTML = `<span style="color: orange">⚠️ No face found.</span>`;
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
      result.innerHTML = `<span style="color: var(--green)">🎉 Match: ${bestMatch.person.name} (${accuracy}%)</span>`;
      
      // Pass the base64Image to the email function
      sendDualEmails(bestMatch.person, finderEmail, accuracy, base64Image);
    } else {
      result.innerHTML = `<span style="color: var(--muted)">🔍 No match found.</span>`;
    }
  } catch (e) { result.innerHTML = `❌ Error: ${e.message}`; }
}

function sendDualEmails(match, finderEmail, accuracy, imageData) {
  const serviceID = 'service_kebubpr';
  const templateID = 'template_0i301n8';

  const familyParams = {
    to_email: match.email,
    contact_name: match.contact,
    missing_name: match.name,
    found_image: imageData, // The Base64 string
    message: `A person matching ${match.name} was spotted with ${accuracy}% accuracy. Contact finder at: ${finderEmail}`
  };

  const finderParams = {
    to_email: finderEmail,
    contact_name: "Hero Finder",
    missing_name: match.name,
    found_image: imageData, // Finder gets a copy too
    message: `Match confirmed (${accuracy}% accuracy). Contact the family (${match.contact}) at: ${match.email}`
  };

  Promise.all([
    emailjs.send(serviceID, templateID, familyParams),
    emailjs.send(serviceID, templateID, finderParams)
  ]).then(() => {
    alert('Emails sent with verification photo!');
  }).catch(err => console.error('Email Error:', err));
}
