const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");

function loadUI(responseValues) {
    const elements = new Map();
    function element(id) {
        if (!elements.has(id)) {
            elements.set(id, {
                value: "", textContent: "", disabled: false, hidden: false,
                wrapper: { hidden: false }, options: [], listeners: {},
                addEventListener(event, callback) { this.listeners[event] = callback; },
                replaceChildren(...options) { this.options = options; this.value = ""; },
                add(option) { this.options.push(option); },
                closest() { return this.wrapper; },
            });
        }
        return elements.get(id);
    }
    vm.runInNewContext(readFileSync(require.resolve("../static/app.js"), "utf8"), {
        document: { getElementById: element },
        Option: function (text, value) { this.text = text; this.value = value; },
        AbortController,
        fetch: async (url) => ({ ok: true, json: async () => url.startsWith("/api/details") ? { post_code: "16113" } : responseValues }),
    });
    ["regions", "districts", "wards", "streets"].forEach((id, i) => {
        element(id).value = ["Dar-es-salaam", "Ubungo", "Mbezi", "Mbezi luis"][i];
    });
    return element;
}

test("blank place records hide the dropdown and report no places", async () => {
    const element = loadUI(["", "  ", null]);
    await element("streets").listeners.change.call(element("streets"));
    assert.equal(element("neighborhood").wrapper.hidden, true);
    assert.equal(element("neighborhood").disabled, true);
    assert.equal(element("browse-feedback").textContent, "No places are listed for this area.");
    assert.equal(element("selection-summary").hidden, false);
    assert.equal(element("selected-place").textContent, "Mbezi luis");
    assert.equal(element("selected-postcode").textContent, "Ward postcode: 16113");
});

test("valid options remain visible and blank entries are not counted", async () => {
    const element = loadUI(["", "Gezaulole", "  "]);
    await element("streets").listeners.change.call(element("streets"));
    assert.equal(element("neighborhood").wrapper.hidden, false);
    assert.equal(element("neighborhood").disabled, false);
    assert.equal(element("neighborhood").options.length, 2);
    assert.equal(element("browse-feedback").textContent, "1 place is ready to choose.");
});
