import * as https from "https";

const apiKey = "828wtu6h0_2jj4u22sx_is3i7go2e";
const make = "Volkswagen";
const model = "Golf";

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
