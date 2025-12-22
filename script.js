// Initialize EmailJS with your Public Key
emailjs.init("OCug6QTCHUuWt7iCr");

// Threshold for match (lower = stricter)
const threshold = 0.6;

// Load models from your uploaded folder
async function loadModels() {
  try {
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
    console.log('Models loaded successfully!');
  } catch (error) {
    console.error('Model loading error:', error);
    alert('Failed to load AI models. Refresh the page.');
  }
}

// Load stored people from localStorage
function loadStoredPeople() {
  const data = localStorage.getItem('foundPeople');
  return data ? JSON.parse(data) : [];
}

// Save people to localStorage
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

// Add missing person (store multiple photos/descriptors)
async function addMissingPerson() {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const contact = document.getElementById('contact').value.trim();
  const files = document.getElementById('missing-photo').files;

  if (!name || !email || files.length === 0) {
    alert('Fill all fields and upload at least one photo.');
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
        alert('No face detected in one photo. Try a clearer image.');
        continue;
      }
    }

    if (descriptors.length === 0) {
      alert('No valid faces detected in any photo.');
      return;
    }

    const stored = loadStoredPeople();
    stored.push({ name, email, contact, descriptors });
    savePeople(stored);
    alert('Missing person added successfully!');
  } catch (error) {
    console.error('Add error:', error);
    alert('Error adding person: ' + (error.message || 'Unknown issue'));
  }
}

// Check found person (compare to all stored missing people)
async function checkFoundPerson() {
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];

  if (!finderEmail || !file) {
    alert('Fill finder email and upload a photo.');
    return;
  }

  try {
    const img = await createImageFromFile(file);
    const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      document.getElementById('result').innerText = 'No face detected in the found photo.';
      return;
    }

    const queryDescriptor = detection.descriptor;
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
      resultDiv.innerText = `Match found: ${bestMatch.name} (confidence: ${(1 - bestMatch.distance).toFixed(2)})! Emails sent.`;
      sendEmail(bestMatch.email, bestMatch.contact, bestMatch.name, finderEmail);
    } else {
      resultDiv.innerText = `No match found (best confidence: ${(1 - bestMatch.distance).toFixed(2)}).`;
    }
  } catch (error) {
    console.error('Check error:', error);
    document.getElementById('result').innerText = 'Error checking: ' + (error.message || 'Unknown issue');
  }
}

// Send email to both parties
function sendEmail(missingEmail, missingContact, missingName, finderEmail) {
  // Email to missing person's contact
  const contactParams = {
    to_email: missingEmail,
    contact_name: missingContact || 'Contact',
    missing_name: missingName,
    message: `Your loved one ${missingName} has been found! Finder's email: ${finderEmail}`
  };

  emailjs.send('service_kebubpr', 'template_0i301n8', contactParams)
    .then(() => console.log('Email to missing contact sent!'))
    .catch(err => {
      console.error('Email to contact failed:', err);
      alert('Email to contact failed: ' + (err.text || err.message || 'Unknown error'));
    });

  // Email to finder
  const finderParams = {
    to_email: finderEmail,
    contact_name: missingContact || 'Contact',
    missing_name: missingName,
    message: `You found ${missingName}! Contact email: ${missingEmail}`
  };

  emailjs.send('service_kebubpr', 'template_0i301n8', finderParams)
    .then(() => alert('Emails sent to both parties!'))
    .catch(err => {
      console.error('Email to finder failed:', err);
      alert('Email to finder failed: ' + (err.text || err.message || 'Unknown error'));
    });
}

// Load models on page load
loadModels();
