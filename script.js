// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

// Balanced threshold: 0.6 handles different lighting/backgrounds well.
const threshold = 0.6; 
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

/**
 * 1. LOAD MODELS
 * SSD MobileNet V1 is more robust than TinyFace for different environments.
 */
async function loadModels() {
  try {
    console.log("Initializing AI...");
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log('AI Models Loaded Successfully');
  } catch (error) {
    console.error('Model loading error:', error);
    alert('Failed to load AI models. Please refresh.');
  }
}

/**
 * 2. DATA MANAGEMENT
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
 * Stores the specific face "fingerprint" along with family contact details.
 */
async function addMissingPerson() {
  const missingName = document.getElementById('name').value.trim(); // The person lost
  const familyEmail = document.getElementById('email').value.trim(); // Family's email
  const familyContactName = document.getElementById('contact').value.trim(); // Family member's name
  const files = document.getElementById('missing-photo').files;

  if (!missingName || !familyEmail || files.length === 0) {
    alert('Please fill all fields and upload photos.');
    return;
  }

  const previewDiv = document.getElementById('preview');
  previewDiv.innerHTML = '<b>Scanning face features...</b>';

  try {
    const descriptors = [];
    
    for (let file of files) {
      const img = await createImageFromFile(file);
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
      previewDiv.innerHTML = '<b style="color:red;">No face detected. Try a clearer photo.</b>';
      return;
    }

    const stored = loadStoredPeople();
    // Save identifying data clearly
    stored.push({ 
        name: missingName, 
        email: familyEmail, 
        contact: familyContactName, 
        descriptors 
    });
    savePeople(stored);
    
    previewDiv.innerHTML = '<b style="color:green;">✅ Successfully added to database!</b>';
  } catch (error) {
    console.error('Registration error:', error);
    previewDiv.innerHTML = 'Error: ' + error.message;
  }
}

/**
 * 4. CHECK FOUND PERSON
 * Compares found photo and triggers dual emails on match.
 */
async function checkFoundPerson() {
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];
  const resultDiv = document.getElementById('result');

  if (!finderEmail || !file) {
    alert('Please provide your email and the photo you found.');
    return;
  }

  resultDiv.innerHTML = "<b>Searching for a match...</b>";

  try {
    const img = await createImageFromFile(file);
    const detection = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      resultDiv.innerHTML = '<b style="color:orange;">No face detected. Ensure the face is visible.</b>';
      return;
    }

    const queryDescriptor = detection.descriptor;
    const stored = loadStoredPeople();
    let bestMatch = { distance: 1, name: null, email: null, contact: null };

    // Find the closest match in the database
    stored.forEach(person => {
      person.descriptors.forEach(descArr => {
        const distance = faceapi.euclideanDistance(queryDescriptor, new Float32Array(descArr));
        if (distance < bestMatch.distance) {
          bestMatch = { 
              distance, 
              name: person.name, 
              email: person.email, 
              contact: person.contact 
          };
        }
      });
    });

    if (bestMatch.distance < threshold) {
      const confidence = ((1 - bestMatch.distance) * 100).toFixed(1);
      resultDiv.innerHTML = `<h3 style="color:green;">MATCH FOUND: ${bestMatch.name}</h3>
                             <p>Confidence: ${confidence}%</p>
                             <p>Success! Contact details exchanged via email.</p>`;
      
      sendDualEmails(bestMatch, finderEmail);
    } else {
      const closest = ((1 - bestMatch.distance) * 100).toFixed(1);
      resultDiv.innerHTML = `No match found. <br><small>(Closest profile is a ${closest}% match)</small>`;
    }
  } catch (error) {
    console.error('Matching error:', error);
    resultDiv.innerText = 'Error processing photo.';
  }
}

/**
 * 5. SEND DUAL EMAILS (Fixed Names)
 * Ensures the family and the finder get the correct information.
 */
function sendDualEmails(match, finderEmail) {
  const serviceID = 'service_kebubpr';
  const templateID = 'template_0i301n8';

  // Email 1: To the Family (The person who reported them missing)
  const ownerParams = {
    to_email: match.email,            // Family Email
    contact_name: match.contact,      // Family Name
    missing_name: match.name,         // Missing Person's Name
    message: `Great news! ${match.name} was found. You can contact the finder at: ${finderEmail}`
  };

  // Email 2: To the Finder
  const finderParams = {
    to_email: finderEmail,            // Finder Email
    contact_name: "Finder",           // Generic
    missing_name: match.name,         // Missing Person's Name
    message: `You found a match for ${match.name}! You can contact the family (${match.contact}) at: ${match.email}`
  };

  Promise.all([
    emailjs.send(serviceID, templateID, ownerParams),
    emailjs.send(serviceID, templateID, finderParams)
  ]).then(() => {
    console.log('Emails sent to both parties.');
  }).catch((err) => {
    console.error('EmailJS Error:', err);
  });
}

loadModels();
