// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

// Threshold for match (lower = stricter)
const similarityThreshold = 0.6;

// Load stored people
function loadStoredPeople() {
  const data = localStorage.getItem('foundPeople');
  return data ? JSON.parse(data) : [];
}

function savePeople(people) {
  localStorage.setItem('foundPeople', JSON.stringify(people));
}

// Load model (runs in browser)
let model = null;
async function loadModel() {
  if (!model) {
    try {
      model = await Xenova.pipeline('feature-extraction', 'Xenova/resnet-50');
      console.log('Model loaded');
    } catch (error) {
      console.error('Model load failed:', error);
      alert('Failed to load AI model. Refresh and try again.');
    }
  }
  return model;
}

// Compute face embedding
async function getEmbedding(image) {
  const model = await loadModel();
  const tensor = await Xenova.readImage(image);
  const output = await model(tensor, { pooling: 'mean', normalize: true });
  return output.data;
}

// Add missing person
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
    await loadModel(); // Ensure model is ready
    const embeddings = [];
    for (let file of files) {
      const img = await createImageFromFile(file);
      const embedding = await getEmbedding(img);
      embeddings.push(Array.from(embedding));
    }

    const stored = loadStoredPeople();
    stored.push({ name, email, contact, embeddings });
    savePeople(stored);
    alert('Added successfully!');
  } catch (error) {
    console.error('Add error:', error);
    alert('Error adding person: ' + error.message);
  }
}

// Helper: Create image from file
function createImageFromFile(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = URL.createObjectURL(file);
  });
}

// Check found person
async function checkFoundPerson() {
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];

  if (!finderEmail || !file) {
    alert('Fill finder email and upload photo.');
    return;
  }

  try {
    await loadModel();
    const img = await createImageFromFile(file);
    const queryEmbedding = await getEmbedding(img);

    const stored = loadStoredPeople();
    let bestMatch = { similarity: 0, name: null };

    stored.forEach(person => {
      person.embeddings.forEach(embedArr => {
        const embed = new Float32Array(embedArr);
        const similarity = cosineSimilarity(queryEmbedding, embed);
        if (similarity > bestMatch.similarity) {
          bestMatch = { similarity, name: person.name };
        }
      });
    });

    const resultDiv = document.getElementById('result');
    if (bestMatch.similarity > similarityThreshold) {
      const match = stored.find(p => p.name === bestMatch.name);
      resultDiv.innerText = `Match: ${bestMatch.name} (similarity: ${bestMatch.similarity.toFixed(2)})! Emails sent.`;
      sendEmail(match.email, match.contact, bestMatch.name, finderEmail);
    } else {
      resultDiv.innerText = `No match (best similarity: ${bestMatch.similarity.toFixed(2)}).`;
    }
  } catch (error) {
    console.error('Check error:', error);
    document.getElementById('result').innerText = 'Error – try again.';
  }
}

// Cosine similarity
function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Send email to both
function sendEmail(toEmail, contactName, missingName, finderEmail) {
  const contactParams = {
    to_email: toEmail,
    contact_name: contactName,
    missing_name: missingName,
    message: `Your loved one ${missingName} has been found! Finder's email: ${finderEmail}`
  };

  emailjs.send('service_kebubpr', 'template_0i301n8', contactParams)
    .then(() => console.log('Email to contact sent!'))
    .catch(err => alert('Email failed: ' + (err.text || err.message)));

  const finderParams = {
    to_email: finderEmail,
    contact_name: contactName,
    missing_name: missingName,
    message: `You found ${missingName}! Contact email: ${toEmail}`
  };

  emailjs.send('service_kebubpr', 'template_0i301n8', finderParams)
    .then(() => alert('Emails sent to both!'))
    .catch(err => alert('Email failed: ' + (err.text || err.message)));
}

// Load model on page load
loadModel().catch(err => console.error('Initial model load failed:', err));
