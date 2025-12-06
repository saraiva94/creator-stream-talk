export type PasswordValidationResult = {
  valid: boolean;
  errors: string[];
  checks: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSymbol: boolean;
  };
};

const MIN_LENGTH = 8;

export const validatePasswordStrength = (password: string): PasswordValidationResult => {
  const errors: string[] = [];
  const checks = {
    minLength: password && password.length >= MIN_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSymbol: /[!@#$%^&*(),.?":{}|<>_\-+=]/.test(password),
  };

  if (!checks.minLength) {
    errors.push('Mínimo de 8 caracteres.');
  }
  if (!checks.hasUppercase) {
    errors.push('Pelo menos 1 letra maiúscula.');
  }
  if (!checks.hasLowercase) {
    errors.push('Pelo menos 1 letra minúscula.');
  }
  if (!checks.hasNumber) {
    errors.push('Pelo menos 1 número.');
  }
  if (!checks.hasSymbol) {
    errors.push('Pelo menos 1 símbolo.');
  }

  return {
    valid: errors.length === 0,
    errors,
    checks,
  };
};
