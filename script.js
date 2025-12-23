// Initialize EmailJS with your Public Key
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
        console.log("AI Models Ready");
    } catch (e) { console.error("AI Model Error:", e); }
}
loadModels();

/**
 * HELPER: Resize image for Mobile Stability
 * This prevents the browser from crashing on large mobile photos
 */
async function getResizedCanvas(file) {
    const img = await faceapi.bufferToImage(file);
    const canvas = document.createElement('canvas');
    const MAX_WIDTH = 800; // Optimal for face-api
    const scaleSize = MAX_WIDTH / img.width;
    
    if (img.width > MAX_WIDTH) {
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
    } else {
        canvas.width = img.width;
        canvas.height = img.height;
    }

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
}

/**
 * REGISTRATION LOGIC
 */
async function addMissingPerson() {
    const status = document.getElementById('status');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const contact = document.getElementById('contact').value.trim();
    const location = document.getElementById('location').value.trim();
    const files = document.getElementById('missing-photo').files;

    if (!name || !email || files.length === 0) {
        status.innerHTML = `<span style="color: #ff4f4f">⚠️ Please fill all fields.</span>`;
        return;
    }

    status.innerHTML = `🤖 Processing photos...`;

    try {
        const descriptors = [];
        for (let file of files) {
            // Resize image first to prevent mobile crashes
            const resizedCanvas = await getResizedCanvas(file);
            const detection = await faceapi.detectSingleFace(resizedCanvas)
                                          .withFaceLandmarks()
                                          .withFaceDescriptor();
            
            if (detection) {
                descriptors.push(Array.from(detection.descriptor));
            }
        }

        if (descriptors.length === 0) {
            status.innerHTML = `<span style="color: #ff4f4f">❌ No face detected. Try a clearer photo.</span>`;
            return;
        }

        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        stored.push({ name, email, contact, location, descriptors });
        localStorage.setItem('foundPeople', JSON.stringify(stored));

        status.innerHTML = `<span style="color: var(--green)">✅ Registered: ${name}</span>`;
    } catch (e) {
        status.innerHTML = `<span style="color: #ff4f4f">❌ Device Error: ${e.message}</span>`;
    }
}

/**
 * SCANNING LOGIC
 */
async function checkFoundPerson() {
    const result = document.getElementById('result');
    const finderEmail = document.getElementById('finder-email').value.trim();
    const file = document.getElementById('found-photo').files[0];

    if (!finderEmail || !file) {
        result.innerHTML = `<span style="color: #ff4f4f">⚠️ Photo & Email required.</span>`;
        return;
    }

    result.innerHTML = `🤖 Analyzing photo...`;

    try {
        const resizedCanvas = await getResizedCanvas(file);
        const detection = await faceapi.detectSingleFace(resizedCanvas)
                                      .withFaceLandmarks()
                                      .withFaceDescriptor();

        if (!detection) {
            result.innerHTML = `<span style="color: orange">⚠️ No face found. Try again.</span>`;
            return;
        }

        const queryDescriptor = detection.descriptor;
        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        let bestMatch = { distance: 1, person: null };

        stored.forEach(person => {
            if (person.descriptors && Array.isArray(person.descriptors)) {
                person.descriptors.forEach(descArr => {
                    const dist = faceapi.euclideanDistance(queryDescriptor, new Float32Array(descArr));
                    if (dist < bestMatch.distance) {
                        bestMatch = { distance: dist, person: person };
                    }
                });
            }
        });

        if (bestMatch.distance < threshold) {
            const accuracy = ((1 - bestMatch.distance) * 100).toFixed(1);
            result.innerHTML = `<div style="color: var(--green)">🎉 Match Found: <b>${bestMatch.person.name}</b> (${accuracy}%)</div>`;
            sendDualEmails(bestMatch.person, finderEmail, accuracy);
        } else {
            result.innerHTML = `<span style="color: var(--muted)">🔍 No match found.</span>`;
        }
    } catch (e) {
        result.innerHTML = `<span style="color: #ff4f4f">❌ Scan Error: ${e.message}</span>`;
    }
}

function sendDualEmails(match, finderEmail, accuracy) {
    const serviceID = 'service_kebubpr';
    const templateID = 'template_0i301n8';

    const ownerParams = {
        to_email: match.email,
        contact_name: match.contact,
        missing_name: match.name,
        message: `MATCH FOUND: ${match.name} was spotted. Finder: ${finderEmail}`
    };

    const finderParams = {
        to_email: finderEmail,
        contact_name: "Hero Finder",
        missing_name: match.name,
        message: `MATCH CONFIRMED: You found ${match.name}. Family: ${match.email}`
    };

    Promise.all([
        emailjs.send(serviceID, templateID, ownerParams),
        emailjs.send(serviceID, templateID, finderParams)
    ]).then(() => {
        alert('Emails sent to both parties!');
    });
}

window.addMissingPerson = addMissingPerson;
window.checkFoundPerson = checkFoundPerson;
