// Initialize EmailJS with your Public Key
emailjs.init("YOUR_PUBLIC_KEY"); 

const threshold = 0.6; // Balanced sensitivity for different backgrounds
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

/**
 * 1. LOAD MODELS
 * SSD MobileNet V1 is more robust for complex backgrounds.
 */
async function loadModels() {
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        console.log("AI Systems Active");
    } catch (error) {
        console.error("Model loading failed:", error);
    }
}
loadModels();

/**
 * 2. FEEDBACK LISTENERS
 * Provides immediate feedback when files are selected.
 */
document.getElementById('missing-photo').addEventListener('change', function(e) {
    const statusDiv = document.getElementById('status');
    if (e.target.files.length > 0) {
        statusDiv.innerHTML = `<span style="color: var(--blue)">⌛ ${e.target.files.length} photo(s) selected. Ready to register.</span>`;
    }
});

document.getElementById('found-photo').addEventListener('change', function(e) {
    const resultDiv = document.getElementById('result');
    if (e.target.files.length > 0) {
        resultDiv.innerHTML = `<span style="color: var(--blue)">⌛ Photo selected. Ready to scan.</span>`;
    }
});

/**
 * 3. REGISTER MISSING PERSON
 */
async function addMissingPerson() {
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const contact = document.getElementById('contact').value.trim();
    const location = document.getElementById('location').value.trim();
    const files = document.getElementById('missing-photo').files;
    const statusDiv = document.getElementById('status');

    if (!name || !email || files.length === 0) {
        statusDiv.innerHTML = '<span style="color: #ff4f4f">❌ Missing required information.</span>';
        return;
    }

    statusDiv.innerHTML = '<span style="color: var(--purple)">🤖 AI is analyzing facial features...</span>';

    try {
        const descriptors = [];
        for (let file of files) {
            const img = await faceapi.bufferToImage(file);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            if (detection) descriptors.push(Array.from(detection.descriptor));
        }

        if (descriptors.length === 0) {
            statusDiv.innerHTML = '<span style="color: #ff4f4f">❌ No face detected. Try a clearer photo.</span>';
            return;
        }

        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        stored.push({ name, email, contact, location, descriptors });
        localStorage.setItem('foundPeople', JSON.stringify(stored));

        statusDiv.innerHTML = '<span style="color: var(--green)">✅ Registered successfully!</span>';
    } catch (err) {
        statusDiv.innerHTML = '❌ Error: ' + err.message;
    }
}

/**
 * 4. CHECK FOUND PERSON (With Loading & Messages)
 */
async function checkFoundPerson() {
    const finderEmail = document.getElementById('finder-email').value.trim();
    const file = document.getElementById('found-photo').files[0];
    const resultDiv = document.getElementById('result');

    if (!finderEmail || !file) {
        resultDiv.innerHTML = '<span style="color: #ff4f4f">❌ Provide email and photo.</span>';
        return;
    }

    // Loading State
    resultDiv.innerHTML = '<span style="color: var(--purple)">🤖 Scanning photo for a match...</span>';

    try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

        if (!detection) {
            resultDiv.innerHTML = '<span style="color: orange">⚠️ No face found. Ensure the face is visible.</span>';
            return;
        }

        const queryDescriptor = detection.descriptor;
        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        let bestMatch = { distance: 1, name: null, email: null, contact: null, location: null };

        // Compare using Euclidean Distance
        stored.forEach(person => {
            person.descriptors.forEach(descArr => {
                const distance = faceapi.euclideanDistance(queryDescriptor, new Float32Array(descArr));
                if (distance < bestMatch.distance) {
                    bestMatch = { ...person, distance };
                }
            });
        });

        if (bestMatch.distance < threshold) {
            const confidence = ((1 - bestMatch.distance) * 100).toFixed(1);
            resultDiv.innerHTML = `<span style="color: var(--green)">🎉 MATCH FOUND: ${bestMatch.name} (${confidence}%)</span><br>
                                   <small style="color: var(--muted)">Exchanging contact info via email...</small>`;
            
            sendDualEmails(bestMatch, finderEmail);
        } else {
            resultDiv.innerHTML = '<span style="color: var(--muted)">🔍 No match found in our database.</span>';
        }
    } catch (err) {
        resultDiv.innerHTML = '❌ Scan error: ' + err.message;
    }
}

/**
 * 5. DUAL EMAIL SYSTEM
 */
function sendDualEmails(match, finderEmail) {
    const serviceID = 'service_kebubpr';
    const templateID = 'template_0i301n8';

    // Email to the Family
    const ownerParams = {
        to_email: match.email,
        contact_name: match.contact,
        missing_name: match.name,
        message: `Match found! ${match.name} was spotted. Contact the finder at: ${finderEmail}`
    };

    // Email to the Finder
    const finderParams = {
        to_email: finderEmail,
        contact_name: "Finder",
        missing_name: match.name,
        message: `You found ${match.name}! They are from ${match.location}. Contact family (${match.contact}) at: ${match.email}`
    };

    Promise.all([
        emailjs.send(serviceID, templateID, ownerParams),
        emailjs.send(serviceID, templateID, finderParams)
    ]).then(() => console.log("Notifications Sent"))
      .catch(err => console.error("Email Error:", err));
}
