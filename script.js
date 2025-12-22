// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6; 
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

async function loadModels() {
  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log('AI Ready');
  } catch (error) {
    console.error('Model error:', error);
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
  const mName = document.getElementById('name').value.trim();
  const fEmail = document.getElementById('email').value.trim();
  const fContact = document.getElementById('contact').value.trim();
  const fLoc = document.getElementById('location').value.trim(); // Get Location
  const files = document.getElementById('missing-photo').files;

  if (!mName || !fEmail || files.length === 0) return alert('Fill required fields.');

  const previewDiv = document.getElementById('preview');
  previewDiv.innerHTML = 'Scanning face...';

  try {
    const descriptors = [];
    for (let file of files) {
      const img = await createImageFromFile(file);
      const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
      if (detection) descriptors.push(Array.from(detection.descriptor));
    }

    if (descriptors.length === 0) {
      previewDiv.innerHTML = 'No face detected.';
      return;
    }

    const stored = loadStoredPeople();
    stored.push({ 
        name: mName, 
        email: fEmail, 
        contact: fContact, 
        location: fLoc, // Save Location
        descriptors 
    });
    savePeople(stored);
    previewDiv.innerHTML = '✅ Successfully Registered.';
  } catch (e) { console.error(e); }
}

async function checkFoundPerson() {
  const fEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];
  const resultDiv = document.getElementById('result');

  if (!fEmail || !file) return alert('Fill finder email and upload photo.');

  resultDiv.innerText = 'Scanning...';

  try {
    const img = await createImageFromFile(file);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      resultDiv.innerText = 'No face detected.';
      return;
    }

    const queryDescriptor = detection.descriptor;
    const stored = loadStoredPeople();
    let bestMatch = { distance: 1, name: null, email: null, contact: null, location: null };

    stored.forEach(person => {
      person.descriptors.forEach(descArr => {
        const distance = faceapi.euclideanDistance(queryDescriptor, new Float32Array(descArr));
        if (distance < bestMatch.distance) {
          bestMatch = { 
            distance, 
            name: person.name, 
            email: person.email, 
            contact: person.contact,
            location: person.location 
          };
        }
      });
    });

    if (bestMatch.distance < threshold) {
      resultDiv.innerHTML = `<b style="color:green;">Match Found: ${bestMatch.name}</b>`;
      sendDualEmails(bestMatch, fEmail);
    } else {
      resultDiv.innerText = 'No match found.';
    }
  } catch (e) { console.error(e); }
}

function sendDualEmails(match, finderEmail) {
  const serviceID = 'service_kebubpr';
  const templateID = 'template_0i301n8';

  // Email to Family
  const ownerParams = {
    to_email: match.email, // This works ONLY if template "To Email" is {{to_email}}
    contact_name: match.contact,
    missing_name: match.name,
    message: `ALERT: ${match.name} was found! Contact the finder at: ${finderEmail}`
  };

  // Email to Finder
  const finderParams = {
    to_email: finderEmail, // This sends to the person who found them
    contact_name: "Hero Finder",
    missing_name: match.name,
    message: `You found ${match.name}! This person is from ${match.location || 'Unknown Location'}. Please contact the family (${match.contact}) at ${match.email}`
  };

  Promise.all([
    emailjs.send(serviceID, templateID, ownerParams),
    emailjs.send(serviceID, templateID, finderParams)
  ]).then(() => alert('Notifications sent to both parties!'))
    .catch(err => console.error('EmailJS Error:', err));
}

loadModels();
