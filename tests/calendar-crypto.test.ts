import assert from "node:assert/strict";
import test from "node:test";
import { decryptCalendarToken, encryptCalendarToken } from "../lib/server/calendar-crypto.ts";

test("encrypts and decrypts a calendar token without storing plaintext", () => {
  const key = Buffer.alloc(32, 7).toString("base64");
  const plaintext = "microsoft-provider-token";
  const encrypted = encryptCalendarToken(plaintext, key);

  assert.notEqual(encrypted, plaintext);
  assert.equal(encrypted.includes(plaintext), false);
  assert.equal(decryptCalendarToken(encrypted, key), plaintext);
});

test("rejects encryption keys that are not 32 bytes", () => {
  assert.throws(
    () => encryptCalendarToken("token", Buffer.alloc(16).toString("base64")),
    /32 bytes/,
  );
});

