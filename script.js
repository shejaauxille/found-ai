// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6;
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

// Faster detection settings
const faceOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });

async function loadModels() {
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log('AI Ready');
  } catch (error) {
    console.error('Model load error:', error);
  }
}

function loadStoredPeople() {
  const data = localStorage.getItem('foundPeople');
  return data ? JSON.parse(data) : [];
}

function savePeople(people) {
  localStorage.setItem('foundPeople', JSON.stringify(people));
}

function createImageFromFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function addMissingPerson() {
  const name = document.getElementById('name').value.trim();
  const ownerEmail = document.getElementById('email').value.trim();
  const contactName = document.getElementById('contact').value.trim();
  const files = document.getElementById('missing-photo').files;

  if (!name || !ownerEmail || files.length === 0) return alert('Fill all fields.');

  const previewDiv = document.getElementById('preview');
  previewDiv.innerHTML = '<b>Processing...</b>';

  try {
    const descriptors = [];
    for (let file of files) {
      const img = await createImageFromFile(file);
      const detection = await faceapi.detectSingleFace(img, faceOptions).withFaceLandmarks().withFaceDescriptor();
      if (detection) descriptors.push(Array.from(detection.descriptor));
    }

    if (descriptors.length === 0) {
      previewDiv.innerHTML = '<span style="color:red;">No face detected. Try a clearer photo.</span>';
      return;
    }

    const stored = loadStoredPeople();
    stored.push({ name, email: ownerEmail, contact: contactName, descriptors });
    savePeople(stored);
    previewDiv.innerHTML = '<span style="color:green;">✅ Added Successfully!</span>';
  } catch (error) {
    previewDiv.innerHTML = 'Error: ' + error.message;
  }
}

async function checkFoundPerson() {
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];
  const resultDiv = document.getElementById('result');

  if (!finderEmail || !file) return alert('Provide finder email and photo.');

  resultDiv.innerText = 'Searching for matches...';

  try {
    const img = await createImageFromFile(file);
    const detection = await faceapi.detectSingleFace(img, faceOptions).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      resultDiv.innerText = 'No face detected in photo.';
      return;
    }

    const queryDescriptor = detection.descriptor;
    const stored = loadStoredPeople();
    let bestMatch = { distance: 1, name: null, email: null, contact: null };

    for (const person of stored) {
      for (const descArr of person.descriptors) {
        const distance = faceapi.euclideanDistance(queryDescriptor, new Float32Array(descArr));
        if (distance < bestMatch.distance) {
          bestMatch = { distance, name: person.name, email: person.email, contact: person.contact };
        }
      }
    }

    if (bestMatch.distance < threshold) {
      resultDiv.innerHTML = `<b style="color:green;">MATCH FOUND: ${bestMatch.name}</b><br>Sending notifications...`;
      
      // TRIGGER BOTH EMAILS
      sendDualEmails(bestMatch, finderEmail);
    } else {
      resultDiv.innerText = 'No match found in our records.';
    }
  } catch (error) {
    resultDiv.innerText = 'Scan error. Please try again.';
  }
}

// Function to notify BOTH parties
function sendDualEmails(match, finderEmail) {
  const serviceID = 'service_kebubpr';
  const templateID = 'template_0i301n8';

  // 1. Email to the Owner (Person who lost someone)
  const ownerParams = {
    to_email: match.email,
    contact_name: match.contact,
    missing_name: match.name,
    message: `Great news! ${match.name} was found. Contact the finder at: ${finderEmail}`
  };

  // 2. Email to the Finder (The person currently checking)
  const finderParams = {
    to_email: finderEmail,
    contact_name: "Finder",
    missing_name: match.name,
    message: `You found a match! You can contact the family (${match.contact}) at: ${match.email}`
  };

  // Execute both requests
  Promise.all([
    emailjs.send(serviceID, templateID, ownerParams),
    emailjs.send(serviceID, templateID, finderParams)
  ]).then(() => {
    alert('Match confirmed! Contact details have been exchanged via email.');
    document.getElementById('result').innerHTML = `<b style="color:green;">Match success! Check your inbox.</b>`;
  }).catch((err) => {
    console.error('Email error:', err);
    alert('Match found, but email failed to send.');
  });
}

loadModels();
