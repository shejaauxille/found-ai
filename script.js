// Initialize EmailJS with your Public Key
emailjs.init("OCug6QTCHUuWt7iCr");

const threshold = 0.6; 
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

// 1. Load Models properly
async function loadModels() {
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        console.log("AI Models Loaded Successfully");
    } catch (e) {
        console.error("AI Model Loading Error:", e);
    }
}
loadModels();

/**
 * REGISTRATION LOGIC
 */
async function addMissingPerson() {
    const status = document.getElementById('status');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const contact = document.getElementById('contact').value.trim();
    const location = document.getElementById('location').value.trim();
    const fileInput = document.getElementById('missing-photo');
    const files = fileInput.files;

    if (!name || !email || files.length === 0) {
        status.innerHTML = `<span style="color: #ff4f4f">⚠️ Please fill all fields and select photos.</span>`;
        return;
    }

    status.innerHTML = `<span style="color: purple">🤖 Processing photos...</span>`;

    try {
        const descriptors = [];
        
        // Use for...of to correctly await each face detection
        for (let file of files) {
            const img = await faceapi.bufferToImage(file);
            const detection = await faceapi.detectSingleFace(img)
                                          .withFaceLandmarks()
                                          .withFaceDescriptor();
            
            if (detection) {
                // Convert Float32Array to regular Array for JSON storage
                descriptors.push(Array.from(detection.descriptor));
            }
        }

        if (descriptors.length === 0) {
            status.innerHTML = `<span style="color: #ff4f4f">❌ No faces detected. Use clearer photos.</span>`;
            return;
        }

        // Save to Database (LocalStorage)
        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        stored.push({ name, email, contact, location, descriptors });
        localStorage.setItem('foundPeople', JSON.stringify(stored));

        status.innerHTML = `<span style="color: green">✅ Success! ${name} added to database.</span>`;
        document.getElementById('name').value = ''; // Reset form
    } catch (e) {
        console.error(e);
        status.innerHTML = `<span style="color: #ff4f4f">❌ Error: ${e.message}</span>`;
    }
}

/**
 * SCANNING LOGIC
 */
async function checkFoundPerson() {
    const result = document.getElementById('result');
    const finderEmail = document.getElementById('finder-email').value.trim();
    const fileInput = document.getElementById('found-photo');
    const file = fileInput.files[0];

    if (!finderEmail || !file) {
        result.innerHTML = `<span style="color: #ff4f4f">⚠️ Email and photo are required.</span>`;
        return;
    }

    result.innerHTML = `<span style="color: blue">🤖 Searching database...</span>`;

    try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img)
                                      .withFaceLandmarks()
                                      .withFaceDescriptor();

        if (!detection) {
            result.innerHTML = `<span style="color: orange">⚠️ No face found in this photo.</span>`;
            return;
        }

        const queryDescriptor = detection.descriptor;
        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        let bestMatch = { distance: 1.0, person: null };

        // The "Safety Check" loop to prevent the 'forEach' error
        stored.forEach(person => {
            if (person.descriptors && Array.isArray(person.descriptors)) {
                person.descriptors.forEach(descArr => {
                    // Convert back to Float32Array for calculation
                    const dist = faceapi.euclideanDistance(queryDescriptor, new Float32Array(descArr));
                    if (dist < bestMatch.distance) {
                        bestMatch = { distance: dist, person: person };
                    }
                });
            }
        });

        if (bestMatch.person && bestMatch.distance < threshold) {
            const accuracy = ((1 - bestMatch.distance) * 100).toFixed(1);
            result.innerHTML = `
                <div style="color: green; border: 1px solid green; padding: 10px;">
                    🎉 Match Found: <b>${bestMatch.person.name}</b><br>
                    <small>Accuracy: ${accuracy}% - Sending alerts...</small>
                </div>`;
            
            sendDualEmails(bestMatch.person, finderEmail, accuracy);
        } else {
            result.innerHTML = `<span style="color: gray">🔍 No match found in our records.</span>`;
        }
    } catch (e) {
        console.error(e);
        result.innerHTML = `<span style="color: #ff4f4f">❌ Scan Error: ${e.message}</span>`;
    }
}

/**
 * EMAIL EXCHANGE
 */
function sendDualEmails(match, finderEmail, accuracy) {
    const serviceID = 'service_kebubpr';
    const templateID = 'template_0i301n8';

    const commonParams = {
        accuracy: accuracy + "%",
        missing_name: match.name,
        location: match.location
    };

    // Alert for Family
    emailjs.send(serviceID, templateID, {
        ...commonParams,
        to_email: match.email,
        contact_name: match.contact,
        message: `MATCH FOUND: ${match.name} was spotted! Contact the finder at: ${finderEmail}`
    });

    // Info for Finder
    emailjs.send(serviceID, templateID, {
        ...commonParams,
        to_email: finderEmail,
        contact_name: "Hero Finder",
        message: `MATCH CONFIRMED: You found ${match.name}. Contact the family at: ${match.email} (${match.contact})`
    }).then(() => {
        alert('Alerts sent! Emails have been exchanged between both parties.');
    });
}
