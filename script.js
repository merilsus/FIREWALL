async function checkPhishing() {
    const text = document.getElementById("emailInput").value;

    const response = await fetch("http://localhost:5000/phishing", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: text })
    });

    const data = await response.json();
    document.getElementById("phishingResult").innerText = data.result;
}

async function submitComplaint() {
    const text = document.getElementById("complaintInput").value;

    const response = await fetch("http://localhost:5000/complaint", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ complaint: text })
    });

    const data = await response.json();
    document.getElementById("complaintResult").innerText = data.result;
}async function uploadImage() {
    const file = document.getElementById("imageInput").files[0];
    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch("http://localhost:5000/lost", {
        method: "POST",
        body: formData
    });

    const data = await response.json();
    document.getElementById("lostResult").innerText = data.result;
}