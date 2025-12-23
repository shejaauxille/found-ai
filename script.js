// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6;
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

async function loadModels() {
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log("AI Systems Online");
}
loadModels();

/**
 * Helper: Shrinks image size to ensure EmailJS can handle the Base64 string
 */
async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300; // Small size for email compatibility
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); // 70% quality
            };
        };
    });
}

/**
 * Report Missing Person
 */
async function addMissingPerson() {
    const statusDiv = document.getElementById('status');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const contact = document.getElementById('contact').value.trim();
    const location = document.getElementById('location').value.trim();
    const files = document.getElementById('missing-photo').files;

    if (!name || !email || files.length === 0) {
        statusDiv.innerHTML = '<span style="color: #ff4f4f">❌ Missing fields or photo.</span>';
        return;
    }

    statusDiv.innerHTML = '<span style="color: var(--purple)">🤖 AI is encoding facial features...</span>';

    try {
        const descriptors = [];
        for (let file of files) {
            const img = await faceapi.bufferToImage(file);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            if (detection) descriptors.push(Array.from(detection.descriptor));
        }

        if (descriptors.length === 0) {
            statusDiv.innerHTML = '<span style="color: #ff4f4f">❌ No face detected. Use a clearer photo.</span>';
            return;
        }

        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        stored.push({ name, email, contact, location, descriptors });
        localStorage.setItem('foundPeople', JSON.stringify(stored));

        statusDiv.innerHTML = '<span style="color: var(--green)">✅ Registration Successful!</span>';
    } catch (e) {
        statusDiv.innerHTML = "❌ Error: " + e.message;
    }
}

/**
 * Check Found Person
 */
async function checkFoundPerson() {
    const resultDiv = document.getElementById('result');
    const finderEmail = document.getElementById('finder-email').value.trim();
    const file = document.getElementById('found-photo').files[0];

    if (!finderEmail || !file) {
        resultDiv.innerHTML = '<span style="color: #ff4f4f">❌ Provide email and photo.</span>';
        return;
    }

    resultDiv.innerHTML = '<span style="color: var(--purple)">🤖 Scanning and compressing image...</span>';

    try {
        // Prepare image for email
        const compressedBase64 = await compressImage(file);

        // Run AI Detection
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
            resultDiv.innerHTML = '<span style="color: orange">⚠️ No face found in photo.</span>';
            return;
        }

        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        let bestMatch = { distance: 1, person: null };

        stored.forEach(person => {
            person.descriptors.forEach(descArr => {
                const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(descArr));
                if (dist < bestMatch.distance) {
                    bestMatch = { distance: dist, person: person };
                }
            });
        });

        if (bestMatch.distance < threshold) {
            const accuracy = ((1 - bestMatch.distance) * 100).toFixed(1);
            resultDiv.innerHTML = `<span style="color: var(--green)">🎉 Match: ${bestMatch.person.name} (${accuracy}%)</span><br><small>Sending secure emails...</small>`;
            
            await sendDualEmails(bestMatch.person, finderEmail, accuracy, compressedBase64);
            
            // Success Message after emails are sent
            resultDiv.innerHTML = `
                <div style="background: rgba(39, 255, 155, 0.1); padding: 15px; border-radius: 10px; border: 1px solid var(--green);">
                    <h4 style="margin:0; color: var(--green);">Ready for Reunification!</h4>
                    <p style="font-size: 0.9rem; margin: 10px 0 0;">Verification emails (with photo) have been sent to both the family and the finder.</p>
                </div>`;
        } else {
            resultDiv.innerHTML = '<span style="color: var(--muted)">🔍 No match found. We will alert you if they are registered later.</span>';
        }
    } catch (e) {
        resultDiv.innerHTML = "❌ Error: " + e.message;
    }
}

/**
 * Send Dual Emails
 */
async function sendDualEmails(match, finderEmail, accuracy, imageData) {
    const serviceID = 'service_kebubpr';
    const templateID = 'template_0i301n8';

    const commonParams = {
        missing_name: match.name,
        found_image: imageData,
        accuracy: accuracy
    };

    const ownerParams = {
        ...commonParams,
        to_email: match.email,
        contact_name: match.contact,
        message: `Match confirmed (${accuracy}%). ${match.name} was found! Contact the finder at: ${finderEmail}`
    };

    const finderParams = {
        ...commonParams,
        to_email: finderEmail,
        contact_name: "Hero Finder",
        message: `Match confirmed (${accuracy}%). You found ${match.name}! Contact the family (${match.contact}) at: ${match.email}`
    };

    return Promise.all([
        emailjs.send(serviceID, templateID, ownerParams),
        emailjs.send(serviceID, templateID, finderParams)
    ]);
}
