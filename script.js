// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6;

async function loadModels() {
  try {
    // Using a reliable CDN for weights
    const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    console.log('Models loaded successfully');
  } catch (error) {
    console.error('Model loading error:', error);
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
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
}

// Fixed Add Person Function
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
    previewDiv.innerHTML = 'Processing...';
    const descriptors = [];

    for (let file of files) {
      const img = await createImageFromFile(file);
      
      // FIX: Use a single await for the entire chain
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        descriptors.push(Array.from(detection.descriptor));
        const imgElement = document.createElement('img');
        imgElement.src = img.src;
        imgElement.style.width = '100px';
        previewDiv.appendChild(imgElement);
      }
    }

    if (descriptors.length === 0) {
      alert('Could not detect a clear face. Please try a clearer photo.');
      previewDiv.innerHTML = 'Upload failed: No face detected.';
      return;
    }

    const stored = loadStoredPeople();
    stored.push({ name, email, contact, descriptors });
    savePeople(stored);
    previewDiv.innerHTML = '✅ Person added successfully!';
    alert('Missing person added!');
  } catch (error) {
    console.error('Add error:', error);
    alert('Error: ' + error.message);
  }
}

// Fixed Check Function
async function checkFoundPerson() {
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];
  const resultDiv = document.getElementById('result');

  if (!finderEmail || !file) {
    alert('Fill finder email and upload photo.');
    return;
  }

  resultDiv.innerText = 'Scanning face...';

  try {
    const img = await createImageFromFile(file);
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      resultDiv.innerText = 'No face detected in the photo. Try a closer shot.';
      return;
    }

    const queryDescriptor = detection.descriptor;
    const stored = loadStoredPeople();
    let bestMatch = { distance: 1, name: null, email: null, contact: null };

    stored.forEach(person => {
      person.descriptors.forEach(descArr => {
        const distance = faceapi.euclideanDistance(queryDescriptor, new Float32Array(descArr));
        if (distance < bestMatch.distance) {
          bestMatch = { distance, name: person.name, email: person.email, contact: person.contact };
        }
      });
    });

    if (bestMatch.distance < threshold) {
      const confidence = ((1 - bestMatch.distance) * 100).toFixed(1);
      resultDiv.innerHTML = `<b style="color:green;">Match found: ${bestMatch.name} (${confidence}% match)!</b>`;
      sendEmail(bestMatch.email, bestMatch.contact, bestMatch.name, finderEmail);
    } else {
      const bestConf = ((1 - bestMatch.distance) * 100).toFixed(1);
      resultDiv.innerText = `No match found in database. (Closest similarity: ${bestConf}%)`;
    }
  } catch (error) {
    console.error('Check error:', error);
    resultDiv.innerText = 'Error during scanning. Please try again.';
  }
}

function sendEmail(toEmail, contactName, missingName, finderEmail) {
  const contactParams = {
    to_email: toEmail,
    contact_name: contactName,
    missing_name: missingName,
    message: `Match found! Contact: ${finderEmail}`
  };

  emailjs.send('service_kebubpr', 'template_0i301n8', contactParams)
    .then(() => alert('Match found! Emails sent.'))
    .catch(err => console.error('Email failed:', err));
}

loadModels();
