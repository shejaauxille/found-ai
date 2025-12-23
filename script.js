// Initialize EmailJS
emailjs.init("OCug6QTCHUuWt7iCr");

const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';
const threshold = 0.6;

// Load Face-API models
async function loadModels() {
    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        console.log("AI Models Ready");
    } catch (e) { 
        console.error("Face-API Loading Error:", e); 
    }
}
loadModels();

/**
 * REGISTER PERSON (Face only)
 */
async function addMissingPerson() {
    const status = document.getElementById('status');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const contact = document.getElementById('contact').value.trim();
    const photo = document.getElementById('missing-photo').files[0];

    if (!name || !photo || !email) { 
        status.innerText = "⚠️ Name, Email, and Photo are required."; 
        return; 
    }

    status.innerHTML = `<span class="spinner"></span> Extracting facial features...`;

    try {
        const img = await faceapi.bufferToImage(photo);
        const detection = await faceapi.detectSingleFace(img)
                                      .withFaceLandmarks()
                                      .withFaceDescriptor();

        if (!detection) throw new Error("Face not clear enough. Please use a different photo.");

        const person = {
            name: name,
            email: email,
            contact: contact,
            // Save descriptor as a standard array for localStorage compatibility
            descriptor: Array.from(detection.descriptor)
        };

        const db = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        db.push(person);
        localStorage.setItem('foundPeople', JSON.stringify(db));

        status.innerHTML = `<span style="color:var(--green)">✅ Successfully Registered: ${name}</span>`;
        
        // Clear inputs
        document.getElementById('name').value = "";
    } catch (e) { 
        status.innerText = `❌ ${e.message}`; 
    }
}

/**
 * SCAN FOUND PERSON (Face comparison only)
 */
async function checkFoundPerson() {
    const resultDiv = document.getElementById('result');
    const file = document.getElementById('found-photo').files[0];
    const finderEmail = document.getElementById('finder-email').value.trim();

    if (!file || !finderEmail) { 
        resultDiv.innerText = "⚠️ Photo and your Email are required."; 
        return; 
    }

    resultDiv.innerHTML = `<span class="spinner"></span> Scanning face against database...`;

    try {
        const img = await faceapi.bufferToImage(file);
        const detection = await faceapi.detectSingleFace(img)
                                      .withFaceLandmarks()
                                      .withFaceDescriptor();
        
        if (!detection) {
            resultDiv.innerText = "⚠️ No face detected in the photo.";
            return;
        }

        const db = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        let match = null;
        let bestDist = 1.0;

        // Compare against stored descriptors
        db.forEach(person => {
            if (person.descriptor) {
                const dist = faceapi.euclideanDistance(detection.descriptor, new Float32Array(person.descriptor));
                if (dist < threshold && dist < bestDist) {
                    bestDist = dist;
                    match = person;
                }
            }
        });

        if (match) {
            resultDiv.innerText = "⏳ Match Found! Sending alerts...";
            
            const accuracy = ((1 - bestDist) * 100).toFixed(1);

            await emailjs.send('service_kebubpr', 'template_0i301n8', {
                to_email: match.email,
                contact_name: match.contact,
                missing_name: match.name,
                message: `GOOD NEWS: ${match.name} was identified with ${accuracy}% accuracy. Please contact the finder at: ${finderEmail}`
            });

            resultDiv.innerHTML = `<div style="color:var(--green)"><b>✅ MATCH CONFIRMED: ${match.name}</b><br>Alert emails have been sent to the family.</div>`;
        } else {
            resultDiv.innerHTML = `<div style="color:orange">🔍 No match found in the database.</div>`;
        }
    } catch (e) { 
        resultDiv.innerText = `❌ Error: ${e.message}`; 
    }
}

// Attach functions to window for HTML access
window.addMissingPerson = addMissingPerson;
window.checkFoundPerson = checkFoundPerson;
