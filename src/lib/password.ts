export type PasswordValidationResult = {
  valid: boolean;
  errors: string[];
};

const MIN_LENGTH = 8;

export const validatePasswordStrength = (password: string): PasswordValidationResult => {
  const errors: string[] = [];

  if (!password || password.length < MIN_LENGTH) {
    errors.push('Mínimo de 8 caracteres.');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Pelo menos 1 letra maiúscula.');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Pelo menos 1 letra minúscula.');
  }
  if (!/\d/.test(password)) {
    errors.push('Pelo menos 1 número.');
  }
  if (!/[!@#$%^&*(),.?":{}|<>_\-+=]/.test(password)) {
    errors.push('Pelo menos 1 símbolo.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
