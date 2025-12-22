// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

// Face++ API details
const FACEPP_API_KEY = 'TbeANjMZ3Lnw0B1GZi83Xwei-jgahnXU';
const FACEPP_API_SECRET = 'KHyZoOB3lnmq_lwkz7l9eLr8acnGqVA_';
const FACEPP_URL = 'https://api-us.faceplusplus.com/facepp/v3/';

// Faceset outer_id
const FACESET_OUTER_ID = 'found_faceset';

const matchThreshold = 70;

function loadStoredPeople() {
  const data = localStorage.getItem('foundPeople');
  return data ? JSON.parse(data) : [];
}

function savePeople(people) {
  localStorage.setItem('foundPeople', JSON.stringify(people));
}

async function faceppCall(endpoint, formData) {
  formData.append('api_key', FACEPP_API_KEY);
  formData.append('api_secret', FACEPP_API_SECRET);
  const response = await fetch(`${FACEPP_URL}${endpoint}`, { method: 'POST', body: formData });
  const data = await response.json();
  if (data.error_message) {
    if (data.error_message.includes('already exists') || data.error_message.includes('FACESET_EXIST')) {
      console.log('Faceset exists, continuing...');
      return { success: true };
    }
    throw new Error(data.error_message);
  }
  return data;
}

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
    // Create faceset (ignore if exists)
    let formData = new FormData();
    formData.append('outer_id', FACESET_OUTER_ID);
    await faceppCall('faceset/create', formData);

    const faceTokens = [];
    for (let file of files) {
      formData = new FormData();
      formData.append('image_file', file);
      const detectData = await faceppCall('detect', formData);
      if (detectData.faces && detectData.faces.length > 0) {
        faceTokens.push(detectData.faces[0].face_token);
      } else {
        alert('No face detected in photo.');
      }
    }

    if (faceTokens.length === 0) {
      alert('No valid faces.');
      return;
    }

    formData = new FormData();
    formData.append('outer_id', FACESET_OUTER_ID);
    formData.append('face_tokens', faceTokens.join(','));
    await faceppCall('faceset/addface', formData);

    const stored = loadStoredPeople();
    stored.push({ name, email, contact });
    savePeople(stored);
    alert('Added!');
  } catch (error) {
    console.error('Add error:', error);
    alert('Error: ' + error.message);
  }
}

async function checkFoundPerson() {
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];

  if (!finderEmail || !file) {
    alert('Fill finder email and upload photo.');
    return;
  }

  try {
    let formData = new FormData();
    formData.append('image_file', file);
    const detectData = await faceppCall('detect', formData);
    if (detectData.faces.length === 0) {
      alert('No face detected.');
      return;
    }
    const faceToken = detectData.faces[0].face_token;

    formData = new FormData();
    formData.append('face_token', faceToken);
    formData.append('outer_id', FACESET_OUTER_ID);
    const searchData = await faceppCall('search', formData);

    if (searchData.results && searchData.results.length > 0) {
      const bestMatch = searchData.results[0];
      if (bestMatch.confidence > matchThreshold) {
        const stored = loadStoredPeople();
        const match = stored[0]; // For prototype, use first stored
        document.getElementById('result').innerText = `Match found (${bestMatch.confidence}%)! Emails sent.`;
        sendEmail(match.email, match.contact, match.name, finderEmail);
        return;
      }
    }
    document.getElementById('result').innerText = 'No match.';
  } catch (error) {
    console.error('Check error:', error);
    document.getElementById('result').innerText = 'Error: ' + error.message;
  }
}

function sendEmail(toEmail, contactName, missingName, finderEmail) {
  const params = {
    contact_name: contactName,
    missing_name: missingName,
    message: `Your loved one ${missingName} has been found! Finder's email: ${finderEmail}`
  };

  params.to_email = toEmail;
  emailjs.send('service_9tjachj', 'template_0i301n8', params)
    .then(() => console.log('Email to contact sent.'));

  params.to_email = finderEmail;
  params.message = `You found ${missingName}! Contact email: ${toEmail}`;
  emailjs.send('service_9tjachj', 'template_0i301n8', params)
    .then(() => alert('Emails sent to both!'))
    .catch(err => alert('Email failed: ' + err));
}
