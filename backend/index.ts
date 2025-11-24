import express from 'express';
import cors from 'cors';
import routes from './src/routes';
import { loadEnv, getEnv } from './src/lib/env';
import { requestLogger } from './src/middleware/requestLogger';
import { errorHandler } from './src/middleware/errorHandler';

loadEnv();

const app = express();
const port = Number(getEnv('BACKEND_PORT', '4000'));

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use('/', routes);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Backend listening on port ${port}`);
});
