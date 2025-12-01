import { validatePasswordStrength } from "@/lib/password";

describe("validatePasswordStrength", () => {
  it("rejects passwords shorter than 8 characters", () => {
    const result = validatePasswordStrength("Ab1!");
    expect(result.valid).toBe(false);
  });

  it("rejects passwords without uppercase", () => {
    const result = validatePasswordStrength("weakpass1!");
    expect(result.valid).toBe(false);
  });

  it("rejects passwords without lowercase", () => {
    const result = validatePasswordStrength("WEAKPASS1!");
    expect(result.valid).toBe(false);
  });

  it("rejects passwords without number", () => {
    const result = validatePasswordStrength("WeakPass!");
    expect(result.valid).toBe(false);
  });

  it("rejects passwords without symbol", () => {
    const result = validatePasswordStrength("WeakPass1");
    expect(result.valid).toBe(false);
  });

  it("accepts strong passwords", () => {
    const result = validatePasswordStrength("Strong1!");
    expect(result.valid).toBe(true);
  });
});
