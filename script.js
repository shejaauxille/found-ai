async function checkFoundPerson() {
  const finderEmail = document.getElementById('finder-email').value.trim();
  const file = document.getElementById('found-photo').files[0];
  const resultDiv = document.getElementById('result');
  
  // Dynamically get the threshold from the slider
  const userThreshold = parseFloat(document.getElementById('sensitivity').value);

  if (!finderEmail || !file) return alert('Provide finder email and photo.');

  resultDiv.innerText = 'Deep scanning face...';

  try {
    const img = await createImageFromFile(file);
    // SSD Mobilenet V1 is best for "any background"
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      resultDiv.innerText = 'No face detected. Try a closer photo.';
      return;
    }

    const queryDescriptor = detection.descriptor;
    const stored = loadStoredPeople();
    let bestMatch = { distance: 1, name: null, email: null, contact: null };

    stored.forEach(person => {
      person.descriptors.forEach(descArr => {
        const distance = faceapi.euclideanDistance(queryDescriptor, new Float32Array(descArr));
        if (distance < bestMatch.distance) {
          bestMatch = { distance, name: person.name, email: person.email, contact: person.contact };
        }
      });
    });

    // Use the dynamic slider value here
    if (bestMatch.distance < userThreshold) {
      const matchScore = ((1 - bestMatch.distance) * 100).toFixed(1);
      resultDiv.innerHTML = `<b style="color:green;">MATCH FOUND: ${bestMatch.name} (${matchScore}% Match)</b>`;
      sendDualEmails(bestMatch, finderEmail);
    } else {
      const closeScore = ((1 - bestMatch.distance) * 100).toFixed(1);
      resultDiv.innerHTML = `No match found at ${userThreshold} sensitivity. (Closest was ${closeScore}%)`;
    }
  } catch (error) {
    resultDiv.innerText = 'Error processing image.';
  }
}
