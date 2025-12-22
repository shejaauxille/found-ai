// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

// Balanced threshold: 0.6 is the industry standard for face-api.js
const threshold = 0.6; 
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

/**
 * 1. LOAD MODELS
 * SSD MobileNet V1 is used because it is much better at finding faces 
 * in busy backgrounds compared to the Tiny detector.
 */
async function loadModels() {
  try {
    console.log("Loading AI Models...");
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log('AI Models Loaded & Ready');
  } catch (error) {
    console.error('Model loading error:', error);
    alert('AI models failed to load. Please check your connection and refresh.');
  }
}

/**
 * 2. DATA UTILITIES
 */
function loadStoredPeople() {
  const data = localStorage.getItem('foundPeople');
  return data ? JSON.parse(data) : [];
}

function savePeople(people) {
  localStorage.setItem('foundPeople', JSON.stringify(people));
}

function createImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * 3. ADD MISSING PERSON
 * Deep scans the photos and stores the face "fingerprint" (descriptor).
 */
async function addMissingPerson() {
  const name = document.getElementById('name').value.trim();
  const ownerEmail = document.getElementById('email').value.trim();
  const contactName = document.getElementById('contact').value.trim();
  const files = document.getElementById('missing-photo').files;

  if (!name || !ownerEmail || files.length === 0) {
    alert('Please fill all fields and upload photos.');
    return;
  }

  const previewDiv = document.getElementById('preview');
  previewDiv.innerHTML = '<b>Analyzing face...</b>';

  try {
    const descriptors = [];
    
    for (let file of files) {
      const img = await createImageFromFile(file);
      
      // SSD Detection (Best for any background)
      const detection = await faceapi
        .detectSingleFace(img)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        descriptors.push(Array.from(detection.descriptor));
        const imgThumb = document.createElement('img');
        imgThumb.src = img.src;
        imgThumb.style.width = '70px';
        imgThumb.style.margin = '5px';
        imgThumb.style.borderRadius = '5px';
        previewDiv.appendChild(imgThumb);
      }
    }

    if (descriptors.length === 0) {
      previewDiv.innerHTML = '<b style="color:red;">No face detected. Please use a clearer photo.</b>';
      return;
    }

    const stored = loadStoredPeople();
    stored.push({ name, email: ownerEmail, contact: contactName, descriptors });
    savePeople(stored);
    
    previewDiv.innerHTML = '<b style="color:green;">✅ Successfully added to database!</b>';
  } catch (error) {
    console.error('Registration error:', error);
    previewDiv.innerHTML = 'Error: ' + error.message;
  }
}

/**
 * 4. CHECK FOUND PERSON
 * Scans the found photo and sends emails to both parties if it's a match.
 */
async function checkFoundPerson() {
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];
  const resultDiv = document.getElementById('result');

  if (!finderEmail || !file) {
    alert('Please provide your email and the photo you found.');
    return;
  }

  resultDiv.innerHTML = "<b>Scanning photo for matches...</b>";

  try {
    const img = await createImageFromFile(file);
    const detection = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      resultDiv.innerHTML = '<b style="color:orange;">No face detected. Background might be too busy or face is hidden.</b>';
      return;
    }

    const queryDescriptor = detection.descriptor;
    const stored = loadStoredPeople();
    let bestMatch = { distance: 1, name: null, email: null, contact: null };

    // Compare face DNA against all records
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
      resultDiv.innerHTML = `<h3 style="color:green;">MATCH FOUND: ${bestMatch.name}</h3>
                             <p>Confidence: ${confidence}%</p>
                             <p>Email alerts sent to both of you!</p>`;
      
      sendDualEmails(bestMatch, finderEmail);
    } else {
      const closest = ((1 - bestMatch.distance) * 100).toFixed(1);
      resultDiv.innerHTML = `No match found in database. <br><small>(Closest profile similarity: ${closest}%)</small>`;
    }
  } catch (error) {
    console.error('Check error:', error);
    resultDiv.innerText = 'Error processing photo.';
  }
}

/**
 * 5. SEND DUAL EMAILS
 */
function sendDualEmails(match, finderEmail) {
  const serviceID = 'service_kebubpr';
  const templateID = 'template_0i301n8';

  // Email to the person who reported them missing
  const ownerParams = {
    to_email: match.email,
    contact_name: match.contact,
    missing_name: match.name,
    message: `A potential match for ${match.name} was found! Finder's email: ${finderEmail}`
  };

  // Email to the finder
  const finderParams = {
    to_email: finderEmail,
    contact_name: "Finder",
    missing_name: match.name,
    message: `You found a match for ${match.name}! Contact the family (${match.contact}) at: ${match.email}`
  };

  Promise.all([
    emailjs.send(serviceID, templateID, ownerParams),
    emailjs.send(serviceID, templateID, finderParams)
  ]).then(() => {
    console.log('Notifications sent to both parties.');
  }).catch((err) => {
    console.error('Email error:', err);
  });
}

// Startup
loadModels();
