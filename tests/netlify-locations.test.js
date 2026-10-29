const { test } = require("node:test");
const assert = require("node:assert/strict");
const { handler } = require("../netlify/functions/locations.js");

test("rewritten hierarchy requests load every level without injected query parameters", async () => {
    const paths = [
        ["/Kilimanjaro", "Hai"],
        ["/Kilimanjaro/Hai", "Bomang'ombe"],
        ["/Kilimanjaro/Hai/Bomang%27ombe", "Mtakuja"],
        ["/Kilimanjaro/Hai/Bomang%27ombe/Mtakuja", "Gezaulole"],
    ];
    for (const [path, expected] of paths) {
        const response = await handler({
            httpMethod: "GET",
            path: "/.netlify/functions/locations",
            rawUrl: "https://example.netlify.app" + path,
            queryStringParameters: {},
        });
        assert.equal(response.statusCode, 200);
        assert.ok(JSON.parse(response.body).includes(expected), path);
    }
});

test("search still returns Gezaulole's complete path", async () => {
    const response = await handler({
        httpMethod: "GET",
        path: "/api/search",
        rawUrl: "https://example.netlify.app/api/search?q=Gezaulole",
        queryStringParameters: { q: "Gezaulole" },
    });
    assert.ok(JSON.parse(response.body).some(location =>
        location.name === "Gezaulole" && location.region === "Kilimanjaro" &&
        location.district === "Hai" && location.ward === "Bomang'ombe" &&
        location.street === "Mtakuja"
    ));
});
