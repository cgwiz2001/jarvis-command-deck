// node tests/voices.test.mjs  — checks British voice ranking and auto-pick
import { isBritish, isEnglish, voiceScore, partitionVoices, pickBestVoice } from "../voices.js";

let fail = 0, pass = 0;
const eq = (got, want, label) => { if (got === want) pass++; else { fail++; console.log("FAIL", label || "", "\n  got:  " + got + "\n  want: " + want); } };
const ok = (cond, label) => { if (cond) pass++; else { fail++; console.log("FAIL", label); } };
const V = (name, lang, voiceURI) => ({ name, lang, voiceURI: voiceURI || name });

const sonia = V("Microsoft Sonia Online (Natural) - English (United Kingdom)", "en-GB");
const ryan = V("Microsoft Ryan Online (Natural) - English (United Kingdom)", "en-GB");
const googleF = V("Google UK English Female", "en-GB");
const googleM = V("Google UK English Male", "en-GB");
const daniel = V("Daniel", "en-GB");
const serena = V("Serena", "en-GB");
const kate = V("Kate", "en-GB");
const arthur = V("Arthur", "en-GB");
const martha = V("Martha", "en-GB");
const george = V("Microsoft George - English (United Kingdom)", "en-GB");
const compact = V("English (United Kingdom)", "en-GB");
const us = V("Google US English", "en-US");
const samantha = V("Samantha", "en-US");
const fr = V("Thomas", "fr-FR");

ok(isBritish(sonia) && isBritish(googleF) && isBritish(daniel) && isBritish(compact), "en-GB and UK names count as British");
ok(isBritish(V("Samsung English UK", "en_GB")), "en_GB underscore and English UK");
ok(!isBritish(us) && !isBritish(samantha) && !isBritish(fr), "US and French voices are not British");
ok(isEnglish(us) && isEnglish(googleF) && !isEnglish(fr), "English filter");

ok(voiceScore(sonia) > voiceScore(googleF), "Sonia Natural outranks Google UK");
ok(voiceScore(ryan) > voiceScore(googleM), "Ryan Natural outranks Google UK Male");
ok(voiceScore(googleF) > voiceScore(george), "Google UK outranks older George");
ok(voiceScore(daniel) > voiceScore(compact), "Daniel outranks a generic UK voice");
ok(voiceScore(serena) > voiceScore(compact), "Serena outranks a generic UK voice");
ok(voiceScore(kate) > voiceScore(george), "Kate outranks George");
ok(voiceScore(arthur) > voiceScore(compact), "Arthur outranks a generic UK voice");
ok(voiceScore(martha) > voiceScore(compact), "Martha outranks a generic UK voice");
ok(voiceScore(googleF) > voiceScore(us), "Google UK Female outranks Google US");
ok(voiceScore(compact) > voiceScore(us), "any British voice outranks US English");
ok(voiceScore(fr) === -1, "non-English voices are not auto-picked");

eq(pickBestVoice([]), null, "empty list");
eq(pickBestVoice([us, googleF, sonia, daniel]).name, sonia.name, "auto picks the most natural British voice");
eq(pickBestVoice([us, samantha, compact]).name, compact.name, "falls back to a generic British voice");
eq(pickBestVoice([us, samantha]).name, us.name, "falls back to other English if no British voice");
eq(pickBestVoice([sonia, googleF], googleF.voiceURI).name, googleF.name, "saved voice URI is honoured");
eq(pickBestVoice([sonia, daniel], "Daniel").name, "Daniel", "saved voice name is honoured");
eq(pickBestVoice([sonia, googleF], "missing-voice").name, sonia.name, "missing saved voice falls back to auto");

const { gb, other } = partitionVoices([us, sonia, george, googleF, samantha, fr, daniel]);
eq(gb[0].name, sonia.name, "British group lists natural voices first");
ok(gb.map(v => v.name).includes("Daniel") && gb.map(v => v.name).includes("Google UK English Female"), "British group includes Daniel and Google UK");
ok(other.every(v => !isBritish(v)) && other.some(v => v.name === "Google US English"), "other English group has no British voices");
ok(!gb.some(v => v.name === "Thomas") && !other.some(v => v.name === "Thomas"), "non-English voices are omitted");

console.log(pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
