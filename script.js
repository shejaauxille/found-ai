// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6; // 0.6 is the standard for matching different photos
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

async function loadModels() {
  try {
    // SSD MobileNet is more robust for "any picture" compared to TinyFace
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    console.log('Robust AI Models Loaded');
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

// Function to handle adding person
async function addMissingPerson() {
  const name = document.getElementById('name').value.trim();
  const ownerEmail = document.getElementById('email').value.trim();
  const contactName = document.getElementById('contact').value.trim();
  const files = document.getElementById('missing-photo').files;

  if (!name || !ownerEmail || files.length === 0) return alert('Please fill all fields.');

  const previewDiv = document.getElementById('preview');
  previewDiv.innerHTML = '<b>Deep Scanning Photos...</b>';

  try {
    const descriptors = [];
    for (let file of files) {
      const img = await createImageFromFile(file);
      // SSD Detection is slower but handles different backgrounds much better
      const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
      
      if (detection) {
        descriptors.push(Array.from(detection.descriptor));
      }
    }

    if (descriptors.length === 0) {
      previewDiv.innerHTML = '<span style="color:red;">AI could not find a face. Try a photo with better lighting or a closer view of the face.</span>';
      return;
    }

    const stored = loadStoredPeople();
    stored.push({ name, email: ownerEmail, contact: contactName, descriptors });
    savePeople(stored);
    previewDiv.innerHTML = '<span style="color:green;">✅ Successfully Added to Database!</span>';
  } catch (error) {
    previewDiv.innerHTML = 'Scan Error: ' + error.message;
  }
}

// Function to check for matches
async function checkFoundPerson() {
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];
  const resultDiv = document.getElementById('result');

  if (!finderEmail || !file) return alert('Provide your email and a photo.');

  resultDiv.innerText = 'Analyzing face and comparing records...';

  try {
    const img = await createImageFromFile(file);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      resultDiv.innerHTML = '<b style="color:orange;">No face found.</b> Tips: Ensure the face isn\'t covered and the background isn\'t too busy.';
      return;
    }

    const queryDescriptor = detection.descriptor;
    const stored = loadStoredPeople();
    let bestMatch = { distance: 1, name: null, email: null, contact: null };

    // Euclidean distance works even if backgrounds are totally different
    for (const person of stored) {
      for (const descArr of person.descriptors) {
        const distance = faceapi.euclideanDistance(queryDescriptor, new Float32Array(descArr));
        if (distance < bestMatch.distance) {
          bestMatch = { distance, name: person.name, email: person.email, contact: person.contact };
        }
      }
    }

    if (bestMatch.distance < threshold) {
      const matchScore = ((1 - bestMatch.distance) * 100).toFixed(1);
      resultDiv.innerHTML = `<b style="color:green;">MATCH FOUND: ${bestMatch.name} (${matchScore}% confidence)</b><br>Notifications sent to both parties!`;
      sendDualEmails(bestMatch, finderEmail);
    } else {
      const closeScore = ((1 - bestMatch.distance) * 100).toFixed(1);
      resultDiv.innerHTML = `No certain match found. (Closest similarity in database: ${closeScore}%)`;
    }
  } catch (error) {
    resultDiv.innerText = 'Detection error. Try again.';
  }
}

function sendDualEmails(match, finderEmail) {
  const serviceID = 'service_kebubpr';
  const templateID = 'template_0i301n8';

  const ownerParams = {
    to_email: match.email,
    contact_name: match.contact,
    missing_name: match.name,
    message: `Match Found! Your contact ${match.name} was spotted. Finder's email: ${finderEmail}`
  };

  const finderParams = {
    to_email: finderEmail,
    contact_name: "Finder",
    missing_name: match.name,
    message: `You found a match for ${match.name}! You can reach the family (${match.contact}) at ${match.email}`
  };

  Promise.all([
    emailjs.send(serviceID, templateID, ownerParams),
    emailjs.send(serviceID, templateID, finderParams)
  ]).then(() => {
    alert('Match confirmed and emails sent to both parties!');
  }).catch(console.error);
}

loadModels();
