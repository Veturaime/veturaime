import * as https from "https";

const apiKey = process.env.CARSXE_API_KEY;
const make = "Volkswagen";
const model = "Golf";

if (!apiKey) {
    console.error("Missing CARSXE_API_KEY in environment.");
    process.exit(1);
}

const url = `https://api.carsxe.com/images?key=${apiKey}&format=json&transparent=false&make=${make}&model=${model}`;

https.get(url, (res) => {
    let data = "";

    res.on("data", (chunk) => {
        data += chunk;
    });

    res.on("end", () => {
        console.log("Status:", res.statusCode);
        console.log("Response:", data);
    });
}).on("error", (err) => {
    console.log("Error: " + err.message);
});
