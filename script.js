// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6;

// Use a stable CDN for models
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

async function loadModels() {
  try {
    // Load all required models simultaneously
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log('AI Models Loaded & Ready');
  } catch (error) {
    console.error('Model loading error:', error);
    alert('AI models failed to load. Please check your internet connection and refresh.');
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

// FULLY FIXED: Add missing person
async function addMissingPerson() {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const contact = document.getElementById('contact').value.trim();
  const files = document.getElementById('missing-photo').files;

  if (!name || !email || files.length === 0) {
    alert('Please fill all fields and upload at least one photo.');
    return;
  }

  const previewDiv = document.getElementById('preview');
  previewDiv.innerHTML = '<p>Processing photos...</p>';

  try {
    const descriptors = [];
    
    for (let file of files) {
      const img = await createImageFromFile(file);
      
      // FIXED CHAINING: Use detectSingleFace for registration
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        descriptors.push(Array.from(detection.descriptor));
        const imgElement = document.createElement('img');
        imgElement.src = img.src;
        imgElement.style.width = '80px';
        imgElement.style.borderRadius = '5px';
        previewDiv.appendChild(imgElement);
      }
    }

    if (descriptors.length === 0) {
      previewDiv.innerHTML = '<p style="color:red;">Error: No clear faces detected in the photos.</p>';
      return;
    }

    const stored = loadStoredPeople();
    stored.push({ name, email, contact, descriptors });
    savePeople(stored);
    previewDiv.innerHTML += '<p style="color:green;"><b>Successfully Added!</b></p>';
    alert('Missing person added to database.');
  } catch (error) {
    console.error('Add error:', error);
    alert('Error adding person: ' + error.message);
  }
}

// FULLY FIXED: Check found person
async function checkFoundPerson() {
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];
  const resultDiv = document.getElementById('result');

  if (!finderEmail || !file) {
    alert('Please provide your email and a photo.');
    return;
  }

  resultDiv.innerHTML = "Scanning image for matches...";

  try {
    const img = await createImageFromFile(file);
    const detection = await faceapi
      .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      resultDiv.innerHTML = '<b style="color:orange;">No face detected. Try a clearer photo.</b>';
      return;
    }

    const queryDescriptor = detection.descriptor;
    const stored = loadStoredPeople();
    let bestMatch = { distance: 1, name: null, email: null, contact: null };

    // Compare with all stored profiles
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
      resultDiv.innerHTML = `<h3 style="color:green;">Match Found: ${bestMatch.name}</h3>
                             <p>Confidence: ${confidence}%</p>
                             <p>Emails have been sent to both parties.</p>`;
      sendEmail(bestMatch.email, bestMatch.contact, bestMatch.name, finderEmail);
    } else {
      const bestConf = ((1 - bestMatch.distance) * 100).toFixed(1);
      resultDiv.innerHTML = `<p>No match found in our database.</p>
                             <p><small>(Closest profile similarity: ${bestConf}%)</small></p>`;
    }
  } catch (error) {
    console.error('Check error:', error);
    resultDiv.innerHTML = '<b style="color:red;">Error scanning photo. Please try again.</b>';
  }
}

function sendEmail(toEmail, contactName, missingName, finderEmail) {
  const contactParams = {
    to_email: toEmail,
    contact_name: contactName,
    missing_name: missingName,
    message: `ALERT: ${missingName} may have been found! Contact the finder at: ${finderEmail}`
  };

  emailjs.send('service_kebubpr', 'template_0i301n8', contactParams)
    .then(() => console.log('Email notification sent!'))
    .catch(err => alert('Email notification failed: ' + err.text));
}

// Start model loading immediately
loadModels();
