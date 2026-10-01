import { isStrongPassword, isValidCpf, validDate } from "./index.ts";

const denoTest = (
  globalThis as typeof globalThis & {
    Deno: { test(name: string, run: () => void): void };
  }
).Deno.test;

denoTest("validates Brazilian CPF checksum and rejects repeated digits", () => {
  if (!isValidCpf("529.982.247-25")) throw new Error("Known-valid CPF was rejected.");
  if (isValidCpf("529.982.247-24")) throw new Error("Bad CPF checksum was accepted.");
  if (isValidCpf("111.111.111-11")) throw new Error("Repeated-digit CPF was accepted.");
});

denoTest("matches the client password length policy", () => {
  if (!isStrongPassword("Strong!Pass8")) throw new Error("Strong password was rejected.");
  if (isStrongPassword("short1!")) throw new Error("Short password was accepted.");
  if (!isStrongPassword("12345678")) throw new Error("Client-valid password was rejected.");
  if (isStrongPassword("x".repeat(129))) throw new Error("Overlong password was accepted.");
});

denoTest("accepts only real ISO calendar dates", () => {
  if (!validDate("2025-02-28")) throw new Error("Valid date was rejected.");
  if (validDate("2025-02-30")) throw new Error("Invalid calendar date was accepted.");
  if (validDate("28/02/2025")) throw new Error("Non-ISO date was accepted.");
});