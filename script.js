// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

// Threshold for match (lower = stricter)
const threshold = 0.6;

// Load models
async function loadModels() {
  await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
  await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
  await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
  console.log('Models loaded');
}

// Compare faces
async function compareFaces() {
  const missingName = document.getElementById('missing-name').value.trim();
  const missingEmail = document.getElementById('missing-email').value.trim();
  const finderEmail = document.getElementById('finder-email').value.trim();
  const missingFile = document.getElementById('missing-photo').files[0];
  const foundFile = document.getElementById('found-photo').files[0];

  if (!missingName || !missingEmail || !finderEmail || !missingFile || !foundFile) {
    alert('Fill all fields and upload both photos.');
    return;
  }

  try {
    const missingImg = await createImageFromFile(missingFile);
    const foundImg = await createImageFromFile(foundFile);

    const missingDetection = await faceapi.detectSingleFace(missingImg, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    const foundDetection = await faceapi.detectSingleFace(foundImg, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!missingDetection || !foundDetection) {
      document.getElementById('result').innerText = 'No face detected in one or both photos.';
      return;
    }

    const distance = faceapi.euclideanDistance(missingDetection.descriptor, foundDetection.descriptor);
    const similarity = (1 - distance).toFixed(2);

    const resultDiv = document.getElementById('result');
    if (distance < threshold) {
      resultDiv.innerText = `Match found: ${similarity * 100}% similarity! Emails sent.`;
      sendEmail(missingEmail, missingName, finderEmail);
    } else {
      resultDiv.innerText = `No match (${similarity * 100}% similarity).`;
    }
  } catch (error) {
    console.error('Comparison error:', error);
    document.getElementById('result').innerText = 'Error – try clearer photos.';
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

// Send emails to both
function sendEmail(missingEmail, missingName, finderEmail) {
  // To missing contact
  const contactParams = {
    to_email: missingEmail,
    contact_name: missingName,
    missing_name: missingName,
    message: `Your loved one has been found! Finder's email: ${finderEmail}`
  };

  emailjs.send('service_kebubpr', 'template_0i301n8', contactParams)
    .then(() => console.log('Email to missing contact sent!'))
    .catch(err => alert('Email failed: ' + (err.text || err.message)));

  // To finder
  const finderParams = {
    to_email: finderEmail,
    contact_name: missingName,
    missing_name: missingName,
    message: `You found ${missingName}! Contact email: ${missingEmail}`
  };

  emailjs.send('service_kebubpr', 'template_0i301n8', finderParams)
    .then(() => alert('Emails sent to both!'))
    .catch(err => alert('Email failed: ' + (err.text || err.message)));
}

// Load models on page load
loadModels();
