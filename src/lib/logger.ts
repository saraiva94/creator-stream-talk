/**
 * Sistema de Logging Centralizado para Debug do Stream Live Hub
 * 
 * Fluxos monitorados:
 * - [AUTH] Autenticação e sessão
 * - [REGISTER] Cadastro com pagamento
 * - [AFFILIATE] Código de afiliado e links
 * - [CREATOR] Ativação de criador
 * - [CREDITS] Compra e saldo de créditos
 * - [PAYMENT] Integração Mercado Pago
 * - [LIVE] Transmissões ao vivo
 * - [API] Requisições HTTP
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogModule = 
  | 'AUTH' 
  | 'REGISTER' 
  | 'AFFILIATE' 
  | 'CREATOR' 
  | 'CREDITS' 
  | 'PAYMENT' 
  | 'LIVE' 
  | 'API'
  | 'PROFILE'
  | 'WEBHOOK';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: LogModule;
  action: string;
  data?: Record<string, unknown>;
  error?: string;
  stack?: string;
}

// Armazena logs em memória para debug
const logHistory: LogEntry[] = [];
const MAX_LOG_HISTORY = 500;

// Cores para console
const COLORS: Record<LogLevel, string> = {
  debug: '#888888',
  info: '#4CAF50',
  warn: '#FF9800',
  error: '#F44336',
};

const MODULE_COLORS: Record<LogModule, string> = {
  AUTH: '#9C27B0',
  REGISTER: '#2196F3',
  AFFILIATE: '#00BCD4',
  CREATOR: '#FF5722',
  CREDITS: '#4CAF50',
  PAYMENT: '#FFC107',
  LIVE: '#E91E63',
  API: '#607D8B',
  PROFILE: '#795548',
  WEBHOOK: '#673AB7',
};

const formatTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 23);
};

const createLogEntry = (
  level: LogLevel,
  module: LogModule,
  action: string,
  data?: Record<string, unknown>,
  error?: Error | string
): LogEntry => {
  const entry: LogEntry = {
    timestamp: formatTimestamp(),
    level,
    module,
    action,
  };

  if (data) {
    entry.data = data;
  }

  if (error) {
    if (error instanceof Error) {
      entry.error = error.message;
      entry.stack = error.stack;
    } else {
      entry.error = error;
    }
  }

  return entry;
};

const logToConsole = (entry: LogEntry) => {
  const moduleColor = MODULE_COLORS[entry.module];
  const levelColor = COLORS[entry.level];
  
  const prefix = `%c[${entry.module}]%c ${entry.action}`;
  const styles = [
    `color: ${moduleColor}; font-weight: bold;`,
    `color: ${levelColor};`,
  ];

  if (entry.data || entry.error) {
    console.groupCollapsed(prefix, ...styles);
    console.log('⏱️ Timestamp:', entry.timestamp);
    if (entry.data) {
      console.log('📦 Data:', entry.data);
    }
    if (entry.error) {
      console.error('❌ Error:', entry.error);
      if (entry.stack) {
        console.error('📚 Stack:', entry.stack);
      }
    }
    console.groupEnd();
  } else {
    console.log(prefix, ...styles);
  }
};

const addToHistory = (entry: LogEntry) => {
  logHistory.push(entry);
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.shift();
  }
};

const log = (
  level: LogLevel,
  module: LogModule,
  action: string,
  data?: Record<string, unknown>,
  error?: Error | string
) => {
  const entry = createLogEntry(level, module, action, data, error);
  addToHistory(entry);
  logToConsole(entry);
};

// API pública do logger
export const logger = {
  // Métodos por nível
  debug: (module: LogModule, action: string, data?: Record<string, unknown>) =>
    log('debug', module, action, data),
  
  info: (module: LogModule, action: string, data?: Record<string, unknown>) =>
    log('info', module, action, data),
  
  warn: (module: LogModule, action: string, data?: Record<string, unknown>, error?: Error | string) =>
    log('warn', module, action, data, error),
  
  error: (module: LogModule, action: string, data?: Record<string, unknown>, error?: Error | string) =>
    log('error', module, action, data, error),

  // Métodos por módulo para conveniência
  auth: {
    debug: (action: string, data?: Record<string, unknown>) => log('debug', 'AUTH', action, data),
    info: (action: string, data?: Record<string, unknown>) => log('info', 'AUTH', action, data),
    warn: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('warn', 'AUTH', action, data, error),
    error: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('error', 'AUTH', action, data, error),
  },

  register: {
    debug: (action: string, data?: Record<string, unknown>) => log('debug', 'REGISTER', action, data),
    info: (action: string, data?: Record<string, unknown>) => log('info', 'REGISTER', action, data),
    warn: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('warn', 'REGISTER', action, data, error),
    error: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('error', 'REGISTER', action, data, error),
  },

  affiliate: {
    debug: (action: string, data?: Record<string, unknown>) => log('debug', 'AFFILIATE', action, data),
    info: (action: string, data?: Record<string, unknown>) => log('info', 'AFFILIATE', action, data),
    warn: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('warn', 'AFFILIATE', action, data, error),
    error: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('error', 'AFFILIATE', action, data, error),
  },

  creator: {
    debug: (action: string, data?: Record<string, unknown>) => log('debug', 'CREATOR', action, data),
    info: (action: string, data?: Record<string, unknown>) => log('info', 'CREATOR', action, data),
    warn: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('warn', 'CREATOR', action, data, error),
    error: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('error', 'CREATOR', action, data, error),
  },

  credits: {
    debug: (action: string, data?: Record<string, unknown>) => log('debug', 'CREDITS', action, data),
    info: (action: string, data?: Record<string, unknown>) => log('info', 'CREDITS', action, data),
    warn: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('warn', 'CREDITS', action, data, error),
    error: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('error', 'CREDITS', action, data, error),
  },

  payment: {
    debug: (action: string, data?: Record<string, unknown>) => log('debug', 'PAYMENT', action, data),
    info: (action: string, data?: Record<string, unknown>) => log('info', 'PAYMENT', action, data),
    warn: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('warn', 'PAYMENT', action, data, error),
    error: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('error', 'PAYMENT', action, data, error),
  },

  live: {
    debug: (action: string, data?: Record<string, unknown>) => log('debug', 'LIVE', action, data),
    info: (action: string, data?: Record<string, unknown>) => log('info', 'LIVE', action, data),
    warn: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('warn', 'LIVE', action, data, error),
    error: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('error', 'LIVE', action, data, error),
  },

  api: {
    debug: (action: string, data?: Record<string, unknown>) => log('debug', 'API', action, data),
    info: (action: string, data?: Record<string, unknown>) => log('info', 'API', action, data),
    warn: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('warn', 'API', action, data, error),
    error: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('error', 'API', action, data, error),
  },

  profile: {
    debug: (action: string, data?: Record<string, unknown>) => log('debug', 'PROFILE', action, data),
    info: (action: string, data?: Record<string, unknown>) => log('info', 'PROFILE', action, data),
    warn: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('warn', 'PROFILE', action, data, error),
    error: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('error', 'PROFILE', action, data, error),
  },

  webhook: {
    debug: (action: string, data?: Record<string, unknown>) => log('debug', 'WEBHOOK', action, data),
    info: (action: string, data?: Record<string, unknown>) => log('info', 'WEBHOOK', action, data),
    warn: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('warn', 'WEBHOOK', action, data, error),
    error: (action: string, data?: Record<string, unknown>, error?: Error | string) => log('error', 'WEBHOOK', action, data, error),
  },

  // Utilitários
  getHistory: () => [...logHistory],
  
  clearHistory: () => {
    logHistory.length = 0;
  },

  exportLogs: () => {
    return JSON.stringify(logHistory, null, 2);
  },

  // Disponibiliza no window para debug via console do browser
  exposeGlobally: () => {
    if (typeof window !== 'undefined') {
      (window as unknown as { __streamLogs: typeof logger }).__streamLogs = logger;
    }
  },
};

// Expõe automaticamente em desenvolvimento
if (import.meta.env.DEV) {
  logger.exposeGlobally();
}

export default logger;
