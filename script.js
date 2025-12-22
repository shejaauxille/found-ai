// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

// Threshold for match (lower = stricter)
const threshold = 0.6;

// Load models from your uploaded folder
async function loadModels() {
  await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
  await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
  console.log('Models loaded!');
}

// Load stored people
function loadStoredPeople() {
  const data = localStorage.getItem('foundPeople');
  return data ? JSON.parse(data) : [];
}

function savePeople(people) {
  localStorage.setItem('foundPeople', JSON.stringify(people));
}

// Add missing person (store multiple photos)
async function addMissingPerson() {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const contact = document.getElementById('contact').value.trim();
  const files = document.getElementById('missing-photo').files;

  if (!name || !email || files.length === 0) {
    alert('Fill all fields and upload photos.');
    return;
  }

  try {
    const descriptors = [];
    for (let file of files) {
      const img = await createImageFromFile(file);
      const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (detection) {
        descriptors.push(Array.from(detection.descriptor));
      } else {
        alert('No face detected in one photo.');
      }
    }

    if (descriptors.length === 0) {
      alert('No valid faces.');
      return;
    }

    const stored = loadStoredPeople();
    stored.push({ name, email, contact, descriptors });
    savePeople(stored);
    alert('Missing person added!');
  } catch (error) {
    console.error('Add error:', error);
    alert('Error adding person.');
  }
}

// Helper
function createImageFromFile(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = URL.createObjectURL(file);
  });
}

// Check found person (compare to all stored missing)
async function checkFoundPerson() {
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];

  if (!finderEmail || !file) {
    alert('Fill finder email and upload photo.');
    return;
  }

  try {
    const img = await createImageFromFile(file);
    const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      document.getElementById('result').innerText = 'No face detected.';
      return;
    }

    const queryDescriptor = detection.descriptor;
    const stored = loadStoredPeople();
    let bestMatch = { distance: 1, name: null };

    stored.forEach(person => {
      person.descriptors.forEach(descArr => {
        const desc = new Float32Array(descArr);
        const distance = faceapi.euclideanDistance(queryDescriptor, desc);
        if (distance < bestMatch.distance) {
          bestMatch = { distance, name: person.name };
        }
      });
    });

    const resultDiv = document.getElementById('result');
    if (bestMatch.distance < threshold) {
      const match = stored.find(p => p.name === bestMatch.name);
      resultDiv.innerText = `Match found: ${bestMatch.name} (confidence: ${(1 - bestMatch.distance).toFixed(2)})!`;
      sendEmail(match.email, match.contact, bestMatch.name, finderEmail);
    } else {
      resultDiv.innerText = `No match found (best confidence: ${(1 - bestMatch.distance).toFixed(2)}).`;
    }
  } catch (error) {
    console.error('Check error:', error);
    document.getElementById('result').innerText = 'Error – try again.';
  }
}

// Send email to both parties
function sendEmail(toEmail, contactName, missingName, finderEmail) {
  // Email to missing person's contact
  const contactParams = {
    to_email: toEmail,
    contact_name: contactName,
    missing_name: missingName,
    message: `Your loved one ${missingName} has been found! Finder's email: ${finderEmail}`
  };

  emailjs.send('service_kebubpr', 'template_0i301n8', contactParams)
    .then(() => console.log('Email to contact sent!'))
    .catch(err => alert('Email failed: ' + (err.text || err.message)));

  // Email to finder
  const finderParams = {
    to_email: finderEmail,
    contact_name: contactName,
    missing_name: missingName,
    message: `You found ${missingName}! Contact email: ${toEmail}`
  };

  emailjs.send('service_kebubpr', 'template_0i301n8', finderParams)
    .then(() => alert('Emails sent to both!'))
    .catch(err => alert('Email failed: ' + (err.text || err.message)));
}

// Load models on page load
loadModels();
