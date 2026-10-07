// Cleans a Postman collection export so it can be offered as a public download.
//
//   node tools/clean-collection.js <export.json> <src/downloads/name.postman_collection.json> [placeholder base URL]
//
// - Removes _exporter_id (it identifies the Postman account that exported the file).
// - Blanks credential variables (passwords, secrets, tokens, client IDs, TID UUIDs) unless they
//   hold an obvious placeholder such as USERNAME, PASSWORD, or BLANK.
// - Replaces any variable that points at a real server (anything but localhost) with the
//   placeholder base URL, so no environment's address ships in the file.
// - Drops saved responses, which can hold real data.
// - Refuses to write the file if anything that looks like a token or a real B2W address is left.
const fs = require('fs');
const path = require('path');

const [src, out, placeholder = 'https://<cluster>.b2w.trimble.com/OpsAPI_<environment>'] = process.argv.slice(2);
if (!src || !out) { console.error('Usage: node tools/clean-collection.js <export.json> <output.json> [placeholder base URL]'); process.exit(1); }

const c = JSON.parse(fs.readFileSync(src, 'utf8').replace(/^﻿/, ''));
const notes = [];
if (c.info && c.info._exporter_id) { delete c.info._exporter_id; notes.push('removed _exporter_id'); }

const SECRET = /pass(word)?|secret|token|clientid|tiduuid|apikey/i;
const PLACEHOLDER = /^(|USERNAME|PASSWORD|BLANK|\{\{[^}]+\}\})$/i;
(c.variable || []).forEach((v) => {
  const value = v.value == null ? '' : String(v.value);
  if (SECRET.test(v.key) && !PLACEHOLDER.test(value)) { v.value = ''; notes.push('blanked ' + v.key); }
  else if (/^https?:\/\//i.test(value) && !/^https?:\/\/localhost(?=[:/]|$)/i.test(value)) { v.value = placeholder; notes.push('set ' + v.key + ' to the placeholder address'); }
});

let responses = 0;
(function walk(items) {
  (items || []).forEach((i) => {
    if (i.item) walk(i.item);
    if (i.response && i.response.length) { responses += i.response.length; i.response = []; }
  });
})(c.item);
if (responses) notes.push('dropped ' + responses + ' saved responses');

const text = JSON.stringify(c, null, 2) + '\n';
const problems = [];
if (/eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/.test(text)) problems.push('a token (JWT)');
const hosts = (text.match(/https?:\/\/[a-z0-9-]+\.b2w\.trimble\.com/gi) || []);
if (hosts.length) problems.push('a real B2W address (' + hosts.length + ')');
if (/b2wtechsupport|productmanagers/i.test(text)) problems.push('an internal environment name');
if (problems.length) { console.error('Not written: the file still contains ' + problems.join(', ') + '. Clean it by hand first.'); process.exit(2); }

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, text);
console.log(path.basename(out) + ': ' + (notes.join('; ') || 'nothing to clean') + ' (' + Math.round(text.length / 1024) + ' KB)');
