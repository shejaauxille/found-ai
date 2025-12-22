// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

// Threshold for match (lower = stricter)
const threshold = 0.6;

// Load models (CDN fallback)
async function loadModels() {
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights');
    await faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights');
    await faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights');
    console.log('Models loaded!');
  } catch (error) {
    console.error('Model loading error:', error);
    alert('Failed to load AI models. Refresh and try again.');
  }
}

// Load stored people
function loadStoredPeople() {
  const data = localStorage.getItem('foundPeople');
  return data ? JSON.parse(data) : [];
}

function savePeople(people) {
  localStorage.setItem('foundPeople', JSON.stringify(people));
}

// Helper: Create image from file
function createImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
}

// Add missing person with preview
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
    const previewDiv = document.getElementById('preview');
    previewDiv.innerHTML = '';
    const descriptors = [];
    for (let file of files) {
      const imgUrl = URL.createObjectURL(file);
      const imgElement = document.createElement('img');
      imgElement.src = imgUrl;
      imgElement.style.width = '100px';
      previewDiv.appendChild(imgElement);

      const img = await createImageFromFile(file);
      const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detections.length > 0) {
        descriptors.push(Array.from(detections[0].descriptor));
      } else {
        previewDiv.innerHTML += '<p style="color:red;">No face detected in this photo.</p>';
      }
    }

    if (descriptors.length === 0) {
      alert('No valid faces detected in any photo.');
      return;
    }

    const stored = loadStoredPeople();
    stored.push({ name, email, contact, descriptors });
    savePeople(stored);
    alert('Missing person added!');
  } catch (error) {
    console.error('Add error:', error);
    alert('Error adding person: ' + error.message);
  }
}

// Check found person
async function checkFoundPerson() {
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];

  if (!finderEmail || !file) {
    alert('Fill finder email and upload photo.');
    return;
  }

  try {
    const img = await createImageFromFile(file);
    const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (detections.length === 0) {
      document.getElementById('result').innerText = 'No face detected.';
      return;
    }

    const queryDescriptor = detections[0].descriptor;
    const stored = loadStoredPeople();
    let bestMatch = { distance: 1, name: null, email: null, contact: null };

    stored.forEach(person => {
      person.descriptors.forEach(descArr => {
        const desc = new Float32Array(descArr);
        const distance = faceapi.euclideanDistance(queryDescriptor, desc);
        if (distance < bestMatch.distance) {
          bestMatch = { distance, name: person.name, email: person.email, contact: person.contact };
        }
      });
    });

    const resultDiv = document.getElementById('result');
    if (bestMatch.distance < threshold) {
      resultDiv.innerText = `Match found: ${bestMatch.name} (confidence: ${(1 - bestMatch.distance).toFixed(2)})!`;
      sendEmail(bestMatch.email, bestMatch.contact, bestMatch.name, finderEmail);
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
  const contactParams = {
    to_email: toEmail,
    contact_name: contactName,
    missing_name: missingName,
    message: `Your loved one ${missingName} has been found! Finder's email: ${finderEmail}`
  };

  emailjs.send('service_kebubpr', 'template_0i301n8', contactParams)
    .then(() => console.log('Email to contact sent!'))
    .catch(err => alert('Email failed: ' + (err.text || err.message)));

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
