const { locations, children, lookup, tree } = require("./data/locations.json");

exports.handler = async function (event) {
    if (event.httpMethod !== "GET") {
        return { statusCode: 405, headers: { Allow: "GET" }, body: "Method not allowed" };
    }
    const parameters = event.queryStringParameters || {};
    const pathname = event.rawUrl ? new URL(event.rawUrl).pathname : event.path;
    const hierarchyPath = parameters.path ?? (
        pathname && !pathname.startsWith("/api/") && !pathname.startsWith("/.netlify/functions/")
            ? pathname.replace(/^\//, "")
            : undefined
    );
    let result;
    let filename;
    if (pathname === "/api/details") {
        result = locations[lookup[parameters.path || ""]];
    } else if (pathname === "/api/tree") {
        if (!Object.hasOwn(lookup, parameters.path || "")) {
            return { statusCode: 404, body: JSON.stringify({ error: "Location not found." }) };
        }
        result = tree;
        for (const [index, part] of (parameters.path || "").split("/").entries()) {
            if (index > 0 && index < 4) result = result?.[["districts", "wards", "streets"][index - 1]];
            result = Array.isArray(result) ? (result.includes(part) ? [part] : undefined) : result?.[part];
        }
        filename = "mtaa-location-tree.json";
    } else if (pathname === "/api/grouped") {
        result = locations.filter(location => !parameters.level || location.level === parameters.level);
        filename = "mtaa-directory.json";
    } else if (hierarchyPath !== undefined) {
        const path = hierarchyPath.split("/").map(decodeURIComponent).join("/");
        result = children[path] || [];
    } else {
        const query = (parameters.q || "").trim().toLowerCase();
        const level = parameters.level || "";
        const validLevel = ["Region", "District", "Ward", "Street", "Place"].includes(level);
        const offset = Number(parameters.offset || 0);
        const limit = Number(parameters.limit || 8);
        if (!Number.isInteger(offset) || !Number.isInteger(limit) || offset < 0 || limit < 1 || limit > 100) {
            return { statusCode: 400, body: JSON.stringify({ error: "Invalid pagination." }) };
        }
        result = query.length < 2 && !validLevel ? [] : locations.filter(location =>
            (!level || location.level === level) &&
            (location.name.toLowerCase().includes(query) || location.post_code.startsWith(query))
        ).sort((a, b) =>
            Number(!a.name.toLowerCase().startsWith(query)) - Number(!b.name.toLowerCase().startsWith(query)) ||
            a.name.length - b.name.length ||
            (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0)
        ).slice(offset, offset + limit);
    }
    if (result === undefined) {
        return { statusCode: 404, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Location not found." }) };
    }
    return {
        statusCode: 200,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            ...(filename ? { "Content-Disposition": `attachment; filename="${filename}"` } : {})
        },
        body: JSON.stringify(result)
    };
};
