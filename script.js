// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

// We use the SSD MobileNet V1 model for high accuracy regardless of background
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

/**
 * 1. LOAD MODELS
 * Loads the core AI models required for detection, landmarks, and recognition.
 */
async function loadModels() {
  try {
    console.log("Loading AI models...");
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log('AI Models Ready - High Accuracy Mode active');
  } catch (error) {
    console.error('Model loading error:', error);
    alert('AI models failed to load. Please refresh the page.');
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
 * Deep scans uploaded photos to create a "face fingerprint" (descriptor).
 */
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
  previewDiv.innerHTML = '<p>Deep scanning face features...</p>';

  try {
    const descriptors = [];
    
    for (let file of files) {
      const img = await createImageFromFile(file);
      
      // We use detectSingleFace for registration to ensure high quality
      const detection = await faceapi
        .detectSingleFace(img) // Uses SSD MobileNet V1 by default
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        descriptors.push(Array.from(detection.descriptor));
        const imgThumb = document.createElement('img');
        imgThumb.src = img.src;
        imgThumb.style.width = '60px';
        imgThumb.style.borderRadius = '4px';
        previewDiv.appendChild(imgThumb);
      }
    }

    if (descriptors.length === 0) {
      previewDiv.innerHTML = '<b style="color:red;">No face detected. Background may be too busy or lighting too low.</b>';
      return;
    }

    const stored = loadStoredPeople();
    stored.push({ name, email, contact, descriptors });
    savePeople(stored);
    
    previewDiv.innerHTML += '<p style="color:green;"><b>✅ Success: Person added to database.</b></p>';
  } catch (error) {
    console.error('Registration error:', error);
    previewDiv.innerHTML = 'Error: ' + error.message;
  }
}

/**
 * 4. CHECK FOUND PERSON
 * Compares a found photo against the stored database using a dynamic sensitivity threshold.
 */
async function checkFoundPerson() {
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];
  const resultDiv = document.getElementById('result');
  
  // Get threshold from slider (0.2 = Strict, 0.8 = Very Loose)
  const userThreshold = parseFloat(document.getElementById('sensitivity').value);

  if (!finderEmail || !file) {
    alert('Provide your email and a photo of the person found.');
    return;
  }

  resultDiv.innerHTML = "<b>Analyzing face and ignoring background...</b>";

  try {
    const img = await createImageFromFile(file);
    const detection = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      resultDiv.innerHTML = '<b style="color:orange;">No face found in this image. Ensure the face is visible.</b>';
      return;
    }

    const queryDescriptor = detection.descriptor;
    const stored = loadStoredPeople();
    let bestMatch = { distance: 1, name: null, email: null, contact: null };

    // Calculate Euclidean distance (Face DNA comparison)
    stored.forEach(person => {
      person.descriptors.forEach(descArr => {
        const distance = faceapi.euclideanDistance(queryDescriptor, new Float32Array(descArr));
        if (distance < bestMatch.distance) {
          bestMatch = { distance, name: person.name, email: person.email, contact: person.contact };
        }
      });
    });

    if (bestMatch.distance < userThreshold) {
      const matchPercent = ((1 - bestMatch.distance) * 100).toFixed(1);
      resultDiv.innerHTML = `<h3 style="color:green;">Match Found: ${bestMatch.name}</h3>
                             <p>Similarity: ${matchPercent}%</p>
                             <p>Notifications are being sent to both parties!</p>`;
      
      sendDualEmails(bestMatch, finderEmail);
    } else {
      const closest = ((1 - bestMatch.distance) * 100).toFixed(1);
      resultDiv.innerHTML = `No match found at ${userThreshold} sensitivity.<br>
                             <small>Closest person in database is a ${closest}% match.</small>`;
    }
  } catch (error) {
    console.error('Matching error:', error);
    resultDiv.innerText = 'Error processing photo.';
  }
}

/**
 * 5. DUAL EMAIL NOTIFICATION
 * Informs both the family and the finder.
 */
function sendDualEmails(match, finderEmail) {
  const serviceID = 'service_kebubpr';
  const templateID = 'template_0i301n8';

  // Email parameters for the person who reported them missing
  const ownerParams = {
    to_email: match.email,
    contact_name: match.contact,
    missing_name: match.name,
    message: `A potential match for ${match.name} was found! Contact the finder immediately at: ${finderEmail}`
  };

  // Email parameters for the finder
  const finderParams = {
    to_email: finderEmail,
    contact_name: "Finder",
    missing_name: match.name,
    message: `The person you found matches ${match.name} in our database. Contact the family (${match.contact}) at: ${match.email}`
  };

  Promise.all([
    emailjs.send(serviceID, templateID, ownerParams),
    emailjs.send(serviceID, templateID, finderParams)
  ]).then(() => {
    console.log('Dual notifications sent successfully.');
  }).catch((err) => {
    console.error('Email sending failed:', err);
  });
}

// Initialize models when the script loads
loadModels();
