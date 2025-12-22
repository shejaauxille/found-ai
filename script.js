emailjs.init("YOUR_PUBLIC_KEY");

const threshold = 0.6;
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

async function loadModels() {
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log("AI Ready");
}
loadModels();

// File Listeners for immediate feedback
document.getElementById('missing-photo').addEventListener('change', e => {
    document.getElementById('status').innerHTML = `<span style="color: var(--blue)">⌛ ${e.target.files.length} photo(s) ready.</span>`;
});

document.getElementById('found-photo').addEventListener('change', e => {
    document.getElementById('result').innerHTML = `<span style="color: var(--blue)">⌛ Photo ready for scanning.</span>`;
});

async function addMissingPerson() {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const contact = document.getElementById('contact').value;
    const location = document.getElementById('location').value;
    const files = document.getElementById('missing-photo').files;
    const statusDiv = document.getElementById('status');

    if (!name || !email || files.length === 0) return statusDiv.innerHTML = "❌ Fill all fields.";
    statusDiv.innerHTML = '<span style="color: var(--purple)">🤖 AI is scanning faces...</span>';

    try {
        const descriptors = [];
        for (let file of files) {
            const img = await faceapi.bufferToImage(file);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            if (detection) descriptors.push(Array.from(detection.descriptor));
        }
        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        stored.push({ name, email, contact, location, descriptors });
        localStorage.setItem('foundPeople', JSON.stringify(stored));
        statusDiv.innerHTML = '<span style="color: var(--green)">✅ Registered Successfully!</span>';
    } catch (e) { statusDiv.innerHTML = "❌ Error: " + e.message; }
}

async function checkFoundPerson() {
    const finderEmail = document.getElementById('finder-email').value;
    const file = document.getElementById('found-photo').files[0];
    const resultDiv = document.getElementById('result');

    if (!finderEmail || !file) return resultDiv.innerHTML = "❌ Email and photo required.";
    resultDiv.innerHTML = '<span style="color: var(--purple)">🤖 Searching for a match...</span>';

    try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        if (!detection) return resultDiv.innerHTML = "⚠️ No face detected.";

        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        let bestMatch = { distance: 1, name: null };

        stored.forEach(person => {
            person.descriptors.forEach(descArr => {
                const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(descArr));
                if (dist < bestMatch.distance) bestMatch = { ...person, distance: dist };
            });
        });

        if (bestMatch.distance < threshold) {
            resultDiv.innerHTML = `<span style="color: var(--green)">🎉 MATCH FOUND: ${bestMatch.name}</span>`;
            sendEmails(bestMatch, finderEmail);
        } else {
            resultDiv.innerHTML = "🔍 No match found.";
        }
    } catch (e) { resultDiv.innerHTML = "❌ Error processing."; }
}

function sendEmails(match, finderEmail) {
    const params = { to_email: match.email, contact_name: match.contact, missing_name: match.name, message: `Found by ${finderEmail}` };
    const finderParams = { to_email: finderEmail, contact_name: "Finder", missing_name: match.name, message: `Contact family: ${match.email}` };
    
    Promise.all([
        emailjs.send('service_kebubpr', 'template_0i301n8', params),
        emailjs.send('service_kebubpr', 'template_0i301n8', finderParams)
    ]).then(() => console.log("Alerts Sent"));
}
