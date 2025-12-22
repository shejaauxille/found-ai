// Initialize EmailJS
emailjs.init("YOUR_PUBLIC_KEY"); // Replace with your actual key

const threshold = 0.6;
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

// Load models on startup
async function loadModels() {
    await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    console.log("AI Ready");
}
loadModels();

/**
 * NEW FEATURE: Instant feedback when pictures are added
 */
document.getElementById('missing-photo').addEventListener('change', async function(e) {
    const statusDiv = document.getElementById('status');
    const files = e.target.files;
    
    if (files.length > 0) {
        statusDiv.innerHTML = `<span style="color: var(--blue)">⌛ Processing ${files.length} photo(s)...</span>`;
        
        // This small delay ensures the UI updates before the heavy AI processing starts
        setTimeout(() => {
            statusDiv.innerHTML = `<span style="color: var(--green)">📸 ${files.length} photo(s) attached. Ready to register.</span>`;
        }, 500);
    }
});

/**
 * Register Missing Person Logic
 */
async function addMissingPerson() {
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const contact = document.getElementById('contact').value.trim();
    const location = document.getElementById('location').value.trim();
    const files = document.getElementById('missing-photo').files;
    const statusDiv = document.getElementById('status');

    if (!name || !email || files.length === 0) {
        statusDiv.innerHTML = '<span style="color: #ff4f4f">❌ Please fill all fields and add photos.</span>';
        return;
    }

    statusDiv.innerHTML = '<span style="color: var(--purple)">🤖 Extracting facial features...</span>';

    try {
        const descriptors = [];
        for (let file of files) {
            const img = await faceapi.bufferToImage(file);
            const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
            
            if (detection) {
                descriptors.push(Array.from(detection.descriptor));
            }
        }

        if (descriptors.length === 0) {
            statusDiv.innerHTML = '<span style="color: #ff4f4f">❌ No clear face found in photos.</span>';
            return;
        }

        // Save to LocalStorage
        const stored = JSON.parse(localStorage.getItem('foundPeople') || '[]');
        stored.push({ name, email, contact, location, descriptors });
        localStorage.setItem('foundPeople', JSON.stringify(stored));

        statusDiv.innerHTML = '<span style="color: var(--green)">✅ Person successfully registered!</span>';
        
        // Clear form
        document.getElementById('form-missing').querySelectorAll('input').forEach(i => i.value = '');
    } catch (err) {
        statusDiv.innerHTML = '<span style="color: #ff4f4f">❌ Error: ' + err.message + '</span>';
    }
}

// ... include your checkFoundPerson and sendEmail functions here ...
